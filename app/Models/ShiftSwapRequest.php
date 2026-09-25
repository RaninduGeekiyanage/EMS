<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class ShiftSwapRequest extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'shift_swap_requests';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'department_id',
        'requesting_employee_id',
        'target_employee_id',
        'shift_date',
        'target_date',
        'swap_type',
        'requesting_shift_id',
        'target_shift_id',
        'requesting_schedule_type',
        'target_schedule_type',
        'reason',
        'target_status',
        'status',
        'approved_by',
        'approved_at',
        'admin_notes',
        'metadata',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'shift_date' => 'date',
            'target_date' => 'date',
            'approved_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    /**
     * Get the department.
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /**
     * Get the requesting employee.
     */
    public function requestingEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'requesting_employee_id');
    }

    /**
     * Get the target employee.
     */
    public function targetEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'target_employee_id');
    }

    /**
     * Get the shift of the requesting employee.
     */
    public function requestingShift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'requesting_shift_id');
    }

    /**
     * Get the shift of the target employee.
     */
    public function targetShift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'target_shift_id');
    }

    /**
     * Get the approving user.
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
