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
        'email',
        'phone',
        'department_id',
        'designation_id',
        'branch_id',
        'employment_type',
        'employment_status',
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
}

