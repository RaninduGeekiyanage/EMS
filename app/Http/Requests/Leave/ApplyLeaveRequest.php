<?php

declare(strict_types=1);

namespace App\Http\Requests\Leave;

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
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
