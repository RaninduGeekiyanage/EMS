<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class EmployeeEvaluation extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED_TO_HR = 'submitted_to_hr';
    public const STATUS_CONFIRMED_BY_HR = 'confirmed_by_hr';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_ARCHIVED = 'archived';

    public const GRADE_A_PLUS = 'A+';
    public const GRADE_A = 'A';
    public const GRADE_B = 'B';
    public const GRADE_C = 'C';
    public const GRADE_D = 'D';

    /**
     * Standard evaluation criteria definitions with recommended weights (total = 100).
     */
    public const STANDARD_CRITERIA = [
        'attendance_punctuality' => [
            'key' => 'attendance_punctuality',
            'title' => 'Attendance & Punctuality',
            'weight' => 20,
            'description' => 'Shift discipline, timeliness, and minimal unexcused absence/late punches.',
        ],
        'job_performance' => [
            'key' => 'job_performance',
            'title' => 'Core Job Performance & Output',
            'weight' => 25,
            'description' => 'Quality, productivity, thoroughness, and timeliness of core duties.',
        ],
        'teamwork' => [
            'key' => 'teamwork',
            'title' => 'Teamwork & Collaboration',
            'weight' => 20,
            'description' => 'Interpersonal rapport, willingness to assist colleagues, and effective communication.',
        ],
        'leadership' => [
            'key' => 'leadership',
            'title' => 'Leadership & Initiative',
            'weight' => 15,
            'description' => 'Proactive problem solving, accountability, ownership, and mentorship.',
        ],
        'technical_skills' => [
            'key' => 'technical_skills',
            'title' => 'Technical & Functional Skill',
            'weight' => 20,
            'description' => 'Job knowledge, adherence to operating standards, and skill mastery.',
        ],
    ];

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'employee_evaluations';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'evaluator_id',
        'evaluation_period',
        'evaluation_date',
        'ratings_json',
        'overall_score',
        'performance_grade',
        'hod_comments',
        'hr_reviewer_id',
        'hr_comments',
        'status',
        'is_bypassed_by_hr',
        'hr_actioned_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'evaluation_date' => 'date:Y-m-d',
            'ratings_json' => 'array',
            'overall_score' => 'float',
            'is_bypassed_by_hr' => 'boolean',
            'hr_actioned_at' => 'datetime',
        ];
    }

    /**
     * Compute letter grade from a 0-100 overall score.
     */
    public static function computeGrade(float $score): string
    {
        if ($score >= 90.0) {
            return self::GRADE_A_PLUS;
        }
        if ($score >= 80.0) {
            return self::GRADE_A;
        }
        if ($score >= 70.0) {
            return self::GRADE_B;
        }
        if ($score >= 60.0) {
            return self::GRADE_C;
        }

        return self::GRADE_D;
    }

    /**
     * Get the grade narrative description.
     */
    public static function getGradeLabel(string $grade): string
    {
        return match ($grade) {
            self::GRADE_A_PLUS => 'Exceptional Performance (A+)',
            self::GRADE_A => 'Exceeds Expectations (A)',
            self::GRADE_B => 'Meets Expectations (B)',
            self::GRADE_C => 'Needs Improvement (C)',
            self::GRADE_D => 'Unsatisfactory (D)',
            default => 'Not Graded',
        };
    }

    /**
     * Determine if evaluation is editable by evaluator.
     */
    public function isEditable(): bool
    {
        return in_array($this->status, [self::STATUS_DRAFT, self::STATUS_SUBMITTED_TO_HR], true);
    }

    /**
     * Scope query to draft evaluations.
     *
     * @param Builder<EmployeeEvaluation> $query
     */
    public function scopeDraft(Builder $query): void
    {
        $query->where('status', self::STATUS_DRAFT);
    }

    /**
     * Scope query to submitted evaluations awaiting HR review.
     *
     * @param Builder<EmployeeEvaluation> $query
     */
    public function scopeSubmittedToHr(Builder $query): void
    {
        $query->where('status', self::STATUS_SUBMITTED_TO_HR);
    }

    /**
     * Scope query to HR confirmed evaluations.
     *
     * @param Builder<EmployeeEvaluation> $query
     */
    public function scopeConfirmedByHr(Builder $query): void
    {
        $query->where('status', self::STATUS_CONFIRMED_BY_HR);
    }

    /**
     * Scope query for a specific period.
     *
     * @param Builder<EmployeeEvaluation> $query
     */
    public function scopeForPeriod(Builder $query, string $period): void
    {
        $query->where('evaluation_period', $period);
    }

    /**
     * Scope query for a specific employee.
     *
     * @param Builder<EmployeeEvaluation> $query
     */
    public function scopeForEmployee(Builder $query, string $employeeId): void
    {
        $query->where('employee_id', $employeeId);
    }

    /**
     * Scope query for a specific department.
     *
     * @param Builder<EmployeeEvaluation> $query
     */
    public function scopeForDepartment(Builder $query, string $departmentId): void
    {
        $query->whereHas('employee', function (Builder $empQuery) use ($departmentId): void {
            $empQuery->where('department_id', $departmentId);
        });
    }

    /**
     * The employee being evaluated.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * The evaluator user (typically HOD or supervisor).
     *
     * @return BelongsTo<User, $this>
     */
    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    /**
     * The HR reviewer user.
     *
     * @return BelongsTo<User, $this>
     */
    public function hrReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hr_reviewer_id');
    }

    /**
     * The tenant company.
     *
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
