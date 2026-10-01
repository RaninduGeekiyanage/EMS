<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class CompensatoryLeaveRecord extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    public const STATUS_AVAILABLE = 'available';
    public const STATUS_USED = 'used';
    public const STATUS_EXPIRED = 'expired';

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'compensatory_leave_records';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'earned_date',
        'earned_days',
        'used_days',
        'remaining_days',
        'expires_at',
        'status',
        'reason',
        'created_by',
        'leave_request_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'earned_date' => 'date:Y-m-d',
            'expires_at' => 'date:Y-m-d',
            'earned_days' => 'float',
            'used_days' => 'float',
            'remaining_days' => 'float',
        ];
    }

    /**
     * Scope to find available, non-expired compensatory records.
     *
     * @param  Builder<CompensatoryLeaveRecord>  $query
     */
    public function scopeAvailable(Builder $query, CarbonInterface|string|null $asOfDate = null): void
    {
        $date = $asOfDate ? Carbon::parse($asOfDate)->toDateString() : Carbon::today()->toDateString();

        $query->where('status', self::STATUS_AVAILABLE)
            ->where('remaining_days', '>', 0)
            ->where('expires_at', '>=', $date);
    }

    /**
     * Scope for a specific employee.
     *
     * @param  Builder<CompensatoryLeaveRecord>  $query
     */
    public function scopeForEmployee(Builder $query, string $employeeId): void
    {
        $query->where('employee_id', $employeeId);
    }

    /**
     * Get the employee who earned this compensatory record.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Get the user who granted or recorded this compensatory record.
     *
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the leave request where this record was redeemed.
     *
     * @return BelongsTo<LeaveRequest, $this>
     */
    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class, 'leave_request_id');
    }
}
