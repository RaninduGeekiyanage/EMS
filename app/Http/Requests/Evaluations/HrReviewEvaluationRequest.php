<?php

declare(strict_types=1);

namespace App\Http\Requests\Evaluations;

use Illuminate\Foundation\Http\FormRequest;

final class HrReviewEvaluationRequest extends FormRequest
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
            'decision' => ['required', 'string', 'in:confirm,amend_and_confirm,reject,archive'],
            'hr_comments' => ['nullable', 'string', 'max:2000'],
            'direct_bypass' => ['nullable', 'boolean'],
            'adjusted_ratings' => ['nullable', 'array'],
        ];
    }
}
