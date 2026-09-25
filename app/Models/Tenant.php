<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Tenant extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'tenants';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'slug',
        'is_active',
        'is_ams_enabled',
        'is_payroll_enabled',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_ams_enabled' => 'boolean',
            'is_payroll_enabled' => 'boolean',
        ];
    }

    /**
     * Get all users belonging to this tenant.
     *
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'tenant_id');
    }

    /**
     * Get the Company Owner user for this tenant.
     */
    public function owner(): ?User
    {
        return $this->users()->whereHas('roles', function ($query): void {
            $query->where('name', 'Company Owner');
        })->first();
    }

    /**
     * Get the settings associated with this tenant.
     */
    public function settings(): HasMany
    {
        return $this->hasMany(TenantSetting::class, 'tenant_id');
    }

    /**
     * Retrieve a setting value for this tenant.
     */
    public function getSetting(string $key, mixed $default = null): mixed
    {
        $setting = $this->settings()->firstWhere('key', $key);

        return $setting !== null ? $setting->value : $default;
    }

    /**
     * Set or update a setting value for this tenant.
     */
    public function setSetting(string $key, mixed $value): TenantSetting
    {
        /** @var TenantSetting */
        return $this->settings()->updateOrCreate(
            ['key' => $key],
            ['value' => $value === null ? null : (is_scalar($value) ? (string) $value : json_encode($value, JSON_THROW_ON_ERROR))]
        );
    }

    /**
     * Get all attendance import jobs for this tenant.
     *
     * @return HasMany<AttendanceImport, $this>
     */
    public function attendanceImports(): HasMany
    {
        return $this->hasMany(AttendanceImport::class, 'tenant_id');
    }

    /**
     * Get all attendance logs for this tenant.
     *
     * @return HasMany<AttendanceLog, $this>
     */
    public function attendanceLogs(): HasMany
    {
        return $this->hasMany(AttendanceLog::class, 'tenant_id');
    }
}
