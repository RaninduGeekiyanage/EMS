# M02 Data Models & Schema

- `shifts`: `id` (ULID), `tenant_id`, `name`, `start_time`, `end_time`, `break_minutes`, `grace_minutes`, `ot_threshold_minutes`, `is_night_shift`, timestamps.
- `shift_assignments`: `id`, `tenant_id`, `employee_id`, `shift_id`, `effective_from`, `effective_to`, timestamps.
- `roster_entries`: `id` (ULID), `tenant_id`, `employee_id`, `roster_date`, `shift_id`, `schedule_type` (shift/rest_day/off), `status` (draft/published/locked), `is_overridden`, `notes`, `created_by`, timestamps.
- `roster_patterns`: `id` (ULID), `tenant_id`, `name`, `code`, `pattern_type` (daily/weekly/cyclical), `cycle_length_days`, `pattern_data` (JSON), `is_active`, timestamps.
- `public_holidays`: `id`, `tenant_id`, `holiday_date`, `name`, `type` (statutory/mercantile/poya), timestamps.
- `attendance_imports`: `id` (ULID), `tenant_id`, `filename`, `adapter_type`, `total_rows`, `processed_rows`, `status`, `imported_by`, timestamps.
- `attendance_logs`: `id` (ULID), `tenant_id`, `employee_id`, `punch_datetime`, `punch_type` (in/out), `device_id`, `import_id`, timestamps.
- `attendance_daily`: `id` (ULID), `tenant_id`, `employee_id`, `attendance_date`, `shift_id`, `check_in`, `check_out`, `worked_hours`, `late_minutes`, `ot_hours`, `status` (present/absent/half_day/leave/holiday), `is_manual`, `manual_reason`, timestamps.
- `leave_types`: `id`, `tenant_id`, `name`, `code`, `days_per_year`, `is_paid`, `carry_forward_allowed`, timestamps.
- `leave_entitlements`: `id`, `tenant_id`, `employee_id`, `leave_type_id`, `year`, `allocated_days`, `used_days`, timestamps.
- `leave_requests`: `id` (ULID), `tenant_id`, `employee_id`, `leave_type_id`, `start_date`, `end_date`, `days_count`, `reason`, `status` (pending/approved/rejected), `approved_by`, timestamps.
