# M03 Requirements Specification

## 1. Multi-Mode Wage Computation
- **Monthly Salaried**:
  - `Gross = Basic + Fixed Allowances + Variable Incentives`
  - `No-Pay Deduction = (Basic / Total Working Days) * No-Pay Days`
  - `Overtime Pay = Hourly Rate * 1.5 * Overtime Hours`
- **Daily Rate**:
  - `Gross = (Daily Rate * Worked Days) + Overtime Pay + Allowances`
- **Hourly Rate**:
  - `Gross = (Hourly Rate * Standard Hours Worked) + (Hourly Rate * 1.5 * OT Hours) + Allowances`

## 2. Statutory Contributions (EPF & ETF)
- Configurable per tenant via `epf_enabled`.
- Employee EPF: 8% of EPF-eligible earnings (Basic + COLA).
- Employer EPF: 12% of EPF-eligible earnings.
- Employer ETF: 3% of total gross earnings.
- Automated EPF Form C / R2 schedule generation.

## 3. APIT (Advance Personal Income Tax)
- Built into **Phase 1** compliant with Inland Revenue Department (IRD) tax slabs.
- Annual projected progressive calculation divided into monthly withholdings.

## 4. Bank Payment Disbursal Files
- Export bulk payment formats for:
  - Bank of Ceylon (BoC)
  - Commercial Bank of Ceylon
  - Sampath Bank
  - Hatton National Bank (HNB)
  - People's Bank
  - National Savings Bank (NSB)
