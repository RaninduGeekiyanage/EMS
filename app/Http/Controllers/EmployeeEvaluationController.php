<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Evaluations\HrReviewEvaluationRequest;
use App\Http\Requests\Evaluations\StoreEvaluationRequest;
use App\Http\Requests\Evaluations\UpdateEvaluationRequest;
use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\EmployeeEvaluation;
use App\Services\EmployeeEvaluationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

final class EmployeeEvaluationController extends Controller
{
    public function __construct(
        private readonly EmployeeEvaluationService $evaluationService,
    ) {}

    /**
     * Display a listing of evaluations, metrics, and appraisal workspace.
     */
    public function index(Request $request): InertiaResponse
    {
        $tenantId = (string) ($request->user()->tenant_id ?? session('tenant_id'));
        $user = $request->user();

        $period = $request->string('period')->toString() ?: 'all';
        $departmentId = $request->string('department_id')->toString() ?: 'all';
        $status = $request->string('status')->toString() ?: 'all';
        $search = $request->string('search')->toString() ?: '';

        // Determine if user is an HOD
        $employeeUser = Employee::query()
            ->where('tenant_id', $tenantId)
            ->where('email', $user->email)
            ->first();

        $hodDepartmentIds = [];
        if ($employeeUser) {
            $hodDepartmentIds = DepartmentHead::query()
                ->where('tenant_id', $tenantId)
                ->where('employee_id', $employeeUser->id)
                ->pluck('department_id')
                ->toArray();
        }

        $isHod = ! empty($hodDepartmentIds);
        $isCompanyAdminOrHr = $user->is_super_admin ||
            $user->is_company_owner ||
            $user->hasRole('Company Admin') ||
            $user->hasRole('HR Manager') ||
            $user->hasRole('HR Executive') ||
            $user->can('evaluation.hr_review');

        $query = EmployeeEvaluation::query()
            ->where('tenant_id', $tenantId)
            ->with([
                'employee:id,emp_no,full_name,email,department_id,designation_id,branch_id,date_of_joining',
                'employee.department:id,name',
                'employee.designation:id,title',
                'employee.branch:id,name',
                'evaluator:id,name,email',
                'hrReviewer:id,name,email',
            ])
            ->latest('evaluation_date');

        if ($period !== 'all') {
            $query->where('evaluation_period', $period);
        }

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($departmentId !== 'all') {
            $query->whereHas('employee', function ($q) use ($departmentId): void {
                $q->where('department_id', $departmentId);
            });
        } elseif ($isHod && ! $isCompanyAdminOrHr) {
            // Scope HOD to only their department employees
            $query->whereHas('employee', function ($q) use ($hodDepartmentIds): void {
                $q->whereIn('department_id', $hodDepartmentIds);
            });
        }

        if (! empty($search)) {
            $query->where(function ($q) use ($search): void {
                $q->whereHas('employee', function ($eq) use ($search): void {
                    $eq->where('full_name', 'like', "%{$search}%")
                        ->orWhere('emp_no', 'like', "%{$search}%");
                })->orWhere('evaluation_period', 'like', "%{$search}%");
            });
        }

        $evaluations = $query->paginate(15)->withQueryString();

        $statistics = $this->evaluationService->getStatistics(
            $tenantId,
            $period !== 'all' ? $period : null,
            $departmentId !== 'all' ? $departmentId : null
        );

        $departments = Department::query()
            ->where('tenant_id', $tenantId)
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get();

        // Eligible employees for evaluation modal
        $empQuery = Employee::query()
            ->where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->select(['id', 'emp_no', 'full_name', 'department_id', 'designation_id', 'date_of_joining'])
            ->with(['department:id,name', 'designation:id,title'])
            ->orderBy('full_name');

        if ($isHod && ! $isCompanyAdminOrHr) {
            $empQuery->whereIn('department_id', $hodDepartmentIds);
        }

        $employees = $empQuery->get();

        $standardPeriods = [
            'Annual 2026',
            'Q1 2026',
            'Q2 2026',
            'Q3 2026',
            'Q4 2026',
            'Mid-Year 2026',
            'Probation Review',
        ];

        return Inertia::render('Evaluations/Index', [
            'evaluations' => $evaluations,
            'statistics' => $statistics,
            'departments' => $departments,
            'employees' => $employees,
            'standardPeriods' => $standardPeriods,
            'criteriaDefinitions' => array_values(EmployeeEvaluation::STANDARD_CRITERIA),
            'filters' => [
                'period' => $period,
                'department_id' => $departmentId,
                'status' => $status,
                'search' => $search,
            ],
            'canSubmit' => true,
            'canHrReview' => $isCompanyAdminOrHr,
            'isHod' => $isHod,
        ]);
    }

