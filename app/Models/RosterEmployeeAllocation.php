<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class RosterEmployeeAllocation extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'roster_employee_allocations';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'roster_id',
        'roster_pattern_id',
        'employee_id',
        'effective_from',
        'effective_to',
        'notes',
        'created_by',
        'updated_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'effective_from' => 'date:Y-m-d',
            'effective_to' => 'date:Y-m-d',
        ];
    }

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
     * Shift Rotation Pattern assigned to this allocation (nullable).
     *
     * @return BelongsTo<RosterPattern, $this>
     */
    public function pattern(): BelongsTo
    {
        return $this->belongsTo(RosterPattern::class, 'roster_pattern_id');
    }

    /**
     * Allocated Employee.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * User who created the allocation.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

