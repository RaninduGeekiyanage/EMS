<?php

declare(strict_types=1);

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;

final class CreditCompensatoryLeaveRequest extends FormRequest
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
            'earned_date' => ['required', 'date', 'before_or_equal:today'],
            'earned_days' => ['required', 'numeric', 'min:0.5', 'max:10.0'],
            'reason' => ['required', 'string', 'max:500'],
        ];
    }
}
