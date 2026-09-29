<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateAttendanceSettingsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null && (
            $this->user()->is_super_admin
            || $this->user()->hasRole('Company Owner')
            || $this->user()->hasRole('Company Admin')
            || $this->user()->can('attendance.settings.manage')
        );
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'ignore_terminal_punch_type' => ['required', 'boolean'],
            'anti_passback_minutes' => ['required', 'integer', 'min:0', 'max:60'],
            'auto_detect_shift' => ['required', 'boolean'],
            'allow_early_in_as_ot' => ['required', 'boolean'],
            'overtime_minimum_minutes' => ['required', 'integer', 'min:0', 'max:120'],
        ];
    }
}
