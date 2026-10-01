<?php

declare(strict_types=1);

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

final class AssignEmployeePayItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'pay_item_id' => ['required', 'string', 'exists:pay_items,id'],
            'amount' => ['required', 'numeric', 'min:0', 'max:100000000'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'is_active' => ['nullable', 'boolean'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
