<?php

declare(strict_types=1);

namespace App\Services\Payroll;

use App\Models\Employee;
use App\Models\EmployeeLoan;
use App\Models\EmployeeLoanInstallment;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class StaffLoanService
{
    /**
     * Create a new employee staff loan or advance and generate its monthly installment schedule.
     *
     * @param array<string, mixed> $data
     */
    public function createLoan(Tenant $tenant, array $data, ?User $approvedBy = null): EmployeeLoan
    {
        $employee = Employee::where('tenant_id', $tenant->id)->findOrFail($data['employee_id']);

        $principal = round((float) ($data['principal_amount'] ?? 0.00), 2);
        if ($principal <= 0.00) {
            throw new InvalidArgumentException('Principal loan amount must be greater than zero.');
        }

        $installmentCount = max(1, (int) ($data['installment_count'] ?? 1));
        $interestRate = max(0.00, (float) ($data['interest_rate_percentage'] ?? 0.00));

        $interestAmount = round($principal * ($interestRate / 100.0), 2);
        $totalPayable = round($principal + $interestAmount, 2);

        $customInstallment = isset($data['monthly_installment']) && (float) $data['monthly_installment'] > 0
            ? round((float) $data['monthly_installment'], 2)
            : round($totalPayable / $installmentCount, 2);

        // Generate reference no if not provided
        $refNo = ! empty($data['loan_reference_no'])
            ? trim((string) $data['loan_reference_no'])
            : 'LN-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

        $disbursedAt = ! empty($data['disbursed_at'])
            ? Carbon::parse($data['disbursed_at'])->toDateString()
            : Carbon::now()->toDateString();

        $deductionStart = ! empty($data['deduction_start_month'])
            ? Carbon::parse($data['deduction_start_month'])->startOfMonth()->toDateString()
            : Carbon::parse($disbursedAt)->startOfMonth()->toDateString();

        return DB::transaction(function () use (
            $tenant,
            $employee,
            $refNo,
            $data,
            $principal,
            $interestRate,
            $totalPayable,
            $customInstallment,
            $installmentCount,
            $disbursedAt,
            $deductionStart,
            $approvedBy
        ): EmployeeLoan {
            $loan = EmployeeLoan::create([
                'tenant_id' => $tenant->id,
                'employee_id' => $employee->id,
                'loan_reference_no' => $refNo,
                'loan_title' => trim((string) ($data['loan_title'] ?? 'Staff Personal Loan')),
                'principal_amount' => $principal,
                'interest_rate_percentage' => $interestRate,
                'total_payable_amount' => $totalPayable,
                'monthly_installment' => $customInstallment,
                'installment_count' => $installmentCount,
                'disbursed_at' => $disbursedAt,
                'deduction_start_month' => $deductionStart,
                'status' => 'active',
                'total_paid_amount' => 0.00,
                'remaining_balance' => $totalPayable,
                'approved_by' => $approvedBy?->id,
                'notes' => $data['notes'] ?? null,
            ]);

            $loan->generateInstallments();

            return $loan;
        });
    }

    /**
     * Pause deductions for a loan.
     */
    public function pauseLoan(EmployeeLoan $loan): EmployeeLoan
    {
        $loan->update(['status' => 'paused']);

        return $loan->fresh();
    }

    /**
     * Resume deductions for a paused loan.
     */
    public function resumeLoan(EmployeeLoan $loan): EmployeeLoan
    {
        $loan->update(['status' => 'active']);

        return $loan->fresh();
    }

    /**
     * Cancel an active loan and void remaining scheduled installments.
     */
    public function cancelLoan(EmployeeLoan $loan): EmployeeLoan
    {
        DB::transaction(function () use ($loan): void {
            $loan->installments()->where('status', 'scheduled')->delete();
            $loan->update(['status' => 'cancelled']);
            $loan->recalculateBalance();
        });

        return $loan->fresh();
    }

    /**
     * Skip an individual monthly installment and append an installment to the end of the term.
     */
    public function skipInstallment(EmployeeLoanInstallment $installment, ?string $remarks = null): EmployeeLoanInstallment
    {
        if ($installment->status !== 'scheduled') {
            throw new InvalidArgumentException("Only scheduled installments can be skipped. Current status: {$installment->status}");
        }

        DB::transaction(function () use ($installment, $remarks): void {
            $installment->update([
                'status' => 'skipped',
                'remarks' => $remarks ?? 'Deferred/skipped by payroll admin',
            ]);

            $loan = $installment->loan;

            // Find last scheduled or latest installment
            /** @var EmployeeLoanInstallment|null $latest */
            $latest = $loan->installments()->orderByDesc('installment_number')->first();

            $nextNumber = ($latest?->installment_number ?? $loan->installment_count) + 1;
            $nextDate = $latest !== null
                ? Carbon::createFromDate($latest->due_year, $latest->due_month, 1)->addMonthNoOverflow()
                : Carbon::now()->addMonthNoOverflow();

            EmployeeLoanInstallment::create([
                'tenant_id' => $loan->tenant_id,
                'employee_loan_id' => $loan->id,
                'installment_number' => $nextNumber,
                'due_year' => $nextDate->year,
                'due_month' => $nextDate->month,
                'amount' => $installment->amount,
                'paid_amount' => 0.00,
                'status' => 'scheduled',
            ]);

            $loan->increment('installment_count');
            $loan->recalculateBalance();
        });

        return $installment->fresh();
    }

    /**
     * Mark due installments as deducted when a payroll run is committed or approved.
     */
    public function markInstallmentsDeductedForRun(PayrollRun $payrollRun): void
    {
        $year = (int) $payrollRun->period_year;
        $month = (int) $payrollRun->period_month;

        DB::transaction(function () use ($payrollRun, $year, $month): void {
            $installments = EmployeeLoanInstallment::query()
                ->where('tenant_id', $payrollRun->tenant_id)
                ->where('due_year', $year)
                ->where('due_month', $month)
                ->where('status', 'scheduled')
                ->whereHas('loan', function ($q): void {
                    $q->where('status', 'active');
                })
                ->get();

            foreach ($installments as $installment) {
                $installment->update([
                    'payroll_run_id' => $payrollRun->id,
                    'paid_amount' => $installment->amount,
                    'status' => 'deducted',
                    'deducted_at' => Carbon::now(),
                ]);

                $installment->loan->recalculateBalance();
            }
        });
    }
}
