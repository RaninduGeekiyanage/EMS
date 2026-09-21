<?php

declare(strict_types=1);

namespace App\Http\Requests\Roster;

use Illuminate\Foundation\Http\FormRequest;

final class GenerateRosterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('roster.create');
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('pattern_id') && ! $this->filled('end_date')) {
            $pattern = \App\Models\RosterPattern::find($this->input('pattern_id'));
            if ($pattern && $pattern->end_date) {
                $this->merge([
                    'end_date' => $pattern->end_date instanceof \Carbon\CarbonInterface
                        ? $pattern->end_date->toDateString()
                        : (string) $pattern->end_date,
                ]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'pattern_id' => ['nullable', 'string'],
            'starting_step' => ['nullable', 'integer', 'min:1'],
            'pattern_mode' => ['required_without:pattern_id', 'nullable', 'string', 'in:daily,weekly,cyclical,copy_month'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string'],
            'department_id' => ['nullable', 'string'],
            'conflict_mode' => ['nullable', 'string', 'in:overwrite,preserve'],
            'status' => ['nullable', 'string', 'in:draft,published'],
            'preserve_leaves' => ['nullable', 'boolean'],

            // Daily Mode Config
            'daily_config' => ['nullable', 'array'],
            'daily_config.shift_id' => ['nullable', 'string'],
            'daily_config.rest_days' => ['nullable', 'array'],

            // Weekly Mode Config (7 days)
            'weekly_config' => ['nullable', 'array'],
            'weekly_config.*.shift_id' => ['nullable', 'string'],
            'weekly_config.*.is_rest_day' => ['nullable', 'boolean'],

            // Cyclical Mode Config (N days)
            'cyclical_config' => ['nullable', 'array'],
            'cyclical_config.anchor_date' => ['nullable', 'date'],
            'cyclical_config.steps' => ['nullable', 'array'],
            'cyclical_config.steps.*.shift_id' => ['nullable', 'string'],
            'cyclical_config.steps.*.is_rest_day' => ['nullable', 'boolean'],

            // Copy Month Mode Config
            'copy_config' => ['nullable', 'array'],
            'copy_config.source_year' => ['nullable', 'integer'],
            'copy_config.source_month' => ['nullable', 'integer', 'between:1,12'],
        ];
    }
}
