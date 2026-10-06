<?php

declare(strict_types=1);

namespace App\Http\Requests\Leave;

use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;

final class ApplyLeaveRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->has('employee_id') || empty($this->input('employee_id'))) {
            $user = $this->user();
            if ($user !== null) {
                $tenantId = session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);
                $employee = null;
                if (! empty($user->employee_id)) {
                    $employee = Employee::find($user->employee_id);
                } elseif (! empty($user->username)) {
                    $empNo = preg_replace('/^EMP-?/i', '', (string) $user->username);
                    $employee = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('emp_no', $empNo)->first();
                } elseif (! empty($user->email)) {
                    $employee = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('email', $user->email)->first();
                }

                if ($employee !== null) {
                    $this->merge(['employee_id' => $employee->id]);
                }
            }
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'leave_type_id' => ['required', 'string', 'exists:leave_types,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'is_half_day' => ['nullable', 'boolean'],
            'half_day_type' => ['nullable', 'string', 'in:first_half,second_half'],
            'is_short_leave' => ['nullable', 'boolean'],
            'short_leave_from' => ['required_if:is_short_leave,true', 'nullable', 'string', 'regex:/^\d{1,2}:\d{2}(:\d{2})?$/'],
            'short_leave_to' => ['required_if:is_short_leave,true', 'nullable', 'string', 'regex:/^\d{1,2}:\d{2}(:\d{2})?$/'],
            'covering_employee_id' => ['nullable', 'string', 'different:employee_id', 'exists:employees,id'],
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }

    /**
     * Get the error messages for the defined validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'short_leave_from.required_if' => 'Start time is required for a short leave request.',
            'short_leave_to.required_if' => 'End time is required for a short leave request.',
            'short_leave_from.regex' => 'Start time must be a valid time in HH:mm format.',
            'short_leave_to.regex' => 'End time must be a valid time in HH:mm format.',
            'covering_employee_id.different' => 'The covering colleague cannot be the applicant employee.',
            'covering_employee_id.exists' => 'The selected covering colleague was not found.',
        ];
    }
}
