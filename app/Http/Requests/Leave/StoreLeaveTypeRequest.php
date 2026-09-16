<?php

declare(strict_types=1);

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;

final class StoreLeaveTypeRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:50'],
            'days_per_year' => ['required', 'numeric', 'min:0', 'max:365'],
            'is_paid' => ['required', 'boolean'],
            'carry_forward_allowed' => ['nullable', 'boolean'],
            'max_carry_forward_days' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'max_consecutive_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'requires_attachment' => ['nullable', 'boolean'],
            'color' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
