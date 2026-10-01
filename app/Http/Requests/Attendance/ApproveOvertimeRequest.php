<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class ApproveOvertimeRequest extends FormRequest
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
            'mode' => ['required', 'string', 'in:approve_all,partial,reject'],
            'approved_ot_hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'approved_double_ot_hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'mode.required' => 'Overtime approval mode (approve_all, partial, reject) is required.',
            'approved_ot_hours.min' => 'Approved overtime hours cannot be negative.',
            'approved_double_ot_hours.min' => 'Approved double overtime hours cannot be negative.',
        ];
    }
}