    /**
     * Store a newly created evaluation (draft or submitted to HR).
     */
    public function store(StoreEvaluationRequest $request): RedirectResponse
    {
        $isDraft = (bool) $request->boolean('is_draft', false);
        $this->evaluationService->createEvaluation($request->user(), $request->validated(), $isDraft);

        $msg = $isDraft
            ? 'Appraisal draft saved successfully.'
            : 'Performance appraisal submitted to HR for final sign-off.';

        return back()->with('success', $msg);
    }

    /**
     * Update an existing evaluation.
     */
    public function update(UpdateEvaluationRequest $request, EmployeeEvaluation $evaluation): RedirectResponse
    {
        $submitToHr = (bool) $request->boolean('submit_to_hr', false);
        $this->evaluationService->updateEvaluation($evaluation, $request->user(), $request->validated(), $submitToHr);

        $msg = $submitToHr
            ? 'Performance appraisal updated and submitted to HR for final sign-off.'
            : 'Performance appraisal updated successfully.';

        return back()->with('success', $msg);
    }

    /**
     * Submit a draft evaluation to HR.
     */
    public function submitToHr(Request $request, EmployeeEvaluation $evaluation): RedirectResponse
    {
        $this->evaluationService->submitDraft($evaluation, $request->user());

        return back()->with('success', 'Appraisal draft successfully submitted to HR for sign-off.');
    }

    /**
     * Action HR review, confirmation, managerial bypass, or rejection.
     */
    public function hrReview(HrReviewEvaluationRequest $request, EmployeeEvaluation $evaluation): RedirectResponse
    {
        $decision = $request->validated('decision');
        $hrComments = $request->validated('hr_comments');
        $adjustedRatings = $request->validated('adjusted_ratings');
        $directBypass = (bool) $request->boolean('direct_bypass', false);

        $this->evaluationService->hrReview(
            $evaluation,
            $request->user(),
            $decision,
            $hrComments,
            $adjustedRatings,
            $directBypass
        );

        $msg = match ($decision) {
            'confirm' => $directBypass
                ? 'Appraisal confirmed and finalized via HR Direct Managerial Bypass.'
                : 'Appraisal confirmed and finalized successfully.',
            'amend_and_confirm' => 'Appraisal score amended and finalized directly by HR.',
            'reject' => 'Appraisal returned / rejected.',
            'archive' => 'Appraisal archived.',
            default => 'Appraisal review recorded.',
        };

        return back()->with('success', $msg);
    }

    /**
     * Export printable executive PDF appraisal document.
     */
    public function exportPdf(EmployeeEvaluation $evaluation): Response
    {
        $pdf = $this->evaluationService->generatePdf($evaluation);
        $filename = "Appraisal_{$evaluation->employee->emp_no}_{$evaluation->evaluation_period}.pdf";

        return $pdf->stream($filename);
    }

    /**
     * Remove / soft-delete an evaluation draft.
     */
    public function destroy(EmployeeEvaluation $evaluation): RedirectResponse
    {
        if ($evaluation->status === EmployeeEvaluation::STATUS_CONFIRMED_BY_HR) {
            return back()->with('error', 'Confirmed appraisals cannot be deleted.');
        }

        $evaluation->delete();

        return back()->with('success', 'Appraisal draft deleted successfully.');
    }
}
