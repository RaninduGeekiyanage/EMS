# M01 Data Models & Schema

## Tables Schema Outline
- `tenants`: `id` (ULID), `name`, `slug`, `is_active`, timestamps.
- `tenant_settings`: `id`, `tenant_id`, `key`, `value`, timestamps.
- `companies`: `id` (ULID), `tenant_id`, `name`, `br_number`, `epf_number`, `etf_number`, `logo_path`, timestamps.
- `branches`: `id` (ULID), `tenant_id`, `company_id`, `name`, `address`, `phone`, timestamps.
- `departments`: `id` (ULID), `tenant_id`, `name`, `code`, `parent_id` (nullable), `cost_center`, timestamps, `deleted_at`.
- `designations`: `id` (ULID), `tenant_id`, `title`, `grade`, `wages_board_category_id`, timestamps, `deleted_at`.
- `employees`: `id` (ULID), `tenant_id`, `emp_no` (unique per tenant), `nic` (encrypted), `full_name`, `email`, `phone`, `department_id`, `designation_id`, `branch_id`, `employment_type`, `employment_status`, `biometric_device_id`, timestamps, `deleted_at`.
- `employee_payment_info`: `id` (ULID), `tenant_id`, `employee_id`, `payment_mode` (monthly/daily/hourly), `basic_salary`, `daily_rate`, `hourly_rate`, `effective_date`, timestamps.
- `employee_bank_info`: `id` (ULID), `tenant_id`, `employee_id`, `bank_code`, `branch_name`, `account_no` (encrypted), timestamps.
- `employee_epf_info`: `id` (ULID), `tenant_id`, `employee_id`, `is_epf_member`, `epf_no`, timestamps.
