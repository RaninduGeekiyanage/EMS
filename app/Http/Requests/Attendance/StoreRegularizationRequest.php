<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class StoreRegularizationRequest extends FormRequest
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
            'employee_id' => ['nullable', 'string', 'exists:employees,id'],
            'attendance_date' => ['required', 'date', 'before_or_equal:today'],
            'request_type' => ['required', 'string', 'in:missing_punch,unapproved_half_day,on_duty_gate_pass,overtime_claim'],
            'requested_check_in' => ['nullable', 'date'],
            'requested_check_out' => ['nullable', 'date', 'after_or_equal:requested_check_in'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'], // Max 5MB
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'attendance_date.before_or_equal' => 'Cannot submit attendance regularization for future dates.',
            'reason.required' => 'A valid justification reason is required for attendance regularization.',
            'requested_check_out.after_or_equal' => 'Requested check-out time must be after check-in time.',
            'attachment.max' => 'Attachment file must not exceed 5MB.',
        ];
    }
}
