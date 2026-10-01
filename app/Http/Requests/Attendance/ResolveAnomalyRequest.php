<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class ResolveAnomalyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mechanism' => ['required', 'string', 'in:paid_waiver,retro_leave,no_pay'],
            'leave_type_id' => ['required_if:mechanism,retro_leave', 'nullable', 'string', 'exists:leave_types,id'],
            'justification' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'mechanism.required' => 'An anomaly resolution mechanism must be selected.',
            'leave_type_id.required_if' => 'Please select a leave type to convert into retroactive leave.',
            'justification.required' => 'A justification note is mandatory for resolving attendance anomalies.',
        ];
    }
}
