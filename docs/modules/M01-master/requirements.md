# M01 Requirements Specification

## 1. Multi-Tenant Organization Setup
- Maintain Company Profile (BR number, Tax ID, EPF/ETF Employer Numbers, Primary Logo).
- Branch management supporting one company with multiple physical branches.
- Department tree structure supporting sub-departments and cost centers.
- Designation master linked to optional Wages Board classifications.

## 2. Employee Profile & Records
- Personal data: NIC, full name, gender, contact details, emergency contacts.
- Employment classifications: Permanent, Probationary, Contract, Casual, Part-Time.
- Payment mode settings:
  - **Monthly Salaried**: Base salary + regular allowances.
  - **Daily Rate**: Set daily wage rate compliant with Wages Board minimums.
  - **Hourly Rate**: Base hourly rate with standard/overtime distinctions.
- Bank details: Bank code, branch, account number (encrypted).
- EPF/ETF membership flag with individual member number.
- Biometric machine device ID mapping.
