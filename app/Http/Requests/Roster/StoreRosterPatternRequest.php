<?php

declare(strict_types=1);

namespace App\Http\Requests\Roster;

use Illuminate\Foundation\Http\FormRequest;

final class StoreRosterPatternRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('roster.create');
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('start_date') || empty($this->input('start_date'))) {
            $this->merge([
                'start_date' => now()->toDateString(),
                'end_date' => now()->addMonth()->toDateString(),
            ]);
        }

        if (! $this->has('cycle_length_days') || empty($this->input('cycle_length_days'))) {
            $type = $this->input('pattern_type');
            if ($type === 'weekly') {
                $this->merge(['cycle_length_days' => 7]);
            } elseif ($type === 'cyclical' && is_array($this->input('pattern_data'))) {
                $steps = $this->input('pattern_data.steps') ?? $this->input('pattern_data');
                $this->merge(['cycle_length_days' => is_array($steps) ? count($steps) : 7]);
            } else {
                $this->merge(['cycle_length_days' => 1]);
            }
        }
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
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'cycle_length_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'pattern_data' => ['required', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
