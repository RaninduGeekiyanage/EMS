<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class RosterGroupMember extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'roster_group_members';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'roster_group_id',
        'employee_id',
        'start_date',
        'end_date',
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
        ];
    }

    /**
     * Parent squad group.
     *
     * @return BelongsTo<RosterGroup, $this>
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(RosterGroup::class, 'roster_group_id');
    }

    /**
     * Scope for members active on a given date.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<RosterGroupMember>  $query
     * @return \Illuminate\Database\Eloquent\Builder<RosterGroupMember>
     */
    public function scopeActiveOnDate(\Illuminate\Database\Eloquent\Builder $query, string $date): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where(function ($q) use ($date) {
            $q->whereNull('start_date')->orWhere('start_date', '<=', $date);
        })->where(function ($q) use ($date) {
            $q->whereNull('end_date')->orWhere('end_date', '>=', $date);
        });
    }

    /**
     * Scope for members active within an overlapping date range.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<RosterGroupMember>  $query
     * @return \Illuminate\Database\Eloquent\Builder<RosterGroupMember>
     */
    public function scopeOverlapping(\Illuminate\Database\Eloquent\Builder $query, string $startDate, string $endDate): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where(function ($q) use ($endDate) {
            $q->whereNull('start_date')->orWhere('start_date', '<=', $endDate);
        })->where(function ($q) use ($startDate) {
            $q->whereNull('end_date')->orWhere('end_date', '>=', $startDate);
        });
    }

    /**
     * Enrolled employee.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
