<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\Employee;
use App\Models\EmployeeLoanInstallment;
use App\Models\EmployeePayItem;
use App\Models\PayrollEmployee;
use App\Models\PayrollMonthlyAdjustment;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Payroll\StaffLoanService;
use App\Services\Statutory\ApitTaxCalculatorService;
use App\Services\Statutory\EpfEtfCalculatorService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class PayrollCalculationService
{
    private EpfEtfCalculatorService $epfEtfCalculator;
    private ApitTaxCalculatorService $apitTaxCalculator;
    private StaffLoanService $loanService;

    public function __construct(
        ?EpfEtfCalculatorService $epfEtfCalculator = null,
        ?ApitTaxCalculatorService $apitTaxCalculator = null,
        ?StaffLoanService $loanService = null
    ) {
        $this->epfEtfCalculator = $epfEtfCalculator ?? new EpfEtfCalculatorService();
        $this->apitTaxCalculator = $apitTaxCalculator ?? new ApitTaxCalculatorService();
        $this->loanService = $loanService ?? new StaffLoanService();
    }

    /**
     * Preview or execute a full monthly payroll run for a tenant.
     *
     * @return array{run: PayrollRun|null, summary: array<string, mixed>, employees: array<int, array<string, mixed>>}
     */
    public function processPayroll(
        Tenant $tenant,
        int $year,
        int $month,
        ?User $runByUser = null,
        bool $isDryRun = false,
        ?string $notes = null
    ): array {
        if ($month < 1 || $month > 12) {
            throw new InvalidArgumentException("Invalid period month: {$month}. Must be between 1 and 12.");
        }

        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = Carbon::createFromDate($year, $month, 1)->endOfMonth();

        // 1. Tenant configuration & dynamic parameters
        $isCompanyEpfEnabled = (bool) $tenant->getSetting('epf_enabled', true);
        $epfEmployeeRate = (float) $tenant->getSetting('epf_employee_rate', 8.00);
        $epfEmployerRate = (float) $tenant->getSetting('epf_employer_rate', 12.00);
        $etfEmployerRate = (float) $tenant->getSetting('etf_employer_rate', 3.00);
        $shopOfficeNoPayDivisor = (float) $tenant->getSetting('shop_office_nopay_divisor', 30.00);
        $wagesBoardNoPayDivisor = (float) $tenant->getSetting('wages_board_nopay_divisor', 26.00);

        // M04 Dynamic Overtime Multipliers & Approvals
        $otRateSingle = (float) $tenant->getSetting('payroll_ot_rate_single', 1.50);
        $otRateDouble = (float) $tenant->getSetting('payroll_ot_rate_double', 2.00);
        $requireApprovedOt = (bool) $tenant->getSetting('payroll_require_approved_ot', false);

        // 2. Active employees
        $employees = Employee::query()
            ->where('tenant_id', $tenant->id)
            ->where('employment_status', 'active')
            ->with(['paymentInfo', 'epfInfo', 'department', 'designation.wagesBoardCategory'])
            ->orderBy('emp_no')
            ->get();

        $processedEmployees = [];
        $totalGross = 0.00;
        $totalNet = 0.00;
        $totalEpfEmployee = 0.00;
        $totalEpfEmployer = 0.00;
        $totalEtf = 0.00;
        $totalApit = 0.00;
        $totalDeductions = 0.00;

        foreach ($employees as $employee) {
            $calc = $this->calculateEmployeePayroll(
                employee: $employee,
                startDate: $startDate,
                endDate: $endDate,
                isCompanyEpfEnabled: $isCompanyEpfEnabled,
                epfEmployeeRate: $epfEmployeeRate,
                epfEmployerRate: $epfEmployerRate,
                etfEmployerRate: $etfEmployerRate,
                shopOfficeNoPayDivisor: $shopOfficeNoPayDivisor,
                wagesBoardNoPayDivisor: $wagesBoardNoPayDivisor,
                otRateSingle: $otRateSingle,
                otRateDouble: $otRateDouble,
                requireApprovedOt: $requireApprovedOt
            );

            $processedEmployees[] = $calc;
            $totalGross += $calc['gross_pay'];
            $totalNet += $calc['net_pay'];
            $totalEpfEmployee += $calc['epf_employee'];
            $totalEpfEmployer += $calc['epf_employer'];
            $totalEtf += $calc['etf_employer'];
            $totalApit += $calc['apit_tax'];
            $totalDeductions += ($calc['epf_employee'] + $calc['apit_tax'] + $calc['other_deductions']);
        }

        $summary = [
            'period_year' => $year,
            'period_month' => $month,
            'period_label' => $startDate->format('F Y'),
            'employee_count' => count($processedEmployees),
            'total_gross' => round($totalGross, 2),
            'total_net' => round($totalNet, 2),
            'total_epf_employee' => round($totalEpfEmployee, 2),
            'total_epf_employer' => round($totalEpfEmployer, 2),
            'total_etf' => round($totalEtf, 2),
            'total_apit' => round($totalApit, 2),
            'total_deductions' => round($totalDeductions, 2),
            'is_epf_enabled' => $isCompanyEpfEnabled,
        ];

        if ($isDryRun) {
            return [
                'run' => null,
                'summary' => $summary,
                'employees' => $processedEmployees,
            ];
        }

        // Persist to database
        $payrollRun = DB::transaction(function () use (
            $tenant,
            $year,
            $month,
            $runByUser,
            $summary,
            $processedEmployees,
            $notes
        ): PayrollRun {
            /** @var PayrollRun|null $existing */
            $existing = PayrollRun::query()
                ->where('tenant_id', $tenant->id)
                ->where('period_year', $year)
                ->where('period_month', $month)
                ->first();

            if ($existing !== null && $existing->isLocked()) {
                throw new InvalidArgumentException("Payroll for {$summary['period_label']} is locked and cannot be recalculated.");
            }

            if ($existing !== null) {
                // Delete previous employee calculations for this run
                $existing->payrollEmployees()->forceDelete();
                $payrollRun = $existing;
            } else {
                $payrollRun = new PayrollRun();
                $payrollRun->tenant_id = $tenant->id;
                $payrollRun->period_year = $year;
                $payrollRun->period_month = $month;
            }

            $payrollRun->status = 'draft';
            $payrollRun->total_gross = $summary['total_gross'];
            $payrollRun->total_net = $summary['total_net'];
            $payrollRun->total_epf_employee = $summary['total_epf_employee'];
            $payrollRun->total_epf_employer = $summary['total_epf_employer'];
            $payrollRun->total_etf = $summary['total_etf'];
            $payrollRun->total_apit = $summary['total_apit'];
            $payrollRun->total_deductions = $summary['total_deductions'];
            $payrollRun->employee_count = $summary['employee_count'];
            $payrollRun->run_by = $runByUser?->id;
            $payrollRun->notes = $notes;
            $payrollRun->save();

            foreach ($processedEmployees as $empData) {
                $record = new PayrollEmployee();
                $record->tenant_id = $tenant->id;
                $record->payroll_run_id = $payrollRun->id;
                $record->employee_id = $empData['employee_id'];
                $record->payment_mode = $empData['payment_mode'];
                $record->employment_type = $empData['employment_type'];
                $record->labor_act = $empData['labor_act'];
                $record->wages_board_category_id = $empData['wages_board_category_id'];
                $record->is_epf_eligible = $empData['is_epf_eligible'];
                $record->worked_days = $empData['worked_days'];
                $record->no_pay_days = $empData['no_pay_days'];
                $record->ot_hours = $empData['ot_hours'];
                $record->double_ot_hours = $empData['double_ot_hours'];
                $record->basic_salary = $empData['basic_salary'];
                $record->hourly_rate = $empData['hourly_rate'];
                $record->ot_pay = $empData['ot_pay'];
                $record->allowances = $empData['allowances'];
                $record->no_pay_deduction = $empData['no_pay_deduction'];
                $record->gross_pay = $empData['gross_pay'];
                $record->epf_eligible_earnings = $empData['epf_eligible_earnings'];
                $record->epf_employee = $empData['epf_employee'];
                $record->epf_employer = $empData['epf_employer'];
                $record->etf_employer = $empData['etf_employer'];
                $record->apit_tax = $empData['apit_tax'];
                $record->other_deductions = $empData['other_deductions'];
                $record->net_pay = $empData['net_pay'];
                $record->breakdown_json = $empData['breakdown'];
                $record->save();
            }

            // Deduct scheduled loan installments for this payroll period
            $this->loanService->markInstallmentsDeductedForRun($payrollRun);

            // Mark monthly variable adjustments as processed
            PayrollMonthlyAdjustment::query()
                ->where('tenant_id', $tenant->id)
                ->where('period_year', $year)
                ->where('period_month', $month)
                ->where('status', 'approved')
                ->update(['status' => 'processed']);

            return $payrollRun;
        });

        return [
            'run' => $payrollRun,
            'summary' => $summary,
            'employees' => $processedEmployees,
        ];
    }

    /**
     * Compute payroll line items for an individual employee.
     *
     * @return array<string, mixed>
     */
    public function calculateEmployeePayroll(
        Employee $employee,
        Carbon $startDate,
        Carbon $endDate,
        bool $isCompanyEpfEnabled = true,
        float $epfEmployeeRate = 0.08,
        float $epfEmployerRate = 0.12,
        float $etfEmployerRate = 0.03,
        float $shopOfficeNoPayDivisor = 30.0,
        float $wagesBoardNoPayDivisor = 26.0,
        float $otRateSingle = 1.50,
        float $otRateDouble = 2.00,
        bool $requireApprovedOt = false
    ): array {
        $paymentInfo = $employee->paymentInfo;
        $epfInfo = $employee->epfInfo;
        $designation = $employee->designation;

        $paymentMode = $paymentInfo?->payment_mode?->value ?? ($paymentInfo?->payment_mode ?? 'monthly');
        $employmentType = $employee->employment_type?->value ?? ($employee->employment_type ?? 'permanent');

        // Labor Act Framework: Wages Board vs Shop & Office
        $wagesBoardCategory = $designation?->wagesBoardCategory;
        $laborAct = $wagesBoardCategory !== null ? 'wages_board' : 'shop_and_office';

        // Base wage numbers
        $basicSalary = (float) ($paymentInfo?->basic_salary ?? 0.00);
        $dailyRate = (float) ($paymentInfo?->daily_rate ?? 0.00);
        $contractHourlyRate = (float) ($paymentInfo?->hourly_rate ?? 0.00);

        // Derive standard hourly rate
        if ($paymentMode === 'monthly') {
            $hourlyRate = $contractHourlyRate > 0.0 ? $contractHourlyRate : round($basicSalary / 200.0, 2);
        } elseif ($paymentMode === 'daily') {
            $hourlyRate = $contractHourlyRate > 0.0 ? $contractHourlyRate : round($dailyRate / 8.0, 2);
        } else {
            $hourlyRate = $contractHourlyRate;
        }

        // Attendance metrics from M02/M04 AttendanceDaily
        $attendanceLogs = AttendanceDaily::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->get();

        $workedDays = 0.00;
        $noPayDays = 0.00;
        $otHours = 0.00;
        $doubleOtHours = 0.00;
        $totalWorkedHours = 0.00;

        if ($attendanceLogs->isNotEmpty()) {
            foreach ($attendanceLogs as $log) {
                $status = (string) $log->status;
                $breakdown = is_array($log->calculation_breakdown) ? $log->calculation_breakdown : [];
                $isPaid = $breakdown['is_paid'] ?? true;
                $isScheduledHalfDay = $breakdown['is_scheduled_half_day'] ?? false;

                if ($status === 'leave') {
                    if ($isPaid) {
                        $workedDays += 1.00;
                    } else {
                        $noPayDays += 1.00;
                    }
                } elseif (in_array($status, ['present', 'holiday', 'rest_day'], true)) {
                    $workedDays += 1.00;
                } elseif ($status === 'half_day') {
                    if ($isScheduledHalfDay || $isPaid) {
                        $workedDays += 1.00;
                    } else {
                        $workedDays += 0.50;
                        $noPayDays += 0.50;
                    }
                } elseif ($status === 'absent') {
                    $noPayDays += 1.00;
                }

                // M04-P07: Dynamic OT calculation supporting approved OT hours
                if ($requireApprovedOt) {
                    $dayOt = $log->approved_ot_hours !== null
                        ? (float) $log->approved_ot_hours
                        : ($log->ot_approval_status === 'rejected' ? 0.00 : 0.00);

                    $dayDoubleOt = $log->approved_double_ot_hours !== null
                        ? (float) $log->approved_double_ot_hours
                        : ($log->ot_approval_status === 'rejected' ? 0.00 : 0.00);
                } else {
                    $dayOt = $log->approved_ot_hours !== null
                        ? (float) $log->approved_ot_hours
                        : ($log->ot_approval_status === 'rejected' ? 0.00 : (float) $log->ot_hours);

                    $dayDoubleOt = $log->approved_double_ot_hours !== null
                        ? (float) $log->approved_double_ot_hours
                        : ($log->ot_approval_status === 'rejected' ? 0.00 : (float) $log->double_ot_hours);
                }

                $otHours += $dayOt;
                $doubleOtHours += $dayDoubleOt;
                $totalWorkedHours += (float) $log->worked_hours;
            }
        } else {
            // Default fallback if no daily logs exist
            if ($paymentMode === 'monthly') {
                $workedDays = 26.00;
                $noPayDays = 0.00;
            } else {
                $workedDays = 0.00;
                $noPayDays = 0.00;
            }
        }

        // 3. Dynamic Overtime Pay
        $otPay = round(($hourlyRate * $otRateSingle * $otHours) + ($hourlyRate * $otRateDouble * $doubleOtHours), 2);

        // 4. M04-P01/P02: Recurring Employee Pay Items
        $recurringPayItems = EmployeePayItem::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('employee_id', $employee->id)
            ->activeForPeriod($startDate, $endDate)
            ->with('payItem')
            ->get();

        $recurringEarningsTotal = 0.00;
        $recurringEpfEarnings = 0.00;
        $recurringTaxableEarnings = 0.00;
        $recurringNonTaxableEarnings = 0.00;
        $recurringDeductionsTotal = 0.00;
        $payItemsBreakdown = [];

        foreach ($recurringPayItems as $empPayItem) {
            $payItem = $empPayItem->payItem;
            if ($payItem === null) {
                continue;
            }

            $amount = (float) $empPayItem->amount;
            if ($payItem->calculation_type === 'percentage_of_basic' && $payItem->percentage !== null) {
                $amount = round($basicSalary * ((float) $payItem->percentage / 100.0), 2);
            }

            if ($payItem->item_type === 'earning') {
                $recurringEarningsTotal += $amount;
                if ($payItem->is_epf_eligible) {
                    $recurringEpfEarnings += $amount;
                }
                if ($payItem->is_taxable) {
                    $recurringTaxableEarnings += $amount;
                } else {
                    $recurringNonTaxableEarnings += $amount;
                }

                $payItemsBreakdown[] = [
                    'id' => $empPayItem->id,
                    'code' => $payItem->code,
                    'name' => $payItem->name,
                    'type' => 'earning',
                    'amount' => $amount,
                    'is_epf' => $payItem->is_epf_eligible,
                    'is_taxable' => $payItem->is_taxable,
                ];
            } elseif ($payItem->item_type === 'deduction') {
                $recurringDeductionsTotal += $amount;
                $payItemsBreakdown[] = [
                    'id' => $empPayItem->id,
                    'code' => $payItem->code,
                    'name' => $payItem->name,
                    'type' => 'deduction',
                    'amount' => $amount,
                ];
            }
        }

        // 5. M04-P05: Monthly Variable Adjustments
        $variableAdjustments = PayrollMonthlyAdjustment::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('employee_id', $employee->id)
            ->where('period_year', $startDate->year)
            ->where('period_month', $startDate->month)
            ->whereIn('status', ['approved', 'processed'])
            ->get();

        $variableAdditionsTotal = 0.00;
        $variableEpfAdditions = 0.00;
        $variableTaxableAdditions = 0.00;
        $variableNonTaxableAdditions = 0.00;
        $variableDeductionsTotal = 0.00;
        $adjustmentsBreakdown = [];

        foreach ($variableAdjustments as $adj) {
            $adjAmount = (float) $adj->amount;
            if ($adj->entry_type === 'addition') {
                $variableAdditionsTotal += $adjAmount;
                if ($adj->is_epf_eligible) {
                    $variableEpfAdditions += $adjAmount;
                }
                if ($adj->is_taxable) {
                    $variableTaxableAdditions += $adjAmount;
                } else {
                    $variableNonTaxableAdditions += $adjAmount;
                }

                $adjustmentsBreakdown[] = [
                    'id' => $adj->id,
                    'title' => $adj->title,
                    'type' => 'addition',
                    'amount' => $adjAmount,
                    'is_epf' => $adj->is_epf_eligible,
                    'is_taxable' => $adj->is_taxable,
                ];
            } elseif ($adj->entry_type === 'deduction') {
                $variableDeductionsTotal += $adjAmount;
                $adjustmentsBreakdown[] = [
                    'id' => $adj->id,
                    'title' => $adj->title,
                    'type' => 'deduction',
                    'amount' => $adjAmount,
                ];
            }
        }

        // 6. M04-P04: Active Staff Loan Installments
        $loanInstallments = EmployeeLoanInstallment::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('due_year', $startDate->year)
            ->where('due_month', $startDate->month)
            ->whereIn('status', ['scheduled', 'deducted'])
            ->whereHas('loan', function ($q) use ($employee): void {
                $q->where('employee_id', $employee->id)
                    ->whereIn('status', ['active', 'completed']);
            })
            ->with('loan')
            ->get();

        $loanDeductionsTotal = 0.00;
        $loansBreakdown = [];

        foreach ($loanInstallments as $inst) {
            $instAmount = (float) $inst->amount;
            $loanDeductionsTotal += $instAmount;
            $loansBreakdown[] = [
                'id' => $inst->id,
                'loan_reference_no' => $inst->loan?->loan_reference_no,
                'loan_title' => $inst->loan?->loan_title,
                'installment_number' => $inst->installment_number,
                'installment_count' => $inst->loan?->installment_count,
                'amount' => $instAmount,
            ];
        }

        // Aggregate allowances
        $totalAllowances = round($recurringEarningsTotal + $variableAdditionsTotal, 2);
        $noPayDeduction = 0.00;
        $earnedBasic = 0.00;

        if ($paymentMode === 'monthly') {
            $divisor = $laborAct === 'wages_board' ? $wagesBoardNoPayDivisor : $shopOfficeNoPayDivisor;
            if ($noPayDays > 0 && $divisor > 0) {
                $noPayDeduction = round(($basicSalary / $divisor) * $noPayDays, 2);
            }
            $earnedBasic = max(0.00, round($basicSalary - $noPayDeduction, 2));
            $grossPay = round($earnedBasic + $otPay + $totalAllowances, 2);
            $epfEligibleEarnings = round($earnedBasic + $recurringEpfEarnings + $variableEpfAdditions, 2);
        } elseif ($paymentMode === 'daily') {
            $earnedBasic = round($dailyRate * $workedDays, 2);
            $grossPay = round($earnedBasic + $otPay + $totalAllowances, 2);
            $epfEligibleEarnings = round($earnedBasic + $recurringEpfEarnings + $variableEpfAdditions, 2);
            $basicSalary = $dailyRate;
        } else {
            // Hourly mode
            $regularHours = max(0.00, $totalWorkedHours - ($otHours + $doubleOtHours));
            $earnedBasic = round($hourlyRate * $regularHours, 2);
            $grossPay = round($earnedBasic + $otPay + $totalAllowances, 2);
            $epfEligibleEarnings = round($earnedBasic + $recurringEpfEarnings + $variableEpfAdditions, 2);
            $basicSalary = $hourlyRate;
        }

        // 7. Statutory EPF & ETF
        $isEmployeeEpfMember = (bool) ($epfInfo?->is_epf_member ?? true);
        $statutory = $this->epfEtfCalculator->calculate(
            epfEligibleEarnings: $epfEligibleEarnings,
            grossPay: $grossPay,
            isCompanyEpfEnabled: $isCompanyEpfEnabled,
            isEmployeeEpfMember: $isEmployeeEpfMember,
            employeeRateOverride: $epfEmployeeRate,
            employerEpfRateOverride: $epfEmployerRate,
            etfRateOverride: $etfEmployerRate
        );

        $isEpfEligible = $statutory['is_epf_eligible'];
        $epfEmployee = $statutory['epf_employee'];
        $epfEmployer = $statutory['epf_employer'];
        $etfEmployer = $statutory['etf_employer'];

        // 8. APIT Tax
        $nonTaxableTotal = $recurringNonTaxableEarnings + $variableNonTaxableAdditions;
        $taxableGross = max(0.00, round($grossPay - $nonTaxableTotal, 2));
        $taxCalculation = $this->apitTaxCalculator->calculateMonthlyTax($taxableGross, $employee->tenant_id);
        $apitTax = (float) $taxCalculation['total_tax'];

        // 9. Total Deductions and Net Pay
        $otherDeductions = round($recurringDeductionsTotal + $variableDeductionsTotal + $loanDeductionsTotal, 2);
        $totalEmployeeDeductions = round($epfEmployee + $apitTax + $otherDeductions, 2);
        $netPay = max(0.00, round($grossPay - $totalEmployeeDeductions, 2));

        $breakdown = [
            'emp_no' => $employee->emp_no,
            'full_name' => $employee->full_name,
            'payment_mode' => $paymentMode,
            'employment_type' => $employmentType,
            'labor_act' => $laborAct,
            'wages_board_category' => $wagesBoardCategory?->name,
            'wage_basis' => [
                'basic_salary' => $basicSalary,
                'daily_rate' => $dailyRate,
                'hourly_rate' => $hourlyRate,
                'earned_basic' => $earnedBasic,
            ],
            'attendance' => [
                'worked_days' => $workedDays,
                'no_pay_days' => $noPayDays,
                'ot_hours' => $otHours,
                'double_ot_hours' => $doubleOtHours,
                'total_worked_hours' => $totalWorkedHours,
            ],
            'overtime' => [
                'single_hours' => $otHours,
                'single_multiplier' => $otRateSingle,
                'double_hours' => $doubleOtHours,
                'double_multiplier' => $otRateDouble,
                'ot_pay' => $otPay,
            ],
            'earnings' => [
                'earned_basic' => $earnedBasic,
                'ot_pay' => $otPay,
                'allowances' => $totalAllowances,
                'recurring_earnings' => $recurringEarningsTotal,
                'variable_additions' => $variableAdditionsTotal,
                'no_pay_deduction' => $noPayDeduction,
                'gross_pay' => $grossPay,
            ],
            'pay_items' => $payItemsBreakdown,
            'adjustments' => $adjustmentsBreakdown,
            'loans' => $loansBreakdown,
            'statutory' => [
                'is_company_epf_enabled' => $statutory['is_company_epf_enabled'],
                'is_employee_epf_member' => $statutory['is_employee_epf_member'],
                'is_epf_eligible' => $statutory['is_epf_eligible'],
                'epf_eligible_earnings' => $statutory['epf_eligible_earnings'],
                'epf_employee_rate' => $statutory['epf_employee_rate'],
                'epf_employee' => $statutory['epf_employee'],
                'epf_employer_rate' => $statutory['epf_employer_rate'],
                'epf_employer' => $statutory['epf_employer'],
                'total_epf' => $statutory['total_epf'],
                'etf_employer_rate' => $statutory['etf_employer_rate'],
                'etf_employer' => $statutory['etf_employer'],
                'total_statutory' => $statutory['total_statutory'],
            ],
            'tax' => [
                'taxable_gross' => $taxableGross,
                'apit_tax' => $apitTax,
                'annual_projected_income' => $taxCalculation['annual_income'],
                'effective_tax_rate' => $taxCalculation['effective_tax_rate'],
                'slabs' => $taxCalculation['slab_details'],
            ],
            'deductions' => [
                'epf_employee' => $epfEmployee,
                'apit_tax' => $apitTax,
                'recurring_deductions' => $recurringDeductionsTotal,
                'variable_deductions' => $variableDeductionsTotal,
                'loan_deductions' => $loanDeductionsTotal,
                'other_deductions' => $otherDeductions,
                'total_deductions' => $totalEmployeeDeductions,
            ],
            'net_payout' => $netPay,
        ];

        return [
            'employee_id' => $employee->id,
            'emp_no' => $employee->emp_no,
            'full_name' => $employee->full_name,
            'department' => $employee->department?->name ?? 'General',
            'payment_mode' => $paymentMode,
            'employment_type' => $employmentType,
            'labor_act' => $laborAct,
            'wages_board_category_id' => $wagesBoardCategory?->id,
            'is_epf_eligible' => $isEpfEligible,
            'worked_days' => $workedDays,
            'no_pay_days' => $noPayDays,
            'ot_hours' => $otHours,
            'double_ot_hours' => $doubleOtHours,
            'basic_salary' => $basicSalary,
            'hourly_rate' => $hourlyRate,
            'ot_pay' => $otPay,
            'allowances' => $totalAllowances,
            'no_pay_deduction' => $noPayDeduction,
            'gross_pay' => $grossPay,
            'epf_eligible_earnings' => $epfEligibleEarnings,
            'epf_employee' => $epfEmployee,
            'epf_employer' => $epfEmployer,
            'etf_employer' => $etfEmployer,
            'apit_tax' => $apitTax,
            'other_deductions' => $otherDeductions,
            'net_pay' => $netPay,
            'breakdown' => $breakdown,
        ];
    }
}
