<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class RosterGroup extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'roster_groups';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'roster_id',
        'roster_pattern_id',
        'name',
        'code',
        'color',
        'description',
    ];

    /**
     * Parent Roster.
     *
     * @return BelongsTo<Roster, $this>
     */
    public function roster(): BelongsTo
    {
        return $this->belongsTo(Roster::class, 'roster_id');
    }

    /**
     * Associated rotation pattern blueprint.
     *
     * @return BelongsTo<RosterPattern, $this>
     */
    public function pattern(): BelongsTo
    {
        return $this->belongsTo(RosterPattern::class, 'roster_pattern_id');
    }

    /**
     * Squad membership enrollment records.
     *
     * @return HasMany<RosterGroupMember, $this>
     */
    public function memberEnrollments(): HasMany
    {
        return $this->hasMany(RosterGroupMember::class, 'roster_group_id');
    }

    /**
     * Employees actively enrolled in this squad.
     *
     * @return BelongsToMany<Employee, $this>
     */
    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'roster_group_members', 'roster_group_id', 'employee_id')
            ->withPivot(['id', 'start_date', 'end_date'])
            ->withTimestamps();
    }

    /**
     * Daily roster entries assigned to this squad.
     *
     * @return HasMany<RosterEntry, $this>
     */
    public function entries(): HasMany
    {
        return $this->hasMany(RosterEntry::class, 'roster_group_id');
    }
}
