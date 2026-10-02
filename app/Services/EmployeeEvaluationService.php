<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeEvaluation;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdfWrapper;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class EmployeeEvaluationService
{
    /**
     * Compute weighted overall score and performance grade from structured ratings.
     *
     * @param  array<string|int, mixed>  $ratings
     * @return array{overall_score: float, performance_grade: string, sanitized_ratings: array<string, array<string, mixed>>}
     */
    public function calculateOverallScore(array $ratings): array
    {
        $criteriaDefs = EmployeeEvaluation::STANDARD_CRITERIA;
        $sanitized = [];
        $totalWeightedScore = 0.0;
        $totalWeight = 0.0;

        foreach ($criteriaDefs as $key => $def) {
            $input = $ratings[$key] ?? [];

            // Score can be given directly (0-100) or as rating (1-5)
            $rawScore = null;
            if (isset($input['score']) && is_numeric($input['score'])) {
                $rawScore = (float) $input['score'];
            } elseif (isset($input['rating']) && is_numeric($input['rating'])) {
                $rawScore = ((float) $input['rating'] / 5.0) * 100.0;
            } else {
                $rawScore = 75.0; // Default neutral score if omitted
            }

            // Clamp score to 0.00 - 100.00
            $score = max(0.0, min(100.0, round($rawScore, 2)));

            // Weight
            $weight = isset($input['weight']) && is_numeric($input['weight'])
                ? (float) $input['weight']
                : (float) $def['weight'];

            $weightedScore = round(($score * $weight) / 100.0, 2);
            $totalWeightedScore += $weightedScore;
            $totalWeight += $weight;

            $ratingStar = round(($score / 100.0) * 5.0, 1);

            $sanitized[$key] = [
                'key' => $key,
                'title' => $def['title'],
                'description' => $def['description'],
                'weight' => $weight,
                'score' => $score,
                'rating' => $ratingStar,
                'weighted_score' => $weightedScore,
                'remarks' => isset($input['remarks']) ? trim((string) $input['remarks']) : null,
            ];
        }

        // If total weight is non-standard, normalize
        if ($totalWeight > 0 && abs($totalWeight - 100.0) > 0.01) {
            $normalizedScore = round(($totalWeightedScore / $totalWeight) * 100.0, 2);
        } else {
            $normalizedScore = round($totalWeightedScore, 2);
        }

        $overallScore = max(0.0, min(100.0, $normalizedScore));
        $grade = EmployeeEvaluation::computeGrade($overallScore);

        return [
            'overall_score' => $overallScore,
            'performance_grade' => $grade,
            'sanitized_ratings' => $sanitized,
        ];
    }

    /**
     * Prevent duplicate active appraisals for the same employee and period.
     */
    public function checkAntiDuplicate(string $tenantId, string $employeeId, string $period, ?string $excludeId = null): void
    {
        $query = EmployeeEvaluation::query()
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('evaluation_period', $period)
            ->whereNotIn('status', [EmployeeEvaluation::STATUS_REJECTED, EmployeeEvaluation::STATUS_ARCHIVED]);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'evaluation_period' => "An active appraisal already exists for this employee for period '{$period}'.",
            ]);
        }
    }

    /**
     * Create an evaluation as draft or submitted to HR.
     *
     * @param  array<string, mixed>  $data
     */
    public function createEvaluation(User $actor, array $data, bool $isDraft = false): EmployeeEvaluation
    {
        $tenantId = (string) ($actor->tenant_id ?? session('tenant_id'));
        $employee = Employee::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($data['employee_id']);

        $period = trim((string) $data['evaluation_period']);
        $this->checkAntiDuplicate($tenantId, $employee->id, $period);

        $calculated = $this->calculateOverallScore($data['ratings_json'] ?? []);

        return DB::transaction(function () use ($tenantId, $employee, $actor, $data, $period, $calculated, $isDraft): EmployeeEvaluation {
            $status = $isDraft
                ? EmployeeEvaluation::STATUS_DRAFT
                : EmployeeEvaluation::STATUS_SUBMITTED_TO_HR;

            return EmployeeEvaluation::create([
                'tenant_id' => $tenantId,
                'employee_id' => $employee->id,
                'evaluator_id' => $actor->id,
                'evaluation_period' => $period,
                'evaluation_date' => $data['evaluation_date'],
                'ratings_json' => $calculated['sanitized_ratings'],
                'overall_score' => $calculated['overall_score'],
                'performance_grade' => $calculated['performance_grade'],
                'hod_comments' => $data['hod_comments'] ?? null,
                'status' => $status,
                'is_bypassed_by_hr' => false,
            ]);
        });
    }

    /**
     * Update an evaluation record.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateEvaluation(EmployeeEvaluation $evaluation, User $actor, array $data, bool $submitToHr = false): EmployeeEvaluation
    {
        if (! $evaluation->isEditable()) {
            throw ValidationException::withMessages([
                'status' => 'This evaluation is finalized and cannot be edited.',
            ]);
        }

        $tenantId = $evaluation->tenant_id;
        $employeeId = $data['employee_id'] ?? $evaluation->employee_id;
        $period = isset($data['evaluation_period']) ? trim((string) $data['evaluation_period']) : $evaluation->evaluation_period;

        $this->checkAntiDuplicate($tenantId, $employeeId, $period, $evaluation->id);

        $ratings = $data['ratings_json'] ?? $evaluation->ratings_json;
        $calculated = $this->calculateOverallScore($ratings);

        return DB::transaction(function () use ($evaluation, $data, $period, $calculated, $submitToHr): EmployeeEvaluation {
            $status = $submitToHr
                ? EmployeeEvaluation::STATUS_SUBMITTED_TO_HR
                : ($data['is_draft'] ?? false ? EmployeeEvaluation::STATUS_DRAFT : $evaluation->status);

            $evaluation->update([
                'employee_id' => $data['employee_id'] ?? $evaluation->employee_id,
                'evaluation_period' => $period,
                'evaluation_date' => $data['evaluation_date'] ?? $evaluation->evaluation_date,
                'ratings_json' => $calculated['sanitized_ratings'],
                'overall_score' => $calculated['overall_score'],
                'performance_grade' => $calculated['performance_grade'],
                'hod_comments' => array_key_exists('hod_comments', $data) ? $data['hod_comments'] : $evaluation->hod_comments,
                'status' => $status,
            ]);

            return $evaluation->fresh(['employee.department', 'employee.designation', 'evaluator']);
        });
    }

    /**
     * Promote a draft evaluation to submitted_to_hr.
     */
    public function submitDraft(EmployeeEvaluation $evaluation, User $actor): EmployeeEvaluation
    {
        if ($evaluation->status !== EmployeeEvaluation::STATUS_DRAFT) {
            throw ValidationException::withMessages([
                'status' => 'Only draft evaluations can be submitted to HR.',
            ]);
        }

        $evaluation->update([
            'status' => EmployeeEvaluation::STATUS_SUBMITTED_TO_HR,
        ]);

        return $evaluation;
    }

    /**
     * HR Review, Confirmation, Amendment or Managerial Bypass.
     *
     * @param  array<string, mixed>|null  $adjustedRatings
     */
    public function hrReview(
        EmployeeEvaluation $evaluation,
        User $hrUser,
        string $decision,
        ?string $hrComments = null,
        ?array $adjustedRatings = null,
        bool $isDirectBypass = false
    ): EmployeeEvaluation {
        if ($evaluation->status === EmployeeEvaluation::STATUS_CONFIRMED_BY_HR && $decision === 'confirm') {
            throw ValidationException::withMessages([
                'status' => 'This evaluation has already been confirmed by HR.',
            ]);
        }

        return DB::transaction(function () use ($evaluation, $hrUser, $decision, $hrComments, $adjustedRatings, $isDirectBypass): EmployeeEvaluation {
            $updateData = [
                'hr_reviewer_id' => $hrUser->id,
                'hr_actioned_at' => now(),
                'hr_comments' => $hrComments,
            ];

            if ($decision === 'confirm') {
                $updateData['status'] = EmployeeEvaluation::STATUS_CONFIRMED_BY_HR;
                $updateData['is_bypassed_by_hr'] = $isDirectBypass || $evaluation->status === EmployeeEvaluation::STATUS_DRAFT;
            } elseif ($decision === 'amend_and_confirm') {
                if (! empty($adjustedRatings)) {
                    $calculated = $this->calculateOverallScore($adjustedRatings);
                    $updateData['ratings_json'] = $calculated['sanitized_ratings'];
                    $updateData['overall_score'] = $calculated['overall_score'];
                    $updateData['performance_grade'] = $calculated['performance_grade'];
                }
                $updateData['status'] = EmployeeEvaluation::STATUS_CONFIRMED_BY_HR;
                $updateData['is_bypassed_by_hr'] = true;
            } elseif ($decision === 'reject') {
                $updateData['status'] = EmployeeEvaluation::STATUS_REJECTED;
            } elseif ($decision === 'archive') {
                $updateData['status'] = EmployeeEvaluation::STATUS_ARCHIVED;
            } else {
                throw ValidationException::withMessages([
                    'decision' => "Unsupported review decision '{$decision}'.",
                ]);
            }

            $evaluation->update($updateData);

            return $evaluation->fresh(['employee.department', 'employee.designation', 'evaluator', 'hrReviewer']);
        });
    }

    /**
     * Aggregate evaluation summary statistics for dashboards and reports.
     *
     * @return array<string, mixed>
     */
    public function getStatistics(string $tenantId, ?string $period = null, ?string $departmentId = null): array
    {
        $baseQuery = EmployeeEvaluation::query()->where('tenant_id', $tenantId);

        if (! empty($period) && $period !== 'all') {
            $baseQuery->where('evaluation_period', $period);
        }

        if (! empty($departmentId) && $departmentId !== 'all') {
            $baseQuery->whereHas('employee', function (Builder $q) use ($departmentId): void {
                $q->where('department_id', $departmentId);
            });
        }

        $total = (clone $baseQuery)->count();
        $pendingHr = (clone $baseQuery)->where('status', EmployeeEvaluation::STATUS_SUBMITTED_TO_HR)->count();
        $confirmed = (clone $baseQuery)->where('status', EmployeeEvaluation::STATUS_CONFIRMED_BY_HR)->count();
        $drafts = (clone $baseQuery)->where('status', EmployeeEvaluation::STATUS_DRAFT)->count();

        $avgScore = (clone $baseQuery)
            ->whereIn('status', [EmployeeEvaluation::STATUS_SUBMITTED_TO_HR, EmployeeEvaluation::STATUS_CONFIRMED_BY_HR])
            ->avg('overall_score');

        $avgScoreVal = $avgScore !== null ? round((float) $avgScore, 2) : 0.0;
        $avgGrade = $avgScoreVal > 0 ? EmployeeEvaluation::computeGrade($avgScoreVal) : '-';

        // Grade breakdown for confirmed
        $gradeCounts = [
            'A+' => (clone $baseQuery)->where('performance_grade', 'A+')->count(),
            'A' => (clone $baseQuery)->where('performance_grade', 'A')->count(),
            'B' => (clone $baseQuery)->where('performance_grade', 'B')->count(),
            'C' => (clone $baseQuery)->where('performance_grade', 'C')->count(),
            'D' => (clone $baseQuery)->where('performance_grade', 'D')->count(),
        ];

        return [
            'total' => $total,
            'pending_hr' => $pendingHr,
            'confirmed' => $confirmed,
            'drafts' => $drafts,
            'average_score' => $avgScoreVal,
            'average_grade' => $avgGrade,
            'grade_counts' => $gradeCounts,
        ];
    }

    /**
     * Generate printable PDF instance for an individual employee evaluation.
     */
    public function generatePdf(EmployeeEvaluation $evaluation): DomPdfWrapper
    {
        $evaluation->loadMissing([
            'employee.department',
            'employee.designation',
            'employee.branch',
            'evaluator',
            'hrReviewer',
            'tenant',
        ]);

        $company = Company::query()
            ->where('tenant_id', $evaluation->tenant_id)
            ->first();

        /** @var DomPdfWrapper $pdf */
        $pdf = Pdf::loadView('pdf.employee-evaluation', [
            'evaluation' => $evaluation,
            'employee' => $evaluation->employee,
            'company' => $company,
            'criteria' => $evaluation->ratings_json ?? [],
            'gradeLabel' => EmployeeEvaluation::getGradeLabel($evaluation->performance_grade ?? 'D'),
        ]);

        $pdf->setPaper('a4', 'portrait');
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', true);

        return $pdf;
    }
}
