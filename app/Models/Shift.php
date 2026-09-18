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
            'is_active' => 'boolean',
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

