<?php

declare(strict_types=1);

namespace App\Http\Requests\Roster;

use Illuminate\Foundation\Http\FormRequest;

final class ClearRosterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('roster.delete');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'year' => ['required', 'integer'],
            'month' => ['required', 'integer', 'between:1,12'],
            'department_id' => ['nullable', 'string'],
            'only_drafts' => ['nullable', 'boolean'],
        ];
    }
}
