<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class EmployeePayItem extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    protected $table = 'employee_pay_items';

    protected $fillable = [
        'tenant_id',
        'employee_id',
        'pay_item_id',
        'amount',
        'effective_from',
        'effective_to',
        'is_active',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'is_active' => 'boolean',
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

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeActiveForPeriod(Builder $query, CarbonInterface $periodStart, CarbonInterface $periodEnd): Builder
    {
        return $query->where('is_active', true)
            ->where('effective_from', '<=', $periodEnd->toDateString())
            ->where(function (Builder $sub) use ($periodStart): void {
                $sub->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $periodStart->toDateString());
            });
    }
}
