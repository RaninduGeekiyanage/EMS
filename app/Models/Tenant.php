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
        ];
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
            ['value' => is_scalar($value) || $value === null ? (string) $value : json_encode($value, JSON_THROW_ON_ERROR)]
        );
    }
}
