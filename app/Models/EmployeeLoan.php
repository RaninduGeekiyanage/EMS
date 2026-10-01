<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class EmployeeLoan extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    protected $table = 'employee_loans';

    protected $fillable = [
        'tenant_id',
        'employee_id',
        'loan_reference_no',
        'loan_title',
        'principal_amount',
        'interest_rate_percentage',
        'total_payable_amount',
        'monthly_installment',
        'installment_count',
        'disbursed_at',
        'deduction_start_month',
        'status',
        'total_paid_amount',
        'remaining_balance',
        'approved_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'principal_amount' => 'decimal:2',
            'interest_rate_percentage' => 'decimal:2',
            'total_payable_amount' => 'decimal:2',
            'monthly_installment' => 'decimal:2',
            'installment_count' => 'integer',
            'disbursed_at' => 'date',
            'deduction_start_month' => 'date',
            'total_paid_amount' => 'decimal:2',
            'remaining_balance' => 'decimal:2',
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

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function installments(): HasMany
    {
        return $this->hasMany(EmployeeLoanInstallment::class, 'employee_loan_id')->orderBy('installment_number');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    /**
     * Auto-generate installment schedule starting from deduction_start_month.
     */
    public function generateInstallments(): void
    {
        // Delete any existing scheduled installments that haven't been deducted
        $this->installments()->where('status', 'scheduled')->delete();

        $startDate = Carbon::parse($this->deduction_start_month)->startOfMonth();
        $count = $this->installment_count;
        $monthlyAmount = (float) $this->monthly_installment;
        $totalPayable = (float) $this->total_payable_amount;
        $allocatedTotal = 0.00;

        for ($i = 1; $i <= $count; $i++) {
            $installmentDate = $startDate->copy()->addMonthsNoOverflow($i - 1);
            
            // Adjust last installment for any rounding differences
            if ($i === $count) {
                $installmentAmount = round($totalPayable - $allocatedTotal, 2);
            } else {
                $installmentAmount = $monthlyAmount;
                $allocatedTotal += $installmentAmount;
            }

            EmployeeLoanInstallment::create([
                'tenant_id' => $this->tenant_id,
                'employee_loan_id' => $this->id,
                'installment_number' => $i,
                'due_year' => $installmentDate->year,
                'due_month' => $installmentDate->month,
                'amount' => $installmentAmount,
                'paid_amount' => 0.00,
                'status' => 'scheduled',
            ]);
        }
    }

    /**
     * Recalculate total paid amount and remaining balance based on installments.
     */
    public function recalculateBalance(): void
    {
        $paid = (float) $this->installments()->whereIn('status', ['deducted', 'partially_paid'])->sum('paid_amount');
        $totalPayable = (float) $this->total_payable_amount;
        $remaining = max(0.00, round($totalPayable - $paid, 2));

        $this->total_paid_amount = $paid;
        $this->remaining_balance = $remaining;

        if ($remaining <= 0.00 && $this->status === 'active') {
            $this->status = 'completed';
        }

        $this->save();
    }
}
