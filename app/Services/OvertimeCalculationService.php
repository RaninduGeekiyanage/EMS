<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceRule;
use App\Models\PublicHoliday;
use App\Models\Shift;
use Carbon\CarbonInterface;

final class OvertimeCalculationService
{
    /**
     * Compute regular and overtime hours adhering to Sri Lanka Shop & Office Act and Management Rules.
     *
     * @return array{
     *     regular_hours: float,
     *     ot_hours: float,
     *     double_ot_hours: float,
     *     day_type: string,
     *     applied_rate: float,
     *     rule_name: string
     * }
     */
    public function calculate(
        AttendanceRule $rule,
        ?Shift $shift,
        CarbonInterface $date,
        float $workedHours,
        ?PublicHoliday $holiday = null
    ): array {
        if ($workedHours <= 0.00) {
            return [
                'regular_hours' => 0.00,
                'ot_hours' => 0.00,
                'double_ot_hours' => 0.00,
                'day_type' => $holiday !== null ? 'holiday' : ($date->isSunday() ? 'rest_day' : 'weekday'),
                'applied_rate' => 1.00,
                'rule_name' => $rule->rule_name,
            ];
        }

        // Case 1: Public / Company / Poya Holiday (2.0x or configured holiday rate)
        if ($holiday !== null) {
            $otHours = $this->applyRoundingAndThreshold(
                $workedHours,
                $rule->ot_minimum_minutes,
                $rule->round_ot_interval_minutes
            );

            return [
                'regular_hours' => 0.00,
                'ot_hours' => 0.00,
                'double_ot_hours' => round($otHours, 2),
                'day_type' => 'holiday',
                'applied_rate' => (float) $rule->ot_rate_holiday,
                'rule_name' => $rule->rule_name,
            ];
        }

        // Case 2: Sunday / Rest Day (1.5x or configured rest day rate)
        if ($date->isSunday()) {
            $otHours = $this->applyRoundingAndThreshold(
                $workedHours,
                $rule->ot_minimum_minutes,
                $rule->round_ot_interval_minutes
            );

            return [
                'regular_hours' => 0.00,
                'ot_hours' => round($otHours, 2),
                'double_ot_hours' => 0.00,
                'day_type' => 'rest_day',
                'applied_rate' => (float) $rule->ot_rate_rest_day,
                'rule_name' => $rule->rule_name,
            ];
        }

        // Case 3: Standard Weekday Overtime (Threshold + Buffer rules)
        $thresholdMinutes = $shift ? $shift->ot_threshold_minutes : 480; // default 8 hours = 480 mins
        $thresholdHours = $thresholdMinutes / 60.0;

        $excessHours = max(0.00, $workedHours - $thresholdHours);
        $excessMinutes = (int) round($excessHours * 60);

        $otMinutes = 0;
        // Management buffer check (e.g. after 30 mins, 60 mins / 1 hour)
        if ($excessMinutes >= $rule->ot_buffer_minutes) {
            $effectiveMinutes = $excessMinutes - $rule->ot_buffer_minutes;

            if ($effectiveMinutes >= $rule->ot_minimum_minutes) {
                $otMinutes = $effectiveMinutes;
            }
        }

        $calculatedOtHours = $this->applyRoundingAndThreshold(
            $otMinutes / 60.0,
            0,
            $rule->round_ot_interval_minutes
        );

        $regularHours = min($workedHours, $thresholdHours);

        return [
            'regular_hours' => round($regularHours, 2),
            'ot_hours' => round($calculatedOtHours, 2),
            'double_ot_hours' => 0.00,
            'day_type' => 'weekday',
            'applied_rate' => (float) $rule->ot_rate_weekday,
            'rule_name' => $rule->rule_name,
        ];
    }

    /**
     * Apply minimum minutes threshold and rounding interval (e.g. nearest 15 mins).
     */
    private function applyRoundingAndThreshold(float $hours, int $minMinutes, int $roundIntervalMinutes): float
    {
        $minutes = (int) round($hours * 60);

        if ($minutes < $minMinutes) {
            return 0.00;
        }

        if ($roundIntervalMinutes > 0) {
            $roundedMinutes = (int) (round($minutes / $roundIntervalMinutes) * $roundIntervalMinutes);

            return $roundedMinutes / 60.0;
        }

        return $minutes / 60.0;
    }
}
