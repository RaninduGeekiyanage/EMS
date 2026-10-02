<?php

declare(strict_types=1);

namespace App\Http\Requests\Evaluations;

use Illuminate\Foundation\Http\FormRequest;

final class StoreEvaluationRequest extends FormRequest
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
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'evaluation_period' => ['required', 'string', 'max:50'],
            'evaluation_date' => ['required', 'date'],
            'ratings_json' => ['nullable', 'array'],
            'ratings_json.*.score' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'ratings_json.*.rating' => ['nullable', 'numeric', 'min:1', 'max:5'],
            'ratings_json.*.remarks' => ['nullable', 'string', 'max:500'],
            'hod_comments' => ['nullable', 'string', 'max:2000'],
            'is_draft' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Get custom attribute names.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'employee_id' => 'Employee',
            'evaluation_period' => 'Evaluation Period',
            'evaluation_date' => 'Evaluation Date',
            'ratings_json' => 'Evaluation Ratings',
            'hod_comments' => 'HOD Comments',
        ];
    }
}
