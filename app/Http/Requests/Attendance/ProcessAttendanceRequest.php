<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class ProcessAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('attendance.import') || $this->user()->can('attendance.correct');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'date' => ['nullable', 'date'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'employee_id' => ['nullable', 'string', 'exists:employees,id'],
            'department_id' => ['nullable', 'string', 'exists:departments,id'],
            'overwrite_manual' => ['nullable', 'boolean'],
        ];
    }
}
