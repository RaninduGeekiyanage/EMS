<?php

declare(strict_types=1);

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

final class StorePayrollAdjustmentRequest extends FormRequest
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
            'pay_item_id' => ['nullable', 'string', 'exists:pay_items,id'],
            'period_year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'period_month' => ['required', 'integer', 'min:1', 'max:12'],
            'entry_type' => ['required', 'string', 'in:addition,deduction'],
            'title' => ['required', 'string', 'max:150'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:100000000'],
            'is_epf_eligible' => ['nullable', 'boolean'],
            'is_etf_eligible' => ['nullable', 'boolean'],
            'is_taxable' => ['nullable', 'boolean'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
