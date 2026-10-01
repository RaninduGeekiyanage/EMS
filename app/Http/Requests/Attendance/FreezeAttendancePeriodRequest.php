<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class FreezeAttendancePeriodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'year' => ['required', 'integer', 'min:2020', 'max:2035'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'department_id' => ['nullable', 'string', 'exists:departments,id'],
            'action' => ['required', 'string', 'in:hod_sign_off,hr_lock,unlock'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'year.required' => 'Year is required.',
            'month.required' => 'Month is required.',
            'action.required' => 'Freeze action (hod_sign_off, hr_lock, unlock) is required.',
        ];
    }
}
