<?php

declare(strict_types=1);

namespace App\Http\Requests\Biometric;

use Illuminate\Foundation\Http\FormRequest;

final class TestBiometricParseRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('biometric-device.view')
            || $this->user()?->can('biometric-device.manage')
            || $this->user()?->can('attendance.import');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'raw_content' => ['nullable', 'string', 'max:50000'],
            'sample_file' => ['nullable', 'file', 'max:5120'],
            'delimiter_type' => ['required', 'string', 'in:tab,space,regex_whitespace,comma,semicolon,pipe,custom'],
            'custom_delimiter' => ['nullable', 'string', 'max:10'],
            'skip_header_lines' => ['nullable', 'integer', 'min:0', 'max:50'],
            'date_mode' => ['required', 'string', 'in:combined,separate'],
            'date_format' => ['required', 'string', 'max:50'],
            'columns_config' => ['required', 'array'],
            'status_code_mapping' => ['nullable', 'array'],
            'default_device_id' => ['nullable', 'string', 'max:50'],
        ];
    }
}
