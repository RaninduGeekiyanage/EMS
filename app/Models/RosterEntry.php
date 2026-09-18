<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class RosterEntry extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'roster_entries';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'roster_date',
        'shift_id',
        'schedule_type',
        'status',
        'is_overridden',
        'notes',
        'created_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'roster_date' => 'date:Y-m-d',
            'is_overridden' => 'boolean',
        ];
    }

    /**
     * Get the employee for this roster entry.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Get the shift assigned for this roster entry (null if rest day).
     *
     * @return BelongsTo<Shift, $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    /**
     * Get the user who created/assigned this roster entry.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope query to published entries.
     *
     * @param  Builder<RosterEntry>  $query
     * @return Builder<RosterEntry>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    /**
     * Scope query to a specific month.
     *
     * @param  Builder<RosterEntry>  $query
     * @return Builder<RosterEntry>
     */
    public function scopeForMonth(Builder $query, int $year, int $month): Builder
    {
        return $query->whereYear('roster_date', $year)->whereMonth('roster_date', $month);
    }

    /**
     * Scope query to a specific date range.
     *
     * @param  Builder<RosterEntry>  $query
     * @return Builder<RosterEntry>
     */
    public function scopeForRange(Builder $query, string $startDate, string $endDate): Builder
    {
        return $query->whereBetween('roster_date', [$startDate, $endDate]);
    }
}
