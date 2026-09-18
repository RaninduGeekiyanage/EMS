<?php

declare(strict_types=1);

namespace App\Http\Requests\Roster;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateRosterEntryRequest extends FormRequest
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
            'employee_id' => ['required', 'string'],
            'date' => ['required', 'date'],
            'shift_id' => ['nullable', 'string'],
            'schedule_type' => ['required', 'string', 'in:shift,rest_day,off'],
            'notes' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:draft,published'],
        ];
    }
}
