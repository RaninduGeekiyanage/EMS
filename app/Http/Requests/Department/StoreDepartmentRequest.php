<?php

declare(strict_types=1);

namespace App\Http\Requests\Department;

use Illuminate\Foundation\Http\FormRequest;

final class StoreDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'parent_id' => ['nullable', 'string'],
            'cost_center' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ];
    }
}
