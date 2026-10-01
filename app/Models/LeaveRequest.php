<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class LeaveRequest extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    public const STAGE_PENDING_HOD = 'pending_hod';
    public const STAGE_PENDING_HR = 'pending_hr';
    public const STAGE_APPROVED = 'approved';
    public const STAGE_REJECTED = 'rejected';
    public const STAGE_CANCELLED = 'cancelled';

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'leave_requests';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'leave_type_id',
        'start_date',
        'end_date',
        'days_count',
        'is_half_day',
        'half_day_type',
        'is_short_leave',
        'short_leave_from',
        'short_leave_to',
        'short_leave_duration_minutes',
        'covering_employee_id',
        'reason',
        'status',
        'approval_stage',
        'hod_id',
        'hod_actioned_at',
        'hod_remarks',
        'is_bypassed_by_hr',
        'actioned_by',
        'actioned_at',
        'rejection_reason',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'days_count' => 'float',
            'is_half_day' => 'boolean',
            'is_short_leave' => 'boolean',
            'short_leave_duration_minutes' => 'integer',
            'is_bypassed_by_hr' => 'boolean',
            'hod_actioned_at' => 'datetime:Y-m-d H:i:s',
            'actioned_at' => 'datetime:Y-m-d H:i:s',
        ];
    }

    /**
     * Scope for pending requests.
     *
     * @param  Builder<LeaveRequest>  $query
     */
    public function scopePending(Builder $query): void
    {
        $query->where('status', 'pending');
    }

    /**
     * Scope for approved requests.
     *
     * @param  Builder<LeaveRequest>  $query
     */
    public function scopeApproved(Builder $query): void
    {
        $query->where('status', 'approved');
    }

    /**
     * Scope for pending HOD review.
     *
     * @param  Builder<LeaveRequest>  $query
     */
    public function scopePendingHod(Builder $query): void
    {
        $query->where('approval_stage', self::STAGE_PENDING_HOD);
    }

    /**
     * Scope for pending HR review.
     *
     * @param  Builder<LeaveRequest>  $query
     */
    public function scopePendingHr(Builder $query): void
    {
        $query->where('approval_stage', self::STAGE_PENDING_HR);
    }

    /**
     * Scope for short leave requests.
     *
     * @param  Builder<LeaveRequest>  $query
     */
    public function scopeShortLeaves(Builder $query): void
    {
        $query->where('is_short_leave', true);
    }

    /**
     * Check if request is currently waiting for HOD review.
     */
    public function isPendingHod(): bool
    {
        return $this->approval_stage === self::STAGE_PENDING_HOD;
    }

    /**
     * Check if request is currently waiting for HR review.
     */
    public function isPendingHr(): bool
    {
        return $this->approval_stage === self::STAGE_PENDING_HR;
    }

    /**
     * Scope to find overlapping leave requests for an employee.
     *
     * @param  Builder<LeaveRequest>  $query
     */
    public function scopeOverlapping(
        Builder $query,
        string $employeeId,
        CarbonInterface|string $startDate,
        CarbonInterface|string $endDate,
        ?string $excludeId = null
    ): void {
        $query->where('employee_id', $employeeId)
            ->whereIn('status', ['pending', 'approved'])
            ->where(function (Builder $sub) use ($startDate, $endDate): void {
                $sub->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function (Builder $nested) use ($startDate, $endDate): void {
                        $nested->where('start_date', '<=', $startDate)
                            ->where('end_date', '>=', $endDate);
                    });
            });

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }
    }

    /**
     * Get the employee who submitted the leave request.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Get the covering employee assigned to cover shifts/duties.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function coveringEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'covering_employee_id');
    }

    /**
     * Get the leave type for this request.
     *
     * @return BelongsTo<LeaveType, $this>
     */
    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }

    /**
     * Get the HOD user who recommended/approved or rejected at stage 1.
     *
     * @return BelongsTo<User, $this>
     */
    public function hod(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hod_id');
    }

    /**
     * Get the user who approved or rejected the request.
     *
     * @return BelongsTo<User, $this>
     */
    public function actionedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actioned_by');
    }

    /**
     * Get compensatory leave records associated with this request.
     */
    public function compensatoryRecords(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CompensatoryLeaveRecord::class, 'leave_request_id');
    }
}
