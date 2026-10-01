<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class EmployeeLoanInstallment extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    protected $table = 'employee_loan_installments';

    protected $fillable = [
        'tenant_id',
        'employee_loan_id',
        'payroll_run_id',
        'installment_number',
        'due_year',
        'due_month',
        'amount',
        'paid_amount',
        'status',
        'deducted_at',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'installment_number' => 'integer',
            'due_year' => 'integer',
            'due_month' => 'integer',
            'amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'deducted_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(EmployeeLoan::class, 'employee_loan_id');
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function scopeScheduledForPeriod(Builder $query, int $year, int $month): Builder
    {
        return $query->where('due_year', $year)
            ->where('due_month', $month)
            ->where('status', 'scheduled');
    }
}
