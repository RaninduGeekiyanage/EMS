<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class SaveAttendanceRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('attendance.correct');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'shift_id' => ['nullable', 'string', 'exists:shifts,id'],
            'rule_name' => ['required', 'string', 'max:100'],
            'grace_period_minutes' => ['required', 'integer', 'min:0', 'max:120'],
            'ot_buffer_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'ot_minimum_minutes' => ['required', 'integer', 'min:0', 'max:120'],
            'ot_rate_weekday' => ['required', 'numeric', 'min:1.0', 'max:5.0'],
            'ot_rate_rest_day' => ['required', 'numeric', 'min:1.0', 'max:5.0'],
            'ot_rate_holiday' => ['required', 'numeric', 'min:1.0', 'max:5.0'],
            'half_day_min_hours' => ['required', 'numeric', 'min:1.0', 'max:12.0'],
            'half_day_max_hours' => ['required', 'numeric', 'min:1.0', 'max:12.0', 'gte:half_day_min_hours'],
            'early_departure_grace_minutes' => ['required', 'integer', 'min:0', 'max:60'],
            'round_ot_interval_minutes' => ['required', 'integer', 'in:0,5,10,15,30,60'],
            'is_active' => ['boolean'],
        ];
    }
}
