<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Shift extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'shifts';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'shift_type',
        'start_time',
        'end_time',
        'break_minutes',
        'grace_minutes',
        'ot_threshold_minutes',
        'is_night_shift',
        'in_window_before_start',
        'in_window_after_start',
        'out_window_before_end',
        'out_window_after_end',
        'first_half_end_time',
        'second_half_start_time',
        'early_in_as_ot',
        'early_in_as_att_in',
        'ot_start_time',
        'working_minutes',
        'color',
        'description',
        'is_active',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'break_minutes' => 'integer',
            'grace_minutes' => 'integer',
            'ot_threshold_minutes' => 'integer',
            'is_night_shift' => 'boolean',
            'in_window_before_start' => 'integer',
            'in_window_after_start' => 'integer',
            'out_window_before_end' => 'integer',
            'out_window_after_end' => 'integer',
            'early_in_as_ot' => 'boolean',
            'early_in_as_att_in' => 'boolean',
            'working_minutes' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Calculate net expected working duration in minutes based on start, end, and break.
     */
    public function calculateWorkingMinutes(): int
    {
        if (empty($this->start_time) || empty($this->end_time)) {
            return 0;
        }

        $startTimeStr = substr((string) $this->start_time, 0, 5);
        $endTimeStr = substr((string) $this->end_time, 0, 5);

        $start = \Carbon\Carbon::createFromFormat('H:i', $startTimeStr);
        $end = \Carbon\Carbon::createFromFormat('H:i', $endTimeStr);

        if ($this->is_night_shift || $end->lte($start)) {
            $end->addDay();
        }

        $gross = (int) abs($end->diffInMinutes($start));
        return max(0, $gross - (int) ($this->break_minutes ?? 0));
    }

    /**
     * Get the sliding punch window for check-in on a given shift date.
     *
     * @return array{0: \Carbon\Carbon, 1: \Carbon\Carbon}
     */
    public function getInWindow(\Carbon\CarbonInterface $date): array
    {
        $shiftStart = \Carbon\Carbon::parse($date->toDateString() . ' ' . $this->start_time);
        $before = $this->in_window_before_start ?? 60;
        $after = $this->in_window_after_start ?? 120;

        return [
            $shiftStart->copy()->subMinutes($before),
            $shiftStart->copy()->addMinutes($after),
        ];
    }

    /**
     * Get the sliding punch window for check-out on a given shift date.
     *
     * @return array{0: \Carbon\Carbon, 1: \Carbon\Carbon}
     */
    public function getOutWindow(\Carbon\CarbonInterface $date): array
    {
        $shiftEnd = \Carbon\Carbon::parse($date->toDateString() . ' ' . $this->end_time);
        if ($this->is_night_shift || $shiftEnd->lt(\Carbon\Carbon::parse($date->toDateString() . ' ' . $this->start_time))) {
            $shiftEnd->addDay();
        }

        $before = $this->out_window_before_end ?? 120;
        $after = $this->out_window_after_end ?? 180;

        return [
            $shiftEnd->copy()->subMinutes($before),
            $shiftEnd->copy()->addMinutes($after),
        ];
    }

    /**
     * Get the assignments for this shift.
     *
     * @return HasMany<ShiftAssignment, $this>
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(ShiftAssignment::class, 'shift_id');
    }

    /**
     * Get the employees assigned to this shift.
     *
     * @return BelongsToMany<Employee, $this>
     */
    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'shift_assignments', 'shift_id', 'employee_id')
            ->withPivot(['id', 'effective_from', 'effective_to'])
            ->withTimestamps();
    }

    /**
     * Get the roster entries scheduled for this shift.
     *
     * @return HasMany<RosterEntry, $this>
     */
    public function rosterEntries(): HasMany
    {
        return $this->hasMany(RosterEntry::class, 'shift_id');
    }
}

