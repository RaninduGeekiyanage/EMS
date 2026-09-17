<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ApitTaxSlab;
use App\Models\AttendanceDaily;
use App\Models\Employee;
use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class PayrollCalculationService
{
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

        // 1. Tenant configuration
        $isCompanyEpfEnabled = (bool) $tenant->getSetting('epf_enabled', true);
        $epfEmployeeRate = (float) $tenant->getSetting('epf_employee_rate', 8.00);
        $epfEmployerRate = (float) $tenant->getSetting('epf_employer_rate', 12.00);
        $etfEmployerRate = (float) $tenant->getSetting('etf_employer_rate', 3.00);
        $shopOfficeNoPayDivisor = (float) $tenant->getSetting('shop_office_nopay_divisor', 30.00);
        $wagesBoardNoPayDivisor = (float) $tenant->getSetting('wages_board_nopay_divisor', 26.00);

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
                wagesBoardNoPayDivisor: $wagesBoardNoPayDivisor
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
    private function calculateEmployeePayroll(
        Employee $employee,
        Carbon $startDate,
        Carbon $endDate,
        bool $isCompanyEpfEnabled,
        float $epfEmployeeRate,
        float $epfEmployerRate,
        float $etfEmployerRate,
        float $shopOfficeNoPayDivisor,
        float $wagesBoardNoPayDivisor
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

        // Attendance metrics from M02 AttendanceDaily
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
                if (in_array($status, ['present', 'holiday', 'rest_day', 'leave'], true)) {
                    $workedDays += 1.00;
                } elseif ($status === 'half_day') {
                    $workedDays += 0.50;
                    $noPayDays += 0.50;
                } elseif ($status === 'absent') {
                    $noPayDays += 1.00;
                }

                $otHours += (float) $log->ot_hours;
                $doubleOtHours += (float) $log->double_ot_hours;
                $totalWorkedHours += (float) $log->worked_hours;
            }
        } else {
            // Default fallback if no daily logs exist: assume standard working days
            $totalDaysInMonth = $startDate->daysInMonth;
            if ($paymentMode === 'monthly') {
                $workedDays = 26.00;
                $noPayDays = 0.00;
            } else {
                $workedDays = 0.00;
                $noPayDays = 0.00;
            }
        }

        // 3. Compensation calculation
        $otPay = round(($hourlyRate * 1.5 * $otHours) + ($hourlyRate * 2.0 * $doubleOtHours), 2);
        $allowances = 0.00;
        $noPayDeduction = 0.00;
        $earnedBasic = 0.00;

        if ($paymentMode === 'monthly') {
            $divisor = $laborAct === 'wages_board' ? $wagesBoardNoPayDivisor : $shopOfficeNoPayDivisor;
            if ($noPayDays > 0 && $divisor > 0) {
                $noPayDeduction = round(($basicSalary / $divisor) * $noPayDays, 2);
            }
            $earnedBasic = max(0.00, round($basicSalary - $noPayDeduction, 2));
            $grossPay = round($earnedBasic + $otPay + $allowances, 2);
            $epfEligibleEarnings = $earnedBasic;
        } elseif ($paymentMode === 'daily') {
            $earnedBasic = round($dailyRate * $workedDays, 2);
            $grossPay = round($earnedBasic + $otPay + $allowances, 2);
            $epfEligibleEarnings = $earnedBasic;
            $basicSalary = $dailyRate; // Store daily rate as baseline basic
        } else {
            // Hourly mode
            $regularHours = max(0.00, $totalWorkedHours - ($otHours + $doubleOtHours));
            $earnedBasic = round($hourlyRate * $regularHours, 2);
            $grossPay = round($earnedBasic + $otPay + $allowances, 2);
            $epfEligibleEarnings = $earnedBasic;
            $basicSalary = $hourlyRate;
        }

        // 4. Statutory EPF & ETF
        $isEmployeeEpfMember = (bool) ($epfInfo?->is_epf_member ?? true);
        $isEpfEligible = $isCompanyEpfEnabled && $isEmployeeEpfMember;

        $epfEmployee = 0.00;
        $epfEmployer = 0.00;
        $etfEmployer = 0.00;

        if ($isEpfEligible && $epfEligibleEarnings > 0.00) {
            $epfEmployee = round($epfEligibleEarnings * ($epfEmployeeRate / 100.0), 2);
            $epfEmployer = round($epfEligibleEarnings * ($epfEmployerRate / 100.0), 2);
            $etfEmployer = round($grossPay * ($etfEmployerRate / 100.0), 2);
        }

        // 5. APIT Tax
        $taxCalculation = ApitTaxSlab::calculateMonthlyTax($grossPay, $employee->tenant_id);
        $apitTax = (float) $taxCalculation['total_tax'];

        // 6. Deductions and Net Pay
        $otherDeductions = 0.00;
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
            'earnings' => [
                'earned_basic' => $earnedBasic,
                'ot_pay' => $otPay,
                'allowances' => $allowances,
                'no_pay_deduction' => $noPayDeduction,
                'gross_pay' => $grossPay,
            ],
            'statutory' => [
                'is_company_epf_enabled' => $isCompanyEpfEnabled,
                'is_employee_epf_member' => $isEmployeeEpfMember,
                'is_epf_eligible' => $isEpfEligible,
                'epf_eligible_earnings' => $epfEligibleEarnings,
                'epf_employee_rate' => $epfEmployeeRate,
                'epf_employee' => $epfEmployee,
                'epf_employer_rate' => $epfEmployerRate,
                'epf_employer' => $epfEmployer,
                'etf_employer_rate' => $etfEmployerRate,
                'etf_employer' => $etfEmployer,
            ],
            'tax' => [
                'apit_tax' => $apitTax,
                'annual_projected_income' => $taxCalculation['annual_income'],
                'slabs' => $taxCalculation['slab_details'],
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
            'allowances' => $allowances,
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
