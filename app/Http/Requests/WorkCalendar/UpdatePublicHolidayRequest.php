<?php

declare(strict_types=1);

namespace App\Http\Requests\WorkCalendar;

use Illuminate\Foundation\Http\FormRequest;

final class UpdatePublicHolidayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('work-calendar.manage');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'holiday_date' => ['required', 'date'],
            'type' => ['required', 'string', 'in:statutory,mercantile,poya,company,special'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }
}
