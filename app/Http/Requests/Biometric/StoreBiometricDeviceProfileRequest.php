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
        $isStaging = $this->input('source_type') === 'database_staging';

        return [
            'name' => ['required', 'string', 'max:100'],
            'source_type' => ['nullable', 'string', 'in:file,database_staging'],
            'device_brand' => ['required', 'string', 'max:50'],
            'model_name' => ['nullable', 'string', 'max:100'],
            'file_extension' => [$isStaging ? 'nullable' : 'required', 'string', 'max:20'],
            'delimiter_type' => [$isStaging ? 'nullable' : 'required', 'string', 'max:30'],
            'custom_delimiter' => ['nullable', 'string', 'max:10'],
            'skip_header_lines' => ['nullable', 'integer', 'min:0', 'max:50'],
            'date_mode' => [$isStaging ? 'nullable' : 'required', 'string', 'in:combined,separate'],
            'date_format' => ['required', 'string', 'max:50'],
            'time_format' => ['nullable', 'string', 'max:50'],
            'columns_config' => ['required', 'array'],
            'columns_config.biometric_id_col' => [$isStaging ? 'nullable' : 'required', 'nullable'],
            'columns_config.datetime_col' => ['nullable'],
            'columns_config.date_col' => ['nullable'],
            'columns_config.time_col' => ['nullable'],
            'columns_config.am_pm_col' => ['nullable'],
            'columns_config.punch_type_col' => ['nullable'],
            'columns_config.device_id_col' => ['nullable'],
            'columns_config.raw_user_id_col' => ['nullable', 'string', 'max:50'],
            'columns_config.punch_time_col' => ['nullable', 'string', 'max:50'],
            'columns_config.device_sn_col' => ['nullable', 'string', 'max:50'],
            'status_code_mapping' => ['nullable', 'array'],
            'default_device_id' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ];

    }
}
