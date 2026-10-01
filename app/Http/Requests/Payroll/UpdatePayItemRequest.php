<?php

declare(strict_types=1);

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

final class UpdatePayItemRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:150'],
            'item_type' => ['nullable', 'string', 'in:earning,deduction'],
            'calculation_type' => ['nullable', 'string', 'in:fixed,percentage_of_basic,formula'],
            'default_amount' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_epf_eligible' => ['nullable', 'boolean'],
            'is_etf_eligible' => ['nullable', 'boolean'],
            'is_taxable' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
