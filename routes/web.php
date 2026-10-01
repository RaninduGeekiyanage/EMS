<?php

declare(strict_types=1);

use App\Http\Controllers\AccessControlController;
use App\Http\Controllers\AttendanceAnomalyController;
use App\Http\Controllers\AttendanceDailyController;
use App\Http\Controllers\AttendanceImportController;
use App\Http\Controllers\AttendanceLogController;
use App\Http\Controllers\AttendanceRegularizationController;
use App\Http\Controllers\AttendanceSettingsController;
use App\Http\Controllers\AttendanceTimesheetController;
use App\Http\Controllers\BiometricDeviceProfileController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\BankExportController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\CustomReportController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\PayItemController;
use App\Http\Controllers\PayrollAdjustmentController;
use App\Http\Controllers\PayrollRunController;
use App\Http\Controllers\PayslipController;
use App\Http\Controllers\StaffLoanController;
use App\Http\Controllers\RawBiometricIngestController;
use App\Http\Controllers\RosterController;
use App\Http\Controllers\RosterExportController;
use App\Http\Controllers\RosterPatternController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\ShiftSwapController;
use App\Http\Controllers\SuperAdmin\AccessControlController as SuperAdminAccessControlController;
use App\Http\Controllers\SuperAdmin\CompanyController as SuperAdminCompanyController;
use App\Http\Controllers\UserAccountController;
use App\Http\Controllers\WorkCalendarController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Landing / Welcome Page
Route::get('/', function () {
    return Inertia::render('Welcome');
});

// Guest Authentication Routes
Route::middleware(['guest'])->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);

    Route::get('/forgot-password', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('password.email');

    Route::get('/reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('password.update');
});

// Super Admin Platform Routes
Route::middleware(['auth'])->prefix('admin')->name('admin.')->group(function (): void {
    Route::get('/dashboard', [SuperAdminCompanyController::class, 'index'])->name('dashboard');
    Route::post('/companies', [SuperAdminCompanyController::class, 'store'])->name('companies.store');
    Route::post('/companies/{tenant}/reset-admin-password', [SuperAdminCompanyController::class, 'resetAdminPassword'])->name('companies.reset-password');
    Route::post('/users/{user}/reset-password', [SuperAdminCompanyController::class, 'resetUserPassword'])->name('users.reset-password');
    Route::post('/companies/{tenant}/toggle-status', [SuperAdminCompanyController::class, 'toggleStatus'])->name('companies.toggle-status');
    Route::post('/companies/{tenant}/toggle-module/{module}', [SuperAdminCompanyController::class, 'toggleModule'])->name('companies.toggle-module');
    Route::post('/companies/{tenant}/impersonate', [SuperAdminCompanyController::class, 'impersonate'])->name('companies.impersonate');
    Route::post('/impersonate/exit', [SuperAdminCompanyController::class, 'exitImpersonation'])->name('impersonate.exit');

    // Access Control Management (Super Admin)
    Route::get('/access-control', [SuperAdminAccessControlController::class, 'index'])->name('access-control.index');
    Route::put('/access-control/{tenant}/users/{user}', [SuperAdminAccessControlController::class, 'update'])->name('access-control.update');
    Route::post('/access-control/{tenant}/users/{user}/reset', [SuperAdminAccessControlController::class, 'resetToRole'])->name('access-control.reset');
});

// Authenticated Session & Dashboard Routes
Route::middleware(['auth'])->group(function (): void {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware(['tenant'])->name('dashboard');
});

