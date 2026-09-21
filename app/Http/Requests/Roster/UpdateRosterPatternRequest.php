<?php

declare(strict_types=1);

namespace App\Http\Requests\Roster;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateRosterPatternRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:50'],
            'pattern_type' => ['required', 'string', 'in:weekly,cyclical,daily'],
            'cycle_length_days' => ['required', 'integer', 'min:1', 'max:365'],
            'pattern_data' => ['required', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
