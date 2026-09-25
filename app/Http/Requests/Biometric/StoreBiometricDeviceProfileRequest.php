<?php

declare(strict_types=1);

namespace App\Http\Requests\Biometric;

use Illuminate\Foundation\Http\FormRequest;

final class StoreBiometricDeviceProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('biometric-device.manage') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'device_brand' => ['required', 'string', 'max:50'],
            'model_name' => ['nullable', 'string', 'max:100'],
            'file_extension' => ['required', 'string', 'in:dat,txt,csv,log'],
            'delimiter_type' => ['required', 'string', 'in:tab,space,regex_whitespace,comma,semicolon,pipe,custom'],
            'custom_delimiter' => ['nullable', 'string', 'max:10'],
            'skip_header_lines' => ['nullable', 'integer', 'min:0', 'max:50'],
            'date_mode' => ['required', 'string', 'in:combined,separate'],
            'date_format' => ['required', 'string', 'max:50'],
            'time_format' => ['nullable', 'string', 'max:50'],
            'columns_config' => ['required', 'array'],
            'columns_config.biometric_id_col' => ['required', 'integer', 'min:0'],
            'columns_config.datetime_col' => ['nullable', 'integer', 'min:0'],
            'columns_config.date_col' => ['nullable', 'integer', 'min:0'],
            'columns_config.time_col' => ['nullable', 'integer', 'min:0'],
            'columns_config.am_pm_col' => ['nullable', 'integer', 'min:0'],
            'columns_config.punch_type_col' => ['nullable', 'integer', 'min:0'],
            'columns_config.device_id_col' => ['nullable', 'integer', 'min:0'],
            'status_code_mapping' => ['nullable', 'array'],
            'default_device_id' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
