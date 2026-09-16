<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class LeaveType extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'leave_types';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'days_per_year',
        'is_paid',
        'carry_forward_allowed',
        'max_carry_forward_days',
        'max_consecutive_days',
        'requires_attachment',
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
            'days_per_year' => 'float',
            'is_paid' => 'boolean',
            'carry_forward_allowed' => 'boolean',
            'max_carry_forward_days' => 'float',
            'max_consecutive_days' => 'integer',
            'requires_attachment' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get the entitlements for this leave type.
     *
     * @return HasMany<LeaveEntitlement, $this>
     */
    public function entitlements(): HasMany
    {
        return $this->hasMany(LeaveEntitlement::class, 'leave_type_id');
    }

    /**
     * Get the requests for this leave type.
     *
     * @return HasMany<LeaveRequest, $this>
     */
    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class, 'leave_type_id');
    }
}
