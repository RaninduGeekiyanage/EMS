<?php

declare(strict_types=1);

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;

final class AllocateEntitlementRequest extends FormRequest
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
            'year' => ['required', 'integer', 'min:2020', 'max:2099'],
            'employee_id' => ['nullable', 'string', 'exists:employees,id'],
        ];
    }
}
