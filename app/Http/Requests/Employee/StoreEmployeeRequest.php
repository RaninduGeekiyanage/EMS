<?php

declare(strict_types=1);

namespace App\Http\Requests\Employee;

use App\Enums\EmploymentType;
use App\Enums\PaymentMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

final class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Employee Core
            'emp_no' => ['nullable', 'string', 'max:50'],
            'full_name' => ['required', 'string', 'max:255'],
            'nic' => ['required', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'department_id' => ['nullable', 'string'],
            'designation_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'employment_type' => ['required', new Enum(EmploymentType::class)],
            'employment_status' => ['required', 'string', 'in:active,resigned,terminated,suspended'],
            'date_of_joining' => ['nullable', 'date'],
            'biometric_device_id' => ['nullable', 'string', 'max:50'],

            // Payment Info
            'payment_mode' => ['required', new Enum(PaymentMode::class)],
            'basic_salary' => ['nullable', 'numeric', 'min:0'],
            'daily_rate' => ['nullable', 'numeric', 'min:0'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'effective_date' => ['nullable', 'date'],

            // Bank Details
            'bank_code' => ['nullable', 'string', 'max:50'],
            'bank_name' => ['nullable', 'string', 'max:100'],
            'branch_name' => ['nullable', 'string', 'max:100'],
            'account_no' => ['nullable', 'string', 'max:100'],
            'account_holder_name' => ['nullable', 'string', 'max:255'],

            // EPF Details
            'is_epf_member' => ['boolean'],
            'epf_no' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * Extract employee core fields.
     *
     * @return array<string, mixed>
     */
    public function employeeData(): array
    {
        return [
            'emp_no' => $this->validated('emp_no'),
            'full_name' => $this->validated('full_name'),
            'nic' => $this->validated('nic'),
            'email' => $this->validated('email'),
            'phone' => $this->validated('phone'),
            'department_id' => $this->validated('department_id'),
            'designation_id' => $this->validated('designation_id'),
            'branch_id' => $this->validated('branch_id'),
            'employment_type' => $this->validated('employment_type'),
            'employment_status' => $this->validated('employment_status'),
            'date_of_joining' => $this->validated('date_of_joining'),
            'biometric_device_id' => $this->validated('biometric_device_id'),
        ];
    }

    /**
     * Extract payment configuration fields.
     *
     * @return array<string, mixed>
     */
    public function paymentData(): array
    {
        return [
            'payment_mode' => $this->validated('payment_mode'),
            'basic_salary' => (float) ($this->validated('basic_salary') ?? 0.00),
            'daily_rate' => (float) ($this->validated('daily_rate') ?? 0.00),
            'hourly_rate' => (float) ($this->validated('hourly_rate') ?? 0.00),
            'effective_date' => $this->validated('effective_date'),
        ];
    }

    /**
     * Extract bank info fields.
     *
     * @return array<string, mixed>
     */
    public function bankData(): array
    {
        $accountNo = $this->validated('account_no');
        if (empty($accountNo)) {
            return [];
        }

        return [
            'bank_code' => $this->validated('bank_code'),
            'bank_name' => $this->validated('bank_name'),
            'branch_name' => $this->validated('branch_name'),
            'account_no' => $accountNo,
            'account_holder_name' => $this->validated('account_holder_name'),
        ];
    }

    /**
     * Extract EPF info fields.
     *
     * @return array<string, mixed>
     */
    public function epfData(): array
    {
        return [
            'is_epf_member' => (bool) $this->validated('is_epf_member', true),
            'epf_no' => $this->validated('epf_no'),
        ];
    }
}
