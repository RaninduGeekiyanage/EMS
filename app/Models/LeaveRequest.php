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
        'reason',
        'status',
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
            'start_date' => 'date',
            'end_date' => 'date',
            'days_count' => 'float',
            'is_half_day' => 'boolean',
            'actioned_at' => 'datetime',
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
     * Get the leave type for this request.
     *
     * @return BelongsTo<LeaveType, $this>
     */
    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
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
}
