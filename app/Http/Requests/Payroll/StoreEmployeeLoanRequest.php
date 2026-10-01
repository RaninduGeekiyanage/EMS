<?php

declare(strict_types=1);

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

final class StoreEmployeeLoanRequest extends FormRequest
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
            'loan_title' => ['required', 'string', 'max:150'],
            'loan_reference_no' => ['nullable', 'string', 'max:50'],
            'principal_amount' => ['required', 'numeric', 'min:1', 'max:100000000'],
            'interest_rate_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'installment_count' => ['required', 'integer', 'min:1', 'max:120'],
            'monthly_installment' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'disbursed_at' => ['required', 'date'],
            'deduction_start_month' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
