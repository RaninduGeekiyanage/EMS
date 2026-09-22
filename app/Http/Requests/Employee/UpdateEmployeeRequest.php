<?php

declare(strict_types=1);

namespace App\Http\Requests\Employee;

use App\Enums\EmploymentType;
use App\Enums\PaymentMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

final class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null || $this->user()->can('employee.update');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Employee Core
            'emp_no' => ['sometimes', 'required', 'string', 'max:50'],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'nic' => ['sometimes', 'required', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'department_id' => ['nullable', 'string'],
            'designation_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'employment_type' => ['sometimes', 'required', new Enum(EmploymentType::class)],
            'employment_category' => ['nullable', 'string', 'in:shop_and_office,wages_board'],
            'gender' => ['nullable', 'string', 'in:male,female,other'],
            'date_of_birth' => ['nullable', 'date'],
            'marital_status' => ['nullable', 'string', 'max:50'],
            'permanent_address' => ['nullable', 'string', 'max:500'],
            'temporary_address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'landline' => ['nullable', 'string', 'max:50'],
            'attendance_mode' => ['nullable', 'string', 'in:both,biometric,manual,general,shift'],
            'job_grade_id' => ['nullable', 'string'],
            'wages_board_category_id' => ['nullable', 'string'],
            'employment_status' => ['sometimes', 'required', 'string', 'in:active,resigned,terminated,suspended'],
            'date_of_joining' => ['nullable', 'date'],
            'biometric_device_id' => ['nullable', 'string', 'max:50'],

            // Payment Info
            'payment_mode' => ['sometimes', 'required', new Enum(PaymentMode::class)],
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
            'is_epf_member' => ['nullable', 'boolean'],
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
        return array_filter([
            'emp_no' => $this->validated('emp_no'),
            'full_name' => $this->validated('full_name'),
            'gender' => $this->validated('gender'),
            'date_of_birth' => $this->validated('date_of_birth'),
            'marital_status' => $this->validated('marital_status'),
            'nic' => $this->validated('nic'),
            'email' => $this->validated('email'),
            'phone' => $this->validated('phone'),
            'permanent_address' => $this->validated('permanent_address'),
            'temporary_address' => $this->validated('temporary_address'),
            'city' => $this->validated('city'),
            'landline' => $this->validated('landline'),
            'department_id' => $this->validated('department_id'),
            'designation_id' => $this->validated('designation_id'),
            'branch_id' => $this->validated('branch_id'),
            'job_grade_id' => $this->validated('job_grade_id'),
            'wages_board_category_id' => $this->validated('wages_board_category_id'),
            'employment_type' => $this->validated('employment_type'),
            'employment_category' => $this->validated('employment_category'),
            'employment_status' => $this->validated('employment_status'),
            'attendance_mode' => $this->validated('attendance_mode'),
            'date_of_joining' => $this->validated('date_of_joining'),
            'biometric_device_id' => $this->validated('biometric_device_id'),
        ], fn ($val) => $val !== null);
    }

    /**
     * Extract payment configuration fields.
     *
     * @return array<string, mixed>|null
     */
    public function paymentData(): ?array
    {
        if (! $this->has('payment_mode') && ! $this->has('basic_salary')) {
            return null;
        }

        return [
            'payment_mode' => $this->validated('payment_mode') ?? 'monthly',
            'basic_salary' => (float) ($this->validated('basic_salary') ?? 0.00),
            'daily_rate' => (float) ($this->validated('daily_rate') ?? 0.00),
            'hourly_rate' => (float) ($this->validated('hourly_rate') ?? 0.00),
            'effective_date' => $this->validated('effective_date'),
        ];
    }

    /**
     * Extract bank info fields.
     *
     * @return array<string, mixed>|null
     */
    public function bankData(): ?array
    {
        if (! $this->has('account_no') && ! $this->has('bank_name')) {
            return null;
        }

        return [
            'bank_code' => $this->validated('bank_code'),
            'bank_name' => $this->validated('bank_name'),
            'branch_name' => $this->validated('branch_name'),
            'account_no' => $this->validated('account_no') ?? '',
            'account_holder_name' => $this->validated('account_holder_name'),
        ];
    }

    /**
     * Extract EPF info fields.
     *
     * @return array<string, mixed>|null
     */
    public function epfData(): ?array
    {
        if (! $this->has('is_epf_member') && ! $this->has('epf_no')) {
            return null;
        }

        return [
            'is_epf_member' => (bool) $this->validated('is_epf_member', true),
            'epf_no' => $this->validated('epf_no'),
        ];
    }
}
