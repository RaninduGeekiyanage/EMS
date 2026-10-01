<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\StoreEmployeeLoanRequest;
use App\Models\Employee;
use App\Models\EmployeeLoan;
use App\Models\EmployeeLoanInstallment;
use App\Models\Tenant;
use App\Services\Payroll\StaffLoanService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class StaffLoanController extends Controller
{
    public function __construct(
        private readonly StaffLoanService $loanService
    ) {}

    /**
     * Display Staff Loans & Salary Advances Ledger.
     */
    public function index(Request $request): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null) {
            abort(404, 'Tenant context not found.');
        }

        $now = Carbon::now();
        $currentYear = $now->year;
        $currentMonth = $now->month;

        $loans = EmployeeLoan::query()
            ->where('tenant_id', $tenant->id)
            ->with(['employee.department', 'approver', 'installments'])
            ->orderByDesc('created_at')
            ->get();

        $employees = Employee::query()
            ->where('tenant_id', $tenant->id)
            ->where('employment_status', 'active')
            ->with('department')
            ->orderBy('emp_no')
            ->get(['id', 'emp_no', 'full_name', 'department_id']);

        $dueThisMonth = (float) EmployeeLoanInstallment::query()
            ->where('tenant_id', $tenant->id)
            ->where('due_year', $currentYear)
            ->where('due_month', $currentMonth)
            ->where('status', 'scheduled')
            ->whereHas('loan', function ($q): void {
                $q->where('status', 'active');
            })
            ->sum('amount');

        $metrics = [
            'total_loans' => $loans->count(),
            'active_loans' => $loans->where('status', 'active')->count(),
            'total_principal' => (float) $loans->sum('principal_amount'),
            'total_repaid' => (float) $loans->sum('total_paid_amount'),
            'outstanding_balance' => (float) $loans->sum('remaining_balance'),
            'due_this_month' => $dueThisMonth,
        ];

        return Inertia::render('Payroll/Loans', [
            'loans' => $loans,
            'employees' => $employees,
            'metrics' => $metrics,
            'currentPeriod' => [
                'year' => $currentYear,
                'month' => $currentMonth,
                'label' => $now->format('F Y'),
            ],
        ]);
    }

    /**
     * Create a new employee loan and auto-generate installment schedule.
     */
    public function store(StoreEmployeeLoanRequest $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = $this->resolveTenant($request);
        $loan = $this->loanService->createLoan($tenant, $request->validated(), $request->user());

        return back()->with('success', "Staff loan '{$loan->loan_reference_no}' created and installment schedule generated.");
    }

    /**
     * Pause deductions for a loan.
     */
    public function pause(EmployeeLoan $loan, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($loan->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized loan access.');
        }

        $this->loanService->pauseLoan($loan);

        return back()->with('success', "Loan '{$loan->loan_reference_no}' paused.");
    }

    /**
     * Resume deductions for a loan.
     */
    public function resume(EmployeeLoan $loan, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($loan->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized loan access.');
        }

        $this->loanService->resumeLoan($loan);

        return back()->with('success', "Loan '{$loan->loan_reference_no}' resumed.");
    }

    /**
     * Cancel an active loan and void remaining scheduled installments.
     */
    public function cancel(EmployeeLoan $loan, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($loan->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized loan access.');
        }

        $this->loanService->cancelLoan($loan);

        return back()->with('success', "Loan '{$loan->loan_reference_no}' cancelled.");
    }

    /**
     * Skip an individual monthly installment and append an installment to the end of term.
     */
    public function skipInstallment(EmployeeLoanInstallment $installment, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($installment->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized installment access.');
        }

        $remarks = $request->input('remarks');
        $this->loanService->skipInstallment($installment, is_string($remarks) ? $remarks : null);

        return back()->with('success', 'Installment skipped and deferred to the end of schedule.');
    }

    private function resolveTenant(Request $request): ?Tenant
    {
        if (app()->bound('current_tenant')) {
            return app('current_tenant');
        }

        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        if ($tenantId !== null) {
            return Tenant::find($tenantId);
        }

        return $request->user()?->tenant;
    }
}
