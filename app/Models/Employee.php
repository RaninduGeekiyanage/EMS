<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\EmploymentType;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Employee extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'employees';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'emp_no',
        'nic',
        'full_name',
        'gender',
        'date_of_birth',
        'marital_status',
        'email',
        'phone',
        'permanent_address',
        'temporary_address',
        'city',
        'landline',
        'department_id',
        'designation_id',
        'branch_id',
        'job_grade_id',
        'wages_board_category_id',
        'employment_type',
        'employment_category',
        'employment_status',
        'attendance_mode',
        'date_of_joining',
        'biometric_device_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'nic' => 'encrypted',
            'employment_type' => EmploymentType::class,
            'date_of_birth' => 'date',
            'date_of_joining' => 'date',
        ];
    }

    /**
     * Get the department the employee belongs to.
     *
     * @return BelongsTo<Department, $this>
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /**
     * Get the designation of the employee.
     *
     * @return BelongsTo<Designation, $this>
     */
    public function designation(): BelongsTo
    {
        return $this->belongsTo(Designation::class, 'designation_id');
    }

    /**
     * Get the branch the employee is assigned to.
     *
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /**
     * Get the payment info configuration.
     *
     * @return HasOne<EmployeePaymentInfo, $this>
     */
    public function paymentInfo(): HasOne
    {
        return $this->hasOne(EmployeePaymentInfo::class, 'employee_id');
    }

    /**
     * Get the banking details for salary remittances.
     *
     * @return HasOne<EmployeeBankInfo, $this>
     */
    public function bankInfo(): HasOne
    {
        return $this->hasOne(EmployeeBankInfo::class, 'employee_id');
    }

    /**
     * Get the statutory EPF/ETF configuration.
     *
     * @return HasOne<EmployeeEpfInfo, $this>
     */
    public function epfInfo(): HasOne
    {
        return $this->hasOne(EmployeeEpfInfo::class, 'employee_id');
    }

    /**
     * Get the shift assignments for the employee.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<ShiftAssignment, $this>
     */
    public function shiftAssignments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ShiftAssignment::class, 'employee_id');
    }

    /**
     * Get the shifts assigned to this employee.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany<Shift, $this>
     */
    public function shifts(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Shift::class, 'shift_assignments', 'employee_id', 'shift_id')
            ->withPivot(['id', 'effective_from', 'effective_to'])
            ->withTimestamps();
    }

    /**
     * Get the attendance logs for the employee.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<AttendanceLog, $this>
     */
    public function attendanceLogs(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(AttendanceLog::class, 'employee_id');
    }

    /**
     * Get the leave entitlements for the employee.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<LeaveEntitlement, $this>
     */
    public function leaveEntitlements(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(LeaveEntitlement::class, 'employee_id');
    }

    /**
     * Get the leave requests for the employee.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<LeaveRequest, $this>
     */
    public function leaveRequests(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(LeaveRequest::class, 'employee_id');
    }

    /**
     * Get the roster entries for the employee.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<RosterEntry, $this>
     */
    public function rosterEntries(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(RosterEntry::class, 'employee_id');
    }

    /**
     * Squad groups this employee belongs to.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany<RosterGroup, $this>
     */
    public function rosterGroups(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(RosterGroup::class, 'roster_group_members', 'employee_id', 'roster_group_id')
            ->withPivot(['id', 'start_date', 'end_date'])
            ->withTimestamps();
    }

    /**
     * Get the organizational Job Grade (OC Grade) of the employee.
     *
     * @return BelongsTo<JobGrade, $this>
     */
    public function jobGrade(): BelongsTo
    {
        return $this->belongsTo(JobGrade::class, 'job_grade_id');
    }

    /**
     * Get the Wages Board category if governed by Wages Board Ordinance.
     *
     * @return BelongsTo<WagesBoardCategory, $this>
     */
    public function wagesBoardCategory(): BelongsTo
    {
        return $this->belongsTo(WagesBoardCategory::class, 'wages_board_category_id');
    }
}


