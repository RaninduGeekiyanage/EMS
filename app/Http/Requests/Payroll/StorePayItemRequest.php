<?php

declare(strict_types=1);

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StorePayItemRequest extends FormRequest
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
        $tenantId = $this->user()?->tenant_id ?? session('tenant_id');

        return [
            'code' => [
                'required',
                'string',
                'max:50',
                'regex:/^[A-Z0-9_]+$/i',
                Rule::unique('pay_items', 'code')->where('tenant_id', $tenantId),
            ],
            'name' => ['required', 'string', 'max:150'],
            'item_type' => ['required', 'string', 'in:earning,deduction'],
            'calculation_type' => ['required', 'string', 'in:fixed,percentage_of_basic,formula'],
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
