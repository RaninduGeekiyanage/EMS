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

final class AttendanceRegularizationRequest extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    public const STATUS_PENDING_HOD = 'pending_hod';
    public const STATUS_PENDING_HR = 'pending_hr';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    public const TYPE_MISSING_PUNCH = 'missing_punch';
    public const TYPE_UNAPPROVED_HALF_DAY = 'unapproved_half_day';
    public const TYPE_ON_DUTY_GATE_PASS = 'on_duty_gate_pass';
    public const TYPE_OVERTIME_CLAIM = 'overtime_claim';

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'attendance_regularization_requests';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'attendance_date',
        'request_type',
        'requested_check_in',
        'requested_check_out',
        'reason',
        'attachment_path',
        'status',
        'hod_id',
        'hod_actioned_at',
        'hod_remarks',
        'hr_id',
        'hr_actioned_at',
        'is_bypassed_by_hr',
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
            'attendance_date' => 'date:Y-m-d',
            'requested_check_in' => 'datetime:Y-m-d H:i:s',
            'requested_check_out' => 'datetime:Y-m-d H:i:s',
            'hod_actioned_at' => 'datetime:Y-m-d H:i:s',
            'hr_actioned_at' => 'datetime:Y-m-d H:i:s',
            'is_bypassed_by_hr' => 'boolean',
        ];
    }

    /**
     * Scope for pending HOD review.
     *
     * @param  Builder<AttendanceRegularizationRequest>  $query
     */
    public function scopePendingHod(Builder $query): void
    {
        $query->where('status', self::STATUS_PENDING_HOD);
    }

    /**
     * Scope for pending HR review/confirmation.
     *
     * @param  Builder<AttendanceRegularizationRequest>  $query
     */
    public function scopePendingHr(Builder $query): void
    {
        $query->where('status', self::STATUS_PENDING_HR);
    }

    /**
     * Scope for approved requests.
     *
     * @param  Builder<AttendanceRegularizationRequest>  $query
     */
    public function scopeApproved(Builder $query): void
    {
        $query->where('status', self::STATUS_APPROVED);
    }

    /**
     * Scope for rejected requests.
     *
     * @param  Builder<AttendanceRegularizationRequest>  $query
     */
    public function scopeRejected(Builder $query): void
    {
        $query->where('status', self::STATUS_REJECTED);
    }

    /**
     * Scope for requests within a date range.
     *
     * @param  Builder<AttendanceRegularizationRequest>  $query
     */
    public function scopeForDateRange(Builder $query, CarbonInterface|string $startDate, CarbonInterface|string $endDate): void
    {
        $query->whereBetween('attendance_date', [$startDate, $endDate]);
    }

    /**
     * Scope for requests by employee.
     *
     * @param  Builder<AttendanceRegularizationRequest>  $query
     */
    public function scopeForEmployee(Builder $query, string $employeeId): void
    {
        $query->where('employee_id', $employeeId);
    }

    /**
     * Get the employee associated with this request.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Get the HOD user who actioned this request.
     *
     * @return BelongsTo<User, $this>
     */
    public function hod(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hod_id');
    }

    /**
     * Get the HR user who actioned/bypassed this request.
     *
     * @return BelongsTo<User, $this>
     */
    public function hr(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hr_id');
    }

    /**
     * Get the tenant that this request belongs to.
     *
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Whether the request is awaiting HOD action.
     */
    public function isPendingHod(): bool
    {
        return $this->status === self::STATUS_PENDING_HOD;
    }

    /**
     * Whether the request is awaiting HR action.
     */
    public function isPendingHr(): bool
    {
        return $this->status === self::STATUS_PENDING_HR;
    }

    /**
     * Whether the request is finalized and approved.
     */
    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    /**
     * Whether the request is rejected.
     */
    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    /**
     * Whether an HOD is eligible to action this request.
     */
    public function canBeActionedByHod(): bool
    {
        return $this->status === self::STATUS_PENDING_HOD;
    }

    /**
     * Whether an HR user is eligible to action or bypass this request.
     */
    public function canBeActionedByHr(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING_HOD, self::STATUS_PENDING_HR], true);
    }
}
