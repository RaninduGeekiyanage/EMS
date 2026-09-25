<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class BiometricDeviceProfile extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'biometric_device_profiles';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'name',
        'device_brand',
        'model_name',
        'file_extension',
        'delimiter_type',
        'custom_delimiter',
        'skip_header_lines',
        'date_mode',
        'date_format',
        'time_format',
        'columns_config',
        'status_code_mapping',
        'default_device_id',
        'is_active',
        'created_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'skip_header_lines' => 'integer',
            'is_active' => 'boolean',
            'columns_config' => 'array',
            'status_code_mapping' => 'array',
        ];
    }

    /**
     * Get the user who created this configuration profile.
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the attendance imports that used this profile.
     */
    public function imports(): HasMany
    {
        return $this->hasMany(AttendanceImport::class, 'profile_id');
    }

    /**
     * Scope a query to only include active profiles.
     *
     * @param  Builder<BiometricDeviceProfile>  $query
     * @return Builder<BiometricDeviceProfile>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
