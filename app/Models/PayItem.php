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
use Illuminate\Database\Eloquent\SoftDeletes;

final class PayItem extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    protected $table = 'pay_items';

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'item_type',
        'calculation_type',
        'default_amount',
        'percentage',
        'is_epf_eligible',
        'is_etf_eligible',
        'is_taxable',
        'is_active',
        'is_system_reserved',
        'display_order',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'default_amount' => 'decimal:2',
            'percentage' => 'decimal:2',
            'is_epf_eligible' => 'boolean',
            'is_etf_eligible' => 'boolean',
            'is_taxable' => 'boolean',
            'is_active' => 'boolean',
            'is_system_reserved' => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function employeePayItems(): HasMany
    {
        return $this->hasMany(EmployeePayItem::class, 'pay_item_id');
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(PayrollMonthlyAdjustment::class, 'pay_item_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeEarnings(Builder $query): Builder
    {
        return $query->where('item_type', 'earning');
    }

    public function scopeDeductions(Builder $query): Builder
    {
        return $query->where('item_type', 'deduction');
    }

    public function scopeEpfEligible(Builder $query): Builder
    {
        return $query->where('is_epf_eligible', true);
    }
}
