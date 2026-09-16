<?php

declare(strict_types=1);

namespace App\Http\Requests\Shift;

use Illuminate\Foundation\Http\FormRequest;

final class AssignShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('shift.update');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'string'],
            'shift_id' => ['required', 'string'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
        ];
    }
}
