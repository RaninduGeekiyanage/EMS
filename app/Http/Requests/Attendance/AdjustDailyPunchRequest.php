<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class AdjustDailyPunchRequest extends FormRequest
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
            'check_in' => ['nullable', 'date'],
            'check_out' => ['nullable', 'date', 'after_or_equal:check_in'],
            'status' => ['required', 'string', 'in:present,absent,half_day,leave,holiday,rest_day,missing_punch'],
            'manual_reason' => ['required', 'string', 'min:5', 'max:1000'],
        ];
    }

    /**
     * Custom validation messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'manual_reason.required' => 'An audit justification reason is mandatory for manual punch adjustments.',
            'manual_reason.min' => 'Please provide a meaningful justification reason (at least 5 characters).',
            'check_out.after_or_equal' => 'The check-out time cannot be earlier than the check-in time.',
        ];
    }
}
