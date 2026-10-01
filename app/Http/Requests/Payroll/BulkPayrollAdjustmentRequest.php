<?php

declare(strict_types=1);

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

final class BulkPayrollAdjustmentRequest extends FormRequest
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
            'adjustments' => ['required', 'array', 'min:1'],
            'adjustments.*.employee_id' => ['required', 'string', 'exists:employees,id'],
            'adjustments.*.pay_item_id' => ['nullable', 'string', 'exists:pay_items,id'],
            'adjustments.*.period_year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'adjustments.*.period_month' => ['required', 'integer', 'min:1', 'max:12'],
            'adjustments.*.entry_type' => ['required', 'string', 'in:addition,deduction'],
            'adjustments.*.title' => ['required', 'string', 'max:150'],
            'adjustments.*.amount' => ['required', 'numeric', 'min:0.01', 'max:100000000'],
            'adjustments.*.is_epf_eligible' => ['nullable', 'boolean'],
            'adjustments.*.is_etf_eligible' => ['nullable', 'boolean'],
            'adjustments.*.is_taxable' => ['nullable', 'boolean'],
            'adjustments.*.remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
