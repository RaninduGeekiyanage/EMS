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

final class RawBiometricPunch extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'raw_biometric_punches';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'device_sn',
        'raw_user_id',
        'punch_time',
        'punch_type',
        'status',
        'imported_at',
        'attendance_log_id',
        'error_message',
        'raw_payload',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'punch_time' => 'datetime',
            'imported_at' => 'datetime',
            'raw_payload' => 'array',
        ];
    }

    /**
     * Get the tenant that owns this raw biometric punch.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Get the finalized attendance log associated with this punch.
     */
    public function attendanceLog(): BelongsTo
    {
        return $this->belongsTo(AttendanceLog::class, 'attendance_log_id');
    }

    /**
     * Scope a query to only include pending raw punches.
     *
     * @param  Builder<RawBiometricPunch>  $query
     * @return Builder<RawBiometricPunch>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope a query to only include successfully imported punches.
     *
     * @param  Builder<RawBiometricPunch>  $query
     * @return Builder<RawBiometricPunch>
     */
    public function scopeImported(Builder $query): Builder
    {
        return $query->where('status', 'imported');
    }

    /**
     * Scope a query to only include failed raw punches.
     *
     * @param  Builder<RawBiometricPunch>  $query
     * @return Builder<RawBiometricPunch>
     */
    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope a query to filter by device serial number.
     *
     * @param  Builder<RawBiometricPunch>  $query
     * @return Builder<RawBiometricPunch>
     */
    public function scopeForDevice(Builder $query, string $deviceSn): Builder
    {
        return $query->where('device_sn', $deviceSn);
    }

    /**
     * Scope a query to filter by punch date range.
     *
     * @param  Builder<RawBiometricPunch>  $query
     * @param  CarbonInterface|string  $start
     * @param  CarbonInterface|string  $end
     * @return Builder<RawBiometricPunch>
     */
    public function scopeBetweenDates(Builder $query, CarbonInterface|string $start, CarbonInterface|string $end): Builder
    {
        return $query->whereBetween('punch_time', [$start, $end]);
    }
}
