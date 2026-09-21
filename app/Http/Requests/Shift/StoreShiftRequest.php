<?php

declare(strict_types=1);

namespace App\Http\Requests\Shift;

use Illuminate\Foundation\Http\FormRequest;

final class StoreShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('shift.create');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:50'],
            'shift_type' => ['required', 'string', 'in:regular,rotational,night,half_day,flexible'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'break_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'grace_minutes' => ['required', 'integer', 'min:0', 'max:60'],
            'ot_threshold_minutes' => ['required', 'integer', 'min:0', 'max:720'],
            'is_night_shift' => ['boolean'],
            'in_window_before_start' => ['nullable', 'integer', 'min:0', 'max:360'],
            'in_window_after_start' => ['nullable', 'integer', 'min:0', 'max:360'],
            'out_window_before_end' => ['nullable', 'integer', 'min:0', 'max:360'],
            'out_window_after_end' => ['nullable', 'integer', 'min:0', 'max:360'],
            'first_half_end_time' => ['nullable', 'date_format:H:i'],
            'second_half_start_time' => ['nullable', 'date_format:H:i'],
            'early_in_as_ot' => ['boolean'],
            'early_in_as_att_in' => ['boolean'],
            'ot_start_time' => ['nullable', 'date_format:H:i'],
            'working_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'color' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
        ];
    }
}
