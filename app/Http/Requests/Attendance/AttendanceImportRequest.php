<?php

declare(strict_types=1);

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class AttendanceImportRequest extends FormRequest
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
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240'],
            'adapter_type' => ['required', 'string', 'in:zkteco,generic_csv,excel,dat,csv,xlsx'],
            'device_id' => ['nullable', 'string', 'max:50'],
            'config' => ['nullable', 'array'],
        ];
    }

    /**
     * Custom messages for validation errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Please select an attendance file to upload.',
            'file.max' => 'The attendance file may not be greater than 10 megabytes.',
            'adapter_type.required' => 'Please select a biometric file format adapter.',
            'adapter_type.in' => 'Selected adapter must be ZKTeco DAT, Generic CSV, or Excel XLSX.',
        ];
    }
}
