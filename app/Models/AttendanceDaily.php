<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AttendanceDaily extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'attendance_daily';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'attendance_date',
        'shift_id',
        'check_in',
        'check_out',
        'worked_hours',
        'regular_hours',
        'late_minutes',
        'early_departure_minutes',
        'ot_hours',
        'double_ot_hours',
        'status',
        'is_manual',
        'manual_reason',
        'manual_edited_by',
        'calculation_breakdown',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'check_in' => 'datetime',
            'check_out' => 'datetime',
            'worked_hours' => 'float',
            'regular_hours' => 'float',
            'late_minutes' => 'integer',
            'early_departure_minutes' => 'integer',
            'ot_hours' => 'float',
            'double_ot_hours' => 'float',
            'is_manual' => 'boolean',
            'calculation_breakdown' => 'array',
        ];
    }

    /**
     * Get the employee for this attendance record.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Get the assigned shift for this attendance record.
     *
     * @return BelongsTo<Shift, $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    /**
     * Get the user who manually adjusted this attendance record.
     *
     * @return BelongsTo<User, $this>
     */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manual_edited_by');
    }
}
