<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class PayrollMonthlyAdjustment extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    protected $table = 'payroll_monthly_adjustments';

    protected $fillable = [
        'tenant_id',
        'employee_id',
        'pay_item_id',
        'period_year',
        'period_month',
        'entry_type',
        'title',
        'amount',
        'is_epf_eligible',
        'is_etf_eligible',
        'is_taxable',
        'status',
        'remarks',
        'created_by',
        'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'period_year' => 'integer',
            'period_month' => 'integer',
            'amount' => 'decimal:2',
            'is_epf_eligible' => 'boolean',
            'is_etf_eligible' => 'boolean',
            'is_taxable' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function payItem(): BelongsTo
    {
        return $this->belongsTo(PayItem::class, 'pay_item_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function scopeForPeriod(Builder $query, int $year, int $month): Builder
    {
        return $query->where('period_year', $year)->where('period_month', $month);
    }

    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', 'approved');
    }

    public function scopeAdditions(Builder $query): Builder
    {
        return $query->where('entry_type', 'addition');
    }

    public function scopeDeductions(Builder $query): Builder
    {
        return $query->where('entry_type', 'deduction');
    }
}