// Tenant Scoped Routes
Route::middleware(['tenant'])->group(function (): void {
    // M00 Access Control & Permissions
    Route::middleware(['auth'])->group(function (): void {
        Route::get('/access-control', [AccessControlController::class, 'index'])->name('access-control.index');
        Route::put('/access-control/users/{user}', [AccessControlController::class, 'update'])->name('access-control.update');
        Route::post('/access-control/users/{user}/reset', [AccessControlController::class, 'resetToRole'])->name('access-control.reset');
    });

    // M01 Company Profile
    Route::get('/company/profile', [CompanyController::class, 'profile'])->name('company.profile');
    Route::put('/company/{company}', [CompanyController::class, 'update'])->name('company.update');

    // M01 User Accounts Management
    Route::get('/users', [UserAccountController::class, 'index'])->name('users.index');
    Route::post('/users', [UserAccountController::class, 'store'])->name('users.store');
    Route::put('/users/{user}', [UserAccountController::class, 'update'])->name('users.update');
    Route::delete('/users/{user}', [UserAccountController::class, 'destroy'])->name('users.destroy');
    Route::post('/users/{user}/reset-password', [UserAccountController::class, 'resetPassword'])->name('users.reset-password');

    // M01 Branches
    Route::post('/branches', [BranchController::class, 'store'])->name('branches.store');
    Route::put('/branches/{branch}', [BranchController::class, 'update'])->name('branches.update');
    Route::delete('/branches/{branch}', [BranchController::class, 'destroy'])->name('branches.destroy');

    // M01 Departments & Leadership (HOD)
    Route::get('/departments', [DepartmentController::class, 'index'])->name('departments.index');
    Route::post('/departments', [DepartmentController::class, 'store'])->name('departments.store');
    Route::put('/departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
    Route::delete('/departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy');
    Route::post('/departments/{department}/hod', [DepartmentController::class, 'assignHod'])->name('departments.hod.assign');
    Route::delete('/departments/{department}/hod', [DepartmentController::class, 'removeHod'])->name('departments.hod.remove');

    // M01 Employees
    Route::get('/employees', [EmployeeController::class, 'index'])->name('employees.index');
    Route::get('/employees/create', [EmployeeController::class, 'create'])->name('employees.create');
    Route::post('/employees', [EmployeeController::class, 'store'])->name('employees.store');
    Route::get('/employees/{employee}/edit', [EmployeeController::class, 'edit'])->name('employees.edit');
    Route::put('/employees/{employee}', [EmployeeController::class, 'update'])->name('employees.update');
    Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy'])->name('employees.destroy');

    // M02 Attendance Management System (Protected by module flag)
    Route::middleware(['module:ams'])->group(function (): void {
        // Shifts Management
        Route::get('/shifts', [ShiftController::class, 'index'])->name('shifts.index');
        Route::post('/shifts', [ShiftController::class, 'store'])->name('shifts.store');
        Route::put('/shifts/{shift}', [ShiftController::class, 'update'])->name('shifts.update');
        Route::delete('/shifts/{shift}', [ShiftController::class, 'destroy'])->name('shifts.destroy');
        Route::post('/shifts/seed-presets', [ShiftController::class, 'seedPresets'])->name('shifts.seed-presets');
        Route::post('/shifts/assign', [ShiftController::class, 'assign'])->name('shifts.assign');
        Route::delete('/shifts/assignments/{assignment}', [ShiftController::class, 'removeAssignment'])->name('shifts.assignments.destroy');

        // Duty Roster Management
        Route::get('/roster', [RosterController::class, 'index'])->middleware('can:roster.view')->name('roster.index');
        Route::get('/roster/export', [RosterExportController::class, 'export'])->middleware('can:roster.view')->name('roster.export');
        Route::post('/roster/generate', [RosterController::class, 'generate'])->middleware('can:roster.create')->name('roster.generate');
        Route::post('/roster/entry', [RosterController::class, 'updateEntry'])->middleware('can:roster.update')->name('roster.entry.update');
        Route::post('/roster/extend', [RosterController::class, 'extend'])->middleware('can:roster.update')->name('roster.extend');
        Route::post('/roster/publish', [RosterController::class, 'publish'])->middleware('can:roster.publish')->name('roster.publish');
        Route::delete('/roster/clear', [RosterController::class, 'clear'])->middleware('can:roster.delete')->name('roster.clear');

        // Named Rosters Management
        Route::post('/roster/rosters', [RosterController::class, 'storeRoster'])->middleware('can:roster.create')->name('roster.rosters.store');
        Route::put('/roster/rosters/{roster}', [RosterController::class, 'updateRoster'])->middleware('can:roster.update')->name('roster.rosters.update');
        Route::delete('/roster/rosters/{roster}', [RosterController::class, 'destroyRoster'])->middleware('can:roster.delete')->name('roster.rosters.destroy');
        Route::post('/roster/rosters/{roster}/publish', [RosterController::class, 'publishNamedRoster'])->middleware('can:roster.publish')->name('roster.rosters.publish');
        Route::post('/roster/rosters/{roster}/archive', [RosterController::class, 'archiveRoster'])->middleware('can:roster.update')->name('roster.rosters.archive');
        Route::post('/roster/rosters/{roster}/clone', [RosterController::class, 'cloneRoster'])->middleware('can:roster.create')->name('roster.rosters.clone');
        Route::post('/roster/rosters/{roster}/allocations', [RosterController::class, 'storeAllocation'])->middleware('can:roster.update')->name('roster.allocations.store');
        Route::delete('/roster/rosters/{roster}/allocations', [RosterController::class, 'removeAllocation'])->middleware('can:roster.update')->name('roster.allocations.destroy');
        Route::post('/roster/rosters/{roster}/transfer', [RosterController::class, 'transferRoster'])->middleware('can:roster.update')->name('roster.transfer');

        // Departmentalized Shift Swap Requests
        Route::get('/roster/shift-swaps', [ShiftSwapController::class, 'index'])->middleware('can:shift_swap.view')->name('roster.shift-swaps.index');
        Route::post('/roster/shift-swaps/preview', [ShiftSwapController::class, 'preview'])->middleware('can:shift_swap.view')->name('roster.shift-swaps.preview');
        Route::post('/roster/shift-swaps', [ShiftSwapController::class, 'store'])->middleware('can:shift_swap.request')->name('roster.shift-swaps.store');
        Route::post('/roster/shift-swaps/{swap}/approve', [ShiftSwapController::class, 'approve'])->name('roster.shift-swaps.approve');
        Route::post('/roster/shift-swaps/{swap}/reject', [ShiftSwapController::class, 'reject'])->name('roster.shift-swaps.reject');

        // Shift Groups & Roster Patterns Library (Pure Reusable Templates)
        Route::get('/roster/patterns', [RosterPatternController::class, 'index'])->middleware('can:roster.view')->name('roster.patterns.index');
        Route::post('/roster/patterns', [RosterPatternController::class, 'store'])->middleware('can:roster.create')->name('roster.patterns.store');
        Route::put('/roster/patterns/{pattern}', [RosterPatternController::class, 'update'])->middleware('can:roster.update')->name('roster.patterns.update');
        Route::delete('/roster/patterns/{pattern}', [RosterPatternController::class, 'destroy'])->middleware('can:roster.delete')->name('roster.patterns.destroy');

        // Work Calendar & Public Holidays
        Route::get('/work-calendar', [WorkCalendarController::class, 'index'])->name('work-calendar.index');
        Route::post('/work-calendar/holidays', [WorkCalendarController::class, 'storeHoliday'])->name('work-calendar.holidays.store');
        Route::put('/work-calendar/holidays/{holiday}', [WorkCalendarController::class, 'updateHoliday'])->name('work-calendar.holidays.update');
        Route::delete('/work-calendar/holidays/{holiday}', [WorkCalendarController::class, 'destroyHoliday'])->name('work-calendar.holidays.destroy');
        Route::post('/work-calendar/seed-holidays', [WorkCalendarController::class, 'seedHolidays'])->name('work-calendar.holidays.seed');

        // Biometric Attendance Ingestion & Device Profiles
        Route::get('/attendance/import', [AttendanceImportController::class, 'index'])->name('attendance.import.index');
        Route::post('/attendance/import/preview', [AttendanceImportController::class, 'preview'])->name('attendance.import.preview');
        Route::post('/attendance/import/staging-preview', [AttendanceImportController::class, 'previewStaging'])->name('attendance.import.staging-preview');
        Route::post('/attendance/import/staging-commit', [AttendanceImportController::class, 'commitStaging'])->name('attendance.import.staging-commit');
        Route::post('/attendance/import/staging-retry', [AttendanceImportController::class, 'retryFailedStaging'])->name('attendance.import.staging-retry');
        Route::post('/attendance/import', [AttendanceImportController::class, 'store'])->name('attendance.import.store');
        Route::delete('/attendance/import/{import}', [AttendanceImportController::class, 'destroy'])->name('attendance.import.destroy');
        Route::get('/attendance/import/template/{type}', [AttendanceImportController::class, 'downloadTemplate'])->name('attendance.import.template');
        Route::post('/attendance/import/map-employee', [AttendanceImportController::class, 'mapEmployee'])->name('attendance.import.map-employee');

        // Configurable Biometric Device Profiles & System Settings
        Route::get('/settings/biometric', [BiometricDeviceProfileController::class, 'settingsPage'])->middleware('can:biometric-device.view')->name('settings.biometric.index');
        Route::post('/settings/biometric/default', [BiometricDeviceProfileController::class, 'setDefault'])->middleware('can:biometric-device.manage')->name('settings.biometric.default');
        Route::get('/biometric-devices', [BiometricDeviceProfileController::class, 'index'])->name('biometric-devices.index');
        Route::post('/biometric-devices/test-parse', [BiometricDeviceProfileController::class, 'testParse'])->name('biometric-devices.test-parse');
        Route::post('/biometric-devices/test-db-query', [BiometricDeviceProfileController::class, 'testDbQuery'])->name('biometric-devices.test-db-query');
        Route::middleware('can:biometric-device.manage')->group(function () {
            Route::post('/biometric-devices', [BiometricDeviceProfileController::class, 'store'])->name('biometric-devices.store');
            Route::put('/biometric-devices/{profile}', [BiometricDeviceProfileController::class, 'update'])->name('biometric-devices.update');
            Route::delete('/biometric-devices/{profile}', [BiometricDeviceProfileController::class, 'destroy'])->name('biometric-devices.destroy');
        });

        // Attendance Calculation Policy & Telemetry Settings
        Route::get('/settings/attendance', [AttendanceSettingsController::class, 'index'])->middleware('can:attendance.settings.view')->name('settings.attendance.index');
        Route::post('/settings/attendance', [AttendanceSettingsController::class, 'update'])->middleware('can:attendance.settings.manage')->name('settings.attendance.update');


        // Attendance Daily Ledger & Overtime Engine
        Route::get('/attendance/daily', [AttendanceDailyController::class, 'index'])->name('attendance.daily.index');
        Route::post('/attendance/daily/process', [AttendanceDailyController::class, 'process'])->name('attendance.daily.process');
        Route::post('/attendance/daily/process-date', [AttendanceDailyController::class, 'processSingleDate'])->name('attendance.daily.process-date');
        Route::post('/attendance/daily/process-backlog', [AttendanceDailyController::class, 'processBacklog'])->name('attendance.daily.process-backlog');
        Route::put('/attendance/daily/{attendanceDaily}', [AttendanceDailyController::class, 'update'])->name('attendance.daily.update');
        Route::post('/attendance/daily/adjust', [AttendanceDailyController::class, 'adjust'])->name('attendance.daily.adjust');
        Route::post('/attendance/rules', [AttendanceDailyController::class, 'saveRule'])->name('attendance.rules.store');

        // Dedicated Employee Monthly Timesheet & Audit Matrix
        Route::get('/attendance/timesheet', [AttendanceTimesheetController::class, 'index'])->name('attendance.timesheet.index');
        Route::get('/attendance/timesheet/export', [AttendanceTimesheetController::class, 'exportCsv'])->name('attendance.timesheet.export');

        // Biometric Raw Logs & Engine Audit Ledger
        Route::get('/attendance/logs', [AttendanceLogController::class, 'index'])->name('attendance.logs.index');
        Route::get('/attendance/logs/export/excel', [AttendanceLogController::class, 'exportExcel'])->name('attendance.logs.export.excel');
        Route::get('/attendance/logs/export/pdf', [AttendanceLogController::class, 'exportPdf'])->name('attendance.logs.export.pdf');

        // M04: Attendance Regularizations, Exceptions Action Center & Overtime Approvals
        Route::get('/attendance/regularizations', [AttendanceRegularizationController::class, 'index'])->name('attendance.regularizations.index');
        Route::post('/attendance/regularizations', [AttendanceRegularizationController::class, 'store'])->name('attendance.regularizations.store');
        Route::post('/attendance/regularizations/{regularization}/hod-action', [AttendanceRegularizationController::class, 'hodAction'])->name('attendance.regularizations.hod-action');
        Route::post('/attendance/regularizations/{regularization}/hr-action', [AttendanceRegularizationController::class, 'hrAction'])->name('attendance.regularizations.hr-action');

        Route::get('/attendance/anomalies', [AttendanceAnomalyController::class, 'index'])->name('attendance.anomalies.index');
        Route::post('/attendance/daily/{attendanceDaily}/approve-ot', [AttendanceAnomalyController::class, 'approveOt'])->name('attendance.daily.approve-ot');
        Route::post('/attendance/daily/{attendanceDaily}/resolve-anomaly', [AttendanceAnomalyController::class, 'resolveAnomaly'])->name('attendance.daily.resolve-anomaly');
        Route::post('/attendance/timesheet/freeze', [AttendanceAnomalyController::class, 'freezePeriod'])->name('attendance.timesheet.freeze');

        // Leave Management & Statutory Entitlements
        Route::get('/leave/requests', [LeaveRequestController::class, 'index'])->name('leave.requests.index');
        Route::post('/leave/requests', [LeaveRequestController::class, 'store'])->name('leave.requests.store');
        Route::post('/leave/requests/{leaveRequest}/hod-action', [LeaveRequestController::class, 'hodAction'])->name('leave.requests.hod-action');
        Route::post('/leave/requests/{leaveRequest}/approve', [LeaveRequestController::class, 'approve'])->name('leave.requests.approve');
        Route::post('/leave/requests/{leaveRequest}/reject', [LeaveRequestController::class, 'reject'])->name('leave.requests.reject');
        Route::delete('/leave/requests/{leaveRequest}', [LeaveRequestController::class, 'cancel'])->name('leave.requests.cancel');
        Route::post('/leave/types', [LeaveRequestController::class, 'storeType'])->name('leave.types.store');
        Route::post('/leave/types/seed-statutory', [LeaveRequestController::class, 'seedStatutoryTypes'])->name('leave.types.seed-statutory');
        Route::post('/leave/entitlements/allocate', [LeaveRequestController::class, 'allocateEntitlements'])->name('leave.entitlements.allocate');
        Route::post('/leave/compensatory/credit', [LeaveRequestController::class, 'creditCompensatory'])->name('leave.compensatory.credit');

        // Dynamic Custom HR Report Builder
        Route::get('/reports/custom', [CustomReportController::class, 'index'])->name('reports.custom.index');
        Route::get('/reports/custom/csv', [CustomReportController::class, 'exportCsv'])->name('reports.custom.csv');
        Route::get('/reports/custom/pdf', [CustomReportController::class, 'exportPdf'])->name('reports.custom.pdf');
    });

    // M03 Payroll & Statutory Compliance (Protected by module:payroll)
    Route::middleware(['module:payroll'])->group(function (): void {
        Route::get('/payroll', [PayrollRunController::class, 'index'])->name('payroll.index');
        Route::post('/payroll/preview', [PayrollRunController::class, 'preview'])->name('payroll.preview');
        Route::post('/payroll/runs', [PayrollRunController::class, 'store'])->name('payroll.store');
        Route::post('/payroll/settings', [PayrollRunController::class, 'updateSettings'])->name('payroll.settings.update');

        // M04-P08: Dynamic Pay Items Master & Recurring Allocations
        Route::get('/payroll/pay-items', [PayItemController::class, 'index'])->name('payroll.pay-items.index');
        Route::post('/payroll/pay-items', [PayItemController::class, 'store'])->name('payroll.pay-items.store');
        Route::put('/payroll/pay-items/{payItem}', [PayItemController::class, 'update'])->name('payroll.pay-items.update');
        Route::delete('/payroll/pay-items/{payItem}', [PayItemController::class, 'destroy'])->name('payroll.pay-items.destroy');
        Route::post('/payroll/pay-items/seed-statutory', [PayItemController::class, 'seedStatutory'])->name('payroll.pay-items.seed-statutory');
        Route::post('/payroll/pay-items/assign-employee', [PayItemController::class, 'assignEmployee'])->name('payroll.pay-items.assign-employee');
        Route::delete('/payroll/pay-items/employee-items/{employeePayItem}', [PayItemController::class, 'removeEmployeeItem'])->name('payroll.pay-items.remove-employee');

        // M04-P09: Staff Loans & Salary Advances Ledger
        Route::get('/payroll/loans', [StaffLoanController::class, 'index'])->name('payroll.loans.index');
        Route::post('/payroll/loans', [StaffLoanController::class, 'store'])->name('payroll.loans.store');
        Route::post('/payroll/loans/{loan}/pause', [StaffLoanController::class, 'pause'])->name('payroll.loans.pause');
        Route::post('/payroll/loans/{loan}/resume', [StaffLoanController::class, 'resume'])->name('payroll.loans.resume');
        Route::post('/payroll/loans/{loan}/cancel', [StaffLoanController::class, 'cancel'])->name('payroll.loans.cancel');
        Route::post('/payroll/loans/installments/{installment}/skip', [StaffLoanController::class, 'skipInstallment'])->name('payroll.loans.skip-installment');

        // M04-P10: Monthly Variable Inputs & Ad-hoc Adjustments
        Route::get('/payroll/variable-inputs', [PayrollAdjustmentController::class, 'index'])->name('payroll.variable-inputs.index');
        Route::post('/payroll/variable-inputs', [PayrollAdjustmentController::class, 'store'])->name('payroll.variable-inputs.store');
        Route::post('/payroll/variable-inputs/bulk', [PayrollAdjustmentController::class, 'bulkStore'])->name('payroll.variable-inputs.bulk');
        Route::post('/payroll/variable-inputs/{adjustment}/approve', [PayrollAdjustmentController::class, 'approve'])->name('payroll.variable-inputs.approve');
        Route::delete('/payroll/variable-inputs/{adjustment}', [PayrollAdjustmentController::class, 'destroy'])->name('payroll.variable-inputs.destroy');

        // Phase 3: Payslips & Bank Disbursals
        Route::get('/payroll/employees/{payrollEmployee}/payslip/download', [PayslipController::class, 'download'])->name('payroll.payslip.download');
        Route::get('/payroll/employees/{payrollEmployee}/payslip/stream', [PayslipController::class, 'stream'])->name('payroll.payslip.stream');
        Route::get('/payroll/{payrollRun}/payslips/bulk', [PayslipController::class, 'bulk'])->name('payroll.payslips.bulk');
        Route::get('/payroll/{payrollRun}/bank-export', [BankExportController::class, 'export'])->name('payroll.bank-export');
        Route::get('/payroll/{payrollRun}/bank-export/banks', [BankExportController::class, 'banks'])->name('payroll.bank-export.banks');

        // Parameterized Run Routes (Must be after static /payroll/* routes)
        Route::get('/payroll/{payrollRun}', [PayrollRunController::class, 'show'])->name('payroll.show');
        Route::post('/payroll/{payrollRun}/approve', [PayrollRunController::class, 'approve'])->name('payroll.approve');
        Route::post('/payroll/{payrollRun}/lock', [PayrollRunController::class, 'lock'])->name('payroll.lock');
        Route::post('/payroll/{payrollRun}/recalculate', [PayrollRunController::class, 'recalculate'])->name('payroll.recalculate');
        Route::delete('/payroll/{payrollRun}', [PayrollRunController::class, 'destroy'])->name('payroll.destroy');
    });
});

// Direct Hardware Biometric Ingestion API (Daemons, ADMS, IoT Webhooks)
Route::post('/api/biometric/ingest', [RawBiometricIngestController::class, 'ingest'])->name('api.biometric.ingest');
Route::get('/api/biometric/ping', [RawBiometricIngestController::class, 'ping'])->name('api.biometric.ping');


