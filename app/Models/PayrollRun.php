<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class PayrollRun extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'payroll_runs';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'period_year',
        'period_month',
        'status',
        'total_gross',
        'total_net',
        'total_epf_employee',
        'total_epf_employer',
        'total_etf',
        'total_apit',
        'total_deductions',
        'employee_count',
        'run_by',
        'approved_by',
        'approved_at',
        'notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period_year' => 'integer',
            'period_month' => 'integer',
            'total_gross' => 'decimal:2',
            'total_net' => 'decimal:2',
            'total_epf_employee' => 'decimal:2',
            'total_epf_employer' => 'decimal:2',
            'total_etf' => 'decimal:2',
            'total_apit' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'employee_count' => 'integer',
            'approved_at' => 'datetime',
        ];
    }

    /**
     * Get human-readable month/year label.
     */
    public function getPeriodLabelAttribute(): string
    {
        return Carbon::createFromDate($this->period_year, $this->period_month, 1)->format('F Y');
    }

    /**
     * Checks if run is in draft state.
     */
    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    /**
     * Checks if run is approved.
     */
    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    /**
     * Checks if run is locked against edits.
     */
    public function isLocked(): bool
    {
        return $this->status === 'locked';
    }

    /**
     * The employees processed in this payroll run.
     *
     * @return HasMany<PayrollEmployee, $this>
     */
    public function payrollEmployees(): HasMany
    {
        return $this->hasMany(PayrollEmployee::class, 'payroll_run_id');
    }

    /**
     * The user who calculated this payroll run.
     *
     * @return BelongsTo<User, $this>
     */
    public function runBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'run_by');
    }

    /**
     * The user who approved this payroll run.
     *
     * @return BelongsTo<User, $this>
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
