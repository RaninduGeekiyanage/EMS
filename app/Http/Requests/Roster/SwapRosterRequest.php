<?php

declare(strict_types=1);

namespace App\Http\Requests\Roster;

use Illuminate\Foundation\Http\FormRequest;

final class SwapRosterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('roster.update');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'employee_a_id' => ['required', 'string'],
            'employee_b_id' => ['required', 'string', 'different:employee_a_id'],
            'date' => ['required', 'date'],
        ];
    }
}
