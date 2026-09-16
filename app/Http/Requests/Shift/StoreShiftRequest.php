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
            'color' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
        ];
    }
}
