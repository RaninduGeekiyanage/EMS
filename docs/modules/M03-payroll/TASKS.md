# M03 — Payroll Detailed Tasks

## Phase 1: Payroll Run Core Engine
- [x] Database Schema & Run Orchestration
  - [x] File: database/migrations/2026_01_01_000060_create_payroll_runs_table.php
  - [x] File: database/migrations/2026_01_01_000061_create_payroll_employees_table.php
  - [x] File: database/migrations/2026_01_01_000062_create_apit_tax_slabs_table.php
  - [x] File: app/Models/PayrollRun.php
  - [x] File: app/Models/PayrollEmployee.php
  - [x] File: app/Services/PayrollCalculationService.php
  - [x] File: app/Http/Controllers/PayrollRunController.php
  - [x] File: resources/js/Pages/Payroll/Index.tsx
  - [x] File: resources/js/Pages/Payroll/Run.tsx

## Phase 2: Statutory Modules (EPF, ETF & APIT)
- [x] Statutory Calculators
  - [x] File: app/Services/Statutory/EpfEtfCalculatorService.php
  - [x] File: app/Services/Statutory/ApitTaxCalculatorService.php
  - [x] File: tests/Unit/Payroll/EpfCalculationTest.php
  - [x] File: tests/Unit/Payroll/ApitCalculationTest.php

## Phase 3: Payslips & Bank Disbursal
- [ ] PDF & Export Engines
  - [ ] File: resources/views/pdf/payslip.blade.php
  - [ ] File: app/Services/PayslipGeneratorService.php
  - [ ] File: app/Services/BankExportService.php
  - [ ] File: app/Services/BankGenerators/BocGenerator.php
  - [ ] File: app/Services/BankGenerators/CommercialBankGenerator.php
  - [ ] File: app/Services/BankGenerators/SampathBankGenerator.php
  - [ ] File: app/Services/BankGenerators/HnbGenerator.php
  - [ ] File: app/Services/BankGenerators/PeoplesBankGenerator.php
  - [ ] File: app/Services/BankGenerators/NsbGenerator.php
  - [ ] File: app/Http/Controllers/PayslipController.php
  - [ ] File: app/Http/Controllers/BankExportController.php
  - [ ] File: tests/Feature/M03/FullPayrollRunTest.php
