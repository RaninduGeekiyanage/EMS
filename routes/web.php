<?php

declare(strict_types=1);

use App\Http\Controllers\AttendanceDailyController;
use App\Http\Controllers\AttendanceImportController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\WorkCalendarController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome');
});

Route::middleware(['tenant'])->group(function (): void {
    // Company Profile
    Route::get('/company/profile', [CompanyController::class, 'profile'])->name('company.profile');
    Route::put('/company/{company}', [CompanyController::class, 'update'])->name('company.update');

    // Branches
    Route::post('/branches', [BranchController::class, 'store'])->name('branches.store');
    Route::put('/branches/{branch}', [BranchController::class, 'update'])->name('branches.update');
    Route::delete('/branches/{branch}', [BranchController::class, 'destroy'])->name('branches.destroy');

    // Departments
    Route::get('/departments', [DepartmentController::class, 'index'])->name('departments.index');
    Route::post('/departments', [DepartmentController::class, 'store'])->name('departments.store');
    Route::put('/departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
    Route::delete('/departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy');

    // Employees
    Route::get('/employees', [EmployeeController::class, 'index'])->name('employees.index');
    Route::get('/employees/create', [EmployeeController::class, 'create'])->name('employees.create');
    Route::post('/employees', [EmployeeController::class, 'store'])->name('employees.store');
    Route::get('/employees/{employee}/edit', [EmployeeController::class, 'edit'])->name('employees.edit');
    Route::put('/employees/{employee}', [EmployeeController::class, 'update'])->name('employees.update');
    Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy'])->name('employees.destroy');

    // M02 Shifts Management
    Route::get('/shifts', [ShiftController::class, 'index'])->name('shifts.index');
    Route::post('/shifts', [ShiftController::class, 'store'])->name('shifts.store');
    Route::put('/shifts/{shift}', [ShiftController::class, 'update'])->name('shifts.update');
    Route::delete('/shifts/{shift}', [ShiftController::class, 'destroy'])->name('shifts.destroy');
    Route::post('/shifts/seed-presets', [ShiftController::class, 'seedPresets'])->name('shifts.seed-presets');
    Route::post('/shifts/assign', [ShiftController::class, 'assign'])->name('shifts.assign');
    Route::delete('/shifts/assignments/{assignment}', [ShiftController::class, 'removeAssignment'])->name('shifts.assignments.destroy');

    // M02 Work Calendar & Public Holidays
    Route::get('/work-calendar', [WorkCalendarController::class, 'index'])->name('work-calendar.index');
    Route::post('/work-calendar/holidays', [WorkCalendarController::class, 'storeHoliday'])->name('work-calendar.holidays.store');
    Route::put('/work-calendar/holidays/{holiday}', [WorkCalendarController::class, 'updateHoliday'])->name('work-calendar.holidays.update');
    Route::delete('/work-calendar/holidays/{holiday}', [WorkCalendarController::class, 'destroyHoliday'])->name('work-calendar.holidays.destroy');
    Route::post('/work-calendar/seed-holidays', [WorkCalendarController::class, 'seedHolidays'])->name('work-calendar.holidays.seed');

    // M02 Biometric Attendance Ingestion
    Route::get('/attendance/import', [AttendanceImportController::class, 'index'])->name('attendance.import.index');
    Route::post('/attendance/import/preview', [AttendanceImportController::class, 'preview'])->name('attendance.import.preview');
    Route::post('/attendance/import', [AttendanceImportController::class, 'store'])->name('attendance.import.store');
    Route::delete('/attendance/import/{import}', [AttendanceImportController::class, 'destroy'])->name('attendance.import.destroy');
    Route::get('/attendance/import/template/{type}', [AttendanceImportController::class, 'downloadTemplate'])->name('attendance.import.template');
    Route::post('/attendance/import/map-employee', [AttendanceImportController::class, 'mapEmployee'])->name('attendance.import.map-employee');

    // M02 Attendance Daily Ledger & Overtime Engine
    Route::get('/attendance/daily', [AttendanceDailyController::class, 'index'])->name('attendance.daily.index');
    Route::post('/attendance/daily/process', [AttendanceDailyController::class, 'process'])->name('attendance.daily.process');
    Route::put('/attendance/daily/{attendanceDaily}', [AttendanceDailyController::class, 'update'])->name('attendance.daily.update');
    Route::post('/attendance/rules', [AttendanceDailyController::class, 'saveRule'])->name('attendance.rules.store');

    // M02 Leave Management & Statutory Entitlements
    Route::get('/leave/requests', [LeaveRequestController::class, 'index'])->name('leave.requests.index');
    Route::post('/leave/requests', [LeaveRequestController::class, 'store'])->name('leave.requests.store');
    Route::post('/leave/requests/{leaveRequest}/approve', [LeaveRequestController::class, 'approve'])->name('leave.requests.approve');
    Route::post('/leave/requests/{leaveRequest}/reject', [LeaveRequestController::class, 'reject'])->name('leave.requests.reject');
    Route::delete('/leave/requests/{leaveRequest}', [LeaveRequestController::class, 'cancel'])->name('leave.requests.cancel');
    Route::post('/leave/types', [LeaveRequestController::class, 'storeType'])->name('leave.types.store');
    Route::post('/leave/types/seed-statutory', [LeaveRequestController::class, 'seedStatutoryTypes'])->name('leave.types.seed-statutory');
    Route::post('/leave/entitlements/allocate', [LeaveRequestController::class, 'allocateEntitlements'])->name('leave.entitlements.allocate');
});

