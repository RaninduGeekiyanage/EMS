<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

final class Roster extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'rosters';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'department_id',
        'name',
        'code',
        'start_date',
        'end_date',
        'status',
        'published_at',
        'published_by',
        'created_by',
        'updated_by',
        'notes',
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
            'published_at' => 'datetime',
        ];
    }

    /**
     * Scope query to published rosters.
     *
     * @param  Builder<Roster>  $query
     * @return Builder<Roster>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    /**
     * Scope query for a given year and month.
     *
     * @param  Builder<Roster>  $query
     * @return Builder<Roster>
     */
    public function scopeForMonth(Builder $query, int $year, int $month): Builder
    {
        $start = sprintf('%04d-%02d-01', $year, $month);
        $end = date('Y-m-t', strtotime($start));

        return $query->where('start_date', '<=', $end)
            ->where('end_date', '>=', $start);
    }

    /**
     * Department associated with the roster (nullable).
     *
     * @return BelongsTo<Department, $this>
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /**
     * Shift squads / groups belonging to this roster.
     *
     * @return HasMany<RosterGroup, $this>
     */
    public function groups(): HasMany
    {
        return $this->hasMany(RosterGroup::class, 'roster_id')->orderBy('name');
    }

    /**
     * Daily roster entries belonging to this roster.
     *
     * @return HasMany<RosterEntry, $this>
     */
    public function entries(): HasMany
    {
        return $this->hasMany(RosterEntry::class, 'roster_id');
    }

    /**
     * Publisher user relation.
     *
     * @return BelongsTo<User, $this>
     */
    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    /**
     * Creator user relation.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
