# M03 Data Models & Schema

- `payroll_runs`: `id` (ULID), `tenant_id`, `period_year`, `period_month`, `status` (draft/processing/approved/locked), `total_gross`, `total_net`, `total_epf_employee`, `total_epf_employer`, `total_etf`, `run_by`, `approved_by`, timestamps.
- `payroll_employees`: `id` (ULID), `tenant_id`, `payroll_run_id`, `employee_id`, `payment_mode`, `worked_days`, `no_pay_days`, `ot_hours`, `basic_salary`, `gross_pay`, `epf_employee`, `epf_employer`, `etf_employer`, `apit_tax`, `net_pay`, `breakdown_json`, timestamps.
- `apit_tax_slabs`: `id`, `tenant_id`, `tax_year`, `lower_limit`, `upper_limit`, `rate_percentage`, timestamps.
- `bank_export_logs`: `id`, `tenant_id`, `payroll_run_id`, `bank_code`, `file_path`, `record_count`, `total_amount`, timestamps.
