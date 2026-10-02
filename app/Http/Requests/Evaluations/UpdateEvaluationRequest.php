<?php

declare(strict_types=1);

namespace App\Http\Requests\Evaluations;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateEvaluationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['sometimes', 'string', 'exists:employees,id'],
            'evaluation_period' => ['sometimes', 'string', 'max:50'],
            'evaluation_date' => ['sometimes', 'date'],
            'ratings_json' => ['sometimes', 'array'],
            'ratings_json.*.score' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'ratings_json.*.rating' => ['nullable', 'numeric', 'min:1', 'max:5'],
            'ratings_json.*.remarks' => ['nullable', 'string', 'max:500'],
            'hod_comments' => ['nullable', 'string', 'max:2000'],
            'is_draft' => ['nullable', 'boolean'],
            'submit_to_hr' => ['nullable', 'boolean'],
        ];
    }
}
