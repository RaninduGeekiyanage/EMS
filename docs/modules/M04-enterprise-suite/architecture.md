# M04: Data Models & Architecture

## 1. Entity-Relationship Overview

```
                               ┌────────────────────────┐
                               │        Tenants         │
                               └───────────┬────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│    Pay Items     │             │  Compensatory    │             │   Attendance     │
│   (Master Data)  │             │   Off Ledger     │             │ Regularizations  │
└────────┬─────────┘             └─────────┬────────┘             └────────┬─────────┘
         │                                 │                               │
         │ 1:N                             │ 1:N                           │ 1:N
         ▼                                 ▼                               ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│  Employee Pay    │             │   Leave Request  │             │   Attendance     │
│  Items Profile   │◄────────────┤  (Enhanced with  │◄────────────┤   Daily Ledger   │
└────────┬─────────┘             │  Short Leave)    │             │ (Approved OT)    │
         │                       └──────────────────┘             └────────┬─────────┘
         │                                 │                               │
         │                                 ▼                               │
         │                       ┌──────────────────┐                      │
         │                       │    Employee      │                      │
         │                       │   Evaluations    │                      │
         │                       └──────────────────┘                      │
         │                                                                 │
         └─────────────────────────────────┬───────────────────────────────┘
                                           ▼
                                 ┌──────────────────┐
                                 │   Payroll Run    │
                                 │  & Line Items    │
                                 └──────────────────┘
```

## 2. Database Tables & Schemas

### 1. `pay_items`
```sql
CREATE TABLE pay_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'earning', 'deduction'
    category VARCHAR(50) NOT NULL, -- 'basic', 'statutory_allowance', 'fixed_allowance', 'variable_allowance', 'loan', 'welfare', 'penalty'
    is_epf_liable BOOLEAN NOT NULL DEFAULT FALSE,
    is_etf_liable BOOLEAN NOT NULL DEFAULT FALSE,
    is_apit_liable BOOLEAN NOT NULL DEFAULT FALSE,
    is_recurring BOOLEAN NOT NULL DEFAULT TRUE,
    calculation_type VARCHAR(30) NOT NULL DEFAULT 'fixed', -- 'fixed', 'percentage_of_basic', 'attendance_linked', 'formula'
    calculation_value DECIMAL(12, 4) DEFAULT 0.00,
    formula_expression VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_tenant_pay_item_code UNIQUE (tenant_id, code)
);
```

### 2. `employee_pay_items`
```sql
CREATE TABLE employee_pay_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    pay_item_id UUID NOT NULL REFERENCES pay_items(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 3. `employee_loans` & `employee_loan_installments`
```sql
CREATE TABLE employee_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    loan_number VARCHAR(50) NOT NULL,
    principal_amount DECIMAL(12, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    total_repayable DECIMAL(12, 2) NOT NULL,
    monthly_installment DECIMAL(12, 2) NOT NULL,
    total_installments INT NOT NULL,
    remaining_balance DECIMAL(12, 2) NOT NULL,
    start_year INT NOT NULL,
    start_month INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'settled', 'suspended'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 4. `payroll_monthly_adjustments` (Ad-hoc Variable Earnings & Deductions)
```sql
CREATE TABLE payroll_monthly_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    pay_item_id UUID NOT NULL REFERENCES pay_items(id) ON DELETE CASCADE,
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 5. `attendance_regularization_requests`
```sql
CREATE TABLE attendance_regularization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    request_type VARCHAR(30) NOT NULL, -- 'missing_punch', 'unapproved_half_day', 'on_duty_gate_pass', 'overtime_claim'
    requested_check_in TIMESTAMP NULL,
    requested_check_out TIMESTAMP NULL,
    reason TEXT NOT NULL,
    attachment_path VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_hod', -- 'pending_hod', 'pending_hr', 'approved', 'rejected'
    hod_id UUID NULL REFERENCES users(id),
    hod_actioned_at TIMESTAMP NULL,
    hod_remarks TEXT NULL,
    hr_id UUID NULL REFERENCES users(id),
    hr_actioned_at TIMESTAMP NULL,
    is_bypassed_by_hr BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason TEXT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 6. `compensatory_leave_records` (C-Off Balance Ledger)
```sql
CREATE TABLE compensatory_leave_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    earned_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    credit_days DECIMAL(3, 1) NOT NULL DEFAULT 1.0, -- 0.5 or 1.0
    used_days DECIMAL(3, 1) NOT NULL DEFAULT 0.0,
    status VARCHAR(20) NOT NULL DEFAULT 'available', -- 'available', 'utilized', 'expired'
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 7. `employee_evaluations` (HOD Performance / KPI Appraisal)
```sql
CREATE TABLE employee_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id), -- HOD user
    evaluation_period VARCHAR(50) NOT NULL, -- 'Annual 2026', 'Q1 2026', 'Probation'
    evaluation_date DATE NOT NULL,
    ratings_json JSONB NOT NULL, -- structured categories (punctuality, work_quality, teamwork, kpi_achieved)
    overall_score DECIMAL(5, 2) NOT NULL, -- e.g. 85.50 / 100
    hod_comments TEXT NULL,
    hr_reviewer_id UUID NULL REFERENCES users(id),
    hr_comments TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted_to_hr', -- 'draft', 'submitted_to_hr', 'confirmed_by_hr', 'archived'
    is_bypassed_by_hr BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 8. Enhancements to Existing Tables:
- **`attendance_dailies`**:
  - Add `approved_ot_hours` (DECIMAL(5, 2) NULL)
  - Add `approved_double_ot_hours` (DECIMAL(5, 2) NULL)
  - Add `ot_approval_status` (VARCHAR(20) DEFAULT 'pending') -- 'pending', 'hod_approved', 'hr_confirmed', 'rejected'
  - Add `ot_approved_by` (UUID NULL REFERENCES users(id))
- **`leave_requests`**:
  - Add `is_short_leave` (BOOLEAN DEFAULT FALSE)
  - Add `short_leave_from` (TIME NULL)
  - Add `short_leave_to` (TIME NULL)
  - Add `short_leave_duration_minutes` (INT NULL)
  - Add `covering_employee_id` (UUID NULL REFERENCES employees(id))
  - Add `approval_stage` (VARCHAR(20) DEFAULT 'pending_hod') -- 'pending_hod', 'pending_hr', 'approved', 'rejected'
  - Add `is_bypassed_by_hr` (BOOLEAN DEFAULT FALSE)
- **`tenant_settings`**:
  - `short_leave_monthly_quota`: Default 2
  - `short_leave_max_minutes`: Default 90
  - `payroll_cut_off_mode`: 'calendar' (1st–31st) or 'custom'
  - `payroll_cut_off_start_day`: Default 1
  - `payroll_cut_off_end_day`: Default 31
  - `ot_normal_rate`: Default 1.50
  - `ot_rest_day_rate`: Default 2.00
  - `ot_holiday_rate`: Default 2.00
