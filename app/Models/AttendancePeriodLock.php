<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class AttendancePeriodLock extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    public const STATUS_OPEN = 'open';
    public const STATUS_HOD_SIGNED_OFF = 'hod_signed_off';
    public const STATUS_HR_LOCKED = 'hr_locked';

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'attendance_period_locks';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'year',
        'month',
        'period_start',
        'period_end',
        'department_id',
        'status',
        'hod_signed_off_by',
        'hod_signed_off_at',
        'hr_locked_by',
        'hr_locked_at',
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
            'year' => 'integer',
            'month' => 'integer',
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'hod_signed_off_at' => 'datetime:Y-m-d H:i:s',
            'hr_locked_at' => 'datetime:Y-m-d H:i:s',
        ];
    }

    /**
     * Scope to find lock for a specific date and optional department.
     *
     * @param  Builder<AttendancePeriodLock>  $query
     */
    public function scopeForDateAndDepartment(Builder $query, CarbonInterface|string $date, ?string $departmentId = null): void
    {
        $dateStr = $date instanceof CarbonInterface ? $date->toDateString() : (string) $date;
        $query->where('period_start', '<=', $dateStr)
            ->where('period_end', '>=', $dateStr)
            ->where(function (Builder $sub) use ($departmentId): void {
                $sub->whereNull('department_id');
                if ($departmentId !== null) {
                    $sub->orWhere('department_id', $departmentId);
                }
            });
    }

    /**
     * Get the department associated with this period lock.
     *
     * @return BelongsTo<Department, $this>
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /**
     * Get the HOD who signed off on the period.
     *
     * @return BelongsTo<User, $this>
     */
    public function hodUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hod_signed_off_by');
    }

    /**
     * Get the HR user who locked the period.
     *
     * @return BelongsTo<User, $this>
     */
    public function hrUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hr_locked_by');
    }

    /**
     * Get the tenant that this period lock belongs to.
     *
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Check if the period is finalized and locked by HR.
     */
    public function isLocked(): bool
    {
        return $this->status === self::STATUS_HR_LOCKED;
    }

    /**
     * Check if the period has been signed off by HOD.
     */
    public function isHodSignedOff(): bool
    {
        return $this->status === self::STATUS_HOD_SIGNED_OFF;
    }
}
