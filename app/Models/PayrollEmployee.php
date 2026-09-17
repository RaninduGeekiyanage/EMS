<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class PayrollEmployee extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'payroll_employees';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'payroll_run_id',
        'employee_id',
        'payment_mode',
        'employment_type',
        'labor_act',
        'wages_board_category_id',
        'is_epf_eligible',
        'worked_days',
        'no_pay_days',
        'ot_hours',
        'double_ot_hours',
        'basic_salary',
        'hourly_rate',
        'ot_pay',
        'allowances',
        'no_pay_deduction',
        'gross_pay',
        'epf_eligible_earnings',
        'epf_employee',
        'epf_employer',
        'etf_employer',
        'apit_tax',
        'other_deductions',
        'net_pay',
        'breakdown_json',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_epf_eligible' => 'boolean',
            'worked_days' => 'decimal:2',
            'no_pay_days' => 'decimal:2',
            'ot_hours' => 'decimal:2',
            'double_ot_hours' => 'decimal:2',
            'basic_salary' => 'decimal:2',
            'hourly_rate' => 'decimal:2',
            'ot_pay' => 'decimal:2',
            'allowances' => 'decimal:2',
            'no_pay_deduction' => 'decimal:2',
            'gross_pay' => 'decimal:2',
            'epf_eligible_earnings' => 'decimal:2',
            'epf_employee' => 'decimal:2',
            'epf_employer' => 'decimal:2',
            'etf_employer' => 'decimal:2',
            'apit_tax' => 'decimal:2',
            'other_deductions' => 'decimal:2',
            'net_pay' => 'decimal:2',
            'breakdown_json' => 'array',
        ];
    }

    /**
     * The payroll run this record belongs to.
     *
     * @return BelongsTo<PayrollRun, $this>
     */
    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    /**
     * The employee this record belongs to.
     *
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * The Wages Board category if applicable.
     *
     * @return BelongsTo<WagesBoardCategory, $this>
     */
    public function wagesBoardCategory(): BelongsTo
    {
        return $this->belongsTo(WagesBoardCategory::class, 'wages_board_category_id');
    }
}
