# Payslip Layout & PDF Specification

- Rendered via DomPDF (`resources/views/pdf/payslip.blade.php`).
- Header: Tenant logo, company name, BR number, month/year.
- Employee Block: Name, Emp ID, Department, EPF Number, Bank Account (masked).
- Tables: Two-column grid comparing Earnings vs Deductions.
- Footer: Net Pay highlighted, Employer contributions (EPF 12%, ETF 3%) displayed for transparency.
