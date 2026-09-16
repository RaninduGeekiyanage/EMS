<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class LeaveEntitlement extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'leave_entitlements';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'leave_type_id',
        'year',
        'allocated_days',
        'used_days',
        'pending_days',
        'carried_forward_days',
        'notes',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'remaining_days',
        'total_entitled_days',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'allocated_days' => 'float',
            'used_days' => 'float',
            'pending_days' => 'float',
            'carried_forward_days' => 'float',
        ];
    }

    /**
     * Remaining days available for leave booking.
     */
    protected function remainingDays(): Attribute
    {
        return Attribute::make(
            get: fn (): float => round(max(0, ($this->allocated_days + $this->carried_forward_days) - ($this->used_days + $this->pending_days)), 2)
        );
    }

    /**
     * Total entitled days (allocated + carried forward).
     */
    protected function totalEntitledDays(): Attribute
    {
        return Attribute::make(
            get: fn (): float => round($this->allocated_days + $this->carried_forward_days, 2)
        );
    }

    /**
     * Get the employee who owns the entitlement.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Get the leave type for this entitlement.
     *
     * @return BelongsTo<LeaveType, $this>
     */
    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }
}
