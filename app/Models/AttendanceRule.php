<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AttendanceRule extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'attendance_rules';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'shift_id',
        'rule_name',
        'grace_period_minutes',
        'ot_buffer_minutes',
        'ot_minimum_minutes',
        'ot_rate_weekday',
        'ot_rate_rest_day',
        'ot_rate_holiday',
        'half_day_min_hours',
        'half_day_max_hours',
        'early_departure_grace_minutes',
        'round_ot_interval_minutes',
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
            'grace_period_minutes' => 'integer',
            'ot_buffer_minutes' => 'integer',
            'ot_minimum_minutes' => 'integer',
            'ot_rate_weekday' => 'float',
            'ot_rate_rest_day' => 'float',
            'ot_rate_holiday' => 'float',
            'half_day_min_hours' => 'float',
            'half_day_max_hours' => 'float',
            'early_departure_grace_minutes' => 'integer',
            'round_ot_interval_minutes' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Shift associated with this specific rule, if any.
     *
     * @return BelongsTo<Shift, $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    /**
     * Resolve the active rule for a specific shift, tenant-wide fallback, or default defaults.
     */
    public static function resolveRuleForShift(?Shift $shift, string $tenantId): self
    {
        if ($shift !== null) {
            $shiftRule = self::where('tenant_id', $tenantId)
                ->where('shift_id', $shift->id)
                ->where('is_active', true)
                ->first();

            if ($shiftRule !== null) {
                return $shiftRule;
            }
        }

        $tenantDefault = self::where('tenant_id', $tenantId)
            ->whereNull('shift_id')
            ->where('is_active', true)
            ->first();

        if ($tenantDefault !== null) {
            return $tenantDefault;
        }

        // Return standard Sri Lankan Shop & Office default instance
        return new self([
            'tenant_id' => $tenantId,
            'shift_id' => $shift?->id,
            'rule_name' => 'Standard Sri Lanka Statutory Default',
            'grace_period_minutes' => $shift?->grace_minutes ?? 10,
            'ot_buffer_minutes' => 0,
            'ot_minimum_minutes' => 15,
            'ot_rate_weekday' => 1.50,
            'ot_rate_rest_day' => 1.50,
            'ot_rate_holiday' => 2.00,
            'half_day_min_hours' => 4.00,
            'half_day_max_hours' => 6.00,
            'early_departure_grace_minutes' => 5,
            'round_ot_interval_minutes' => 15,
            'is_active' => true,
        ]);
    }
}
