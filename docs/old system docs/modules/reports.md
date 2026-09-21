# Module: Reports

## Overview

Dynamic employee reporting with configurable field selection, multi-level filtering, and export to PDF/Excel.

---

## Implemented Reports

### Employee Report

**Route:** `/ems/employee`

**Features:**
- Multi-level filtering: Company → Branch → Department → Employment Category → Employment Status
- Dynamic field selection (28 available fields)
- Export to PDF (jsPDF + autoTable)
- Export to Excel (SheetJS)
- Active status toggle

---

## Report Filters

| Filter | Type | Options |
|---|---|---|
| `company` | Select | "All" or specific company ID |
| `branch` | Select | "All" or specific branch ID |
| `department` | Select | "All" or specific department ID |
| `employmentCategory` | Select | Required (SHOP_AND_OFFICE, WAGES_BOARD) |
| `employmentStatus` | Select | Required (PROBATION, PERMANENT, CONTRACT) |
| `activeStatus` | Toggle | Optional boolean |
| `selectedFields` | Multi-select | Min 1 field required |

---

## Available Report Fields

| Field ID | Label | Type |
|---|---|---|
| `id` | ID | Number |
| `empNo` | Employee Number | Number |
| `email` | Email | String |
| `firstName` | First Name | String |
| `lastName` | Last Name | String |
| `fullName` | Full Name | String |
| `gender` | Gender | String |
| `dateOfBirth` | Date of Birth | Date |
| `dateOfAppointment` | Date of Appointment | Date |
| `dateOfResignation` | Date of Resignation | Date |
| `nic` | NIC | String |
| `maritalStatus` | Marital Status | String |
| `mobileNo` | Mobile Number | String |
| `landNo` | Land Number | String |
| `permanentAddress` | Permanent Address | String |
| `tempAddress` | Temporary Address | String |
| `activeStatus` | Active Status | Boolean |
| `empStatusFlag` | Employee Status Flag | Boolean |
| `rosterFlag` | Roster Flag | String |
| `branch` | Branch | Relation (name) |
| `city` | City | String |
| `company` | Company | Relation (name) |
| `department` | Department | Relation (name) |
| `designation` | Designation | Relation (name) |
| `ocGrade` | OC Grade | Relation |
| `employmentStatus` | Employment Status | Enum |
| `employmentCategory` | Employment Category | Enum |
| `jobCategory` | Job Category | Relation (name) |
| `createdAt` | Created Date | DateTime |
| `updatedAt` | Updated Date | DateTime |

---

## Export Specifications

### PDF Export

| Property | Value |
|---|---|
| **Library** | jsPDF + jspdf-autotable |
| **Page Size** | A4 |
| **Orientation** | Portrait (≤6 fields), Landscape (>6 fields) |
| **Header** | "Employee Report" + generated timestamp + record count |
| **Table Style** | Grid theme, blue header (#2980B3) |
| **Font Size** | 8pt normal, 6pt for >8 fields |
| **Column Width** | Dates: 25mm, IDs: 15mm, Addresses: 35mm, Others: auto |
| **Page Break** | Auto with headers on every page |
| **Save Path** | `public/exports/employee-report-{timestamp}.pdf` |

### Excel Export

| Property | Value |
|---|---|
| **Library** | SheetJS (xlsx) |
| **Format** | .xlsx with compression |
| **Sheet 1** | "Employee Data" — filtered records |
| **Sheet 2** | "Report Information" — applied filters, generation metadata |
| **Column Width** | 20 characters each |
| **Save Path** | `public/exports/employee-report-{timestamp}.xlsx` |
| **Fallback** | Temp directory if public dir write fails |

---

## Server Actions

| Action | File | Description |
|---|---|---|
| `generateEmployeeReport` | `employee-report-actions.ts` | Validate filters, count matching records |
| `getEmployeeReportData` | `employee-report-actions.ts` | Fetch data with dynamic field selection |
| `exportReportToPDF` | `employee-report-actions.ts` | Generate and save PDF |
| `exportReportToExcel` | `employee-report-actions.ts` | Generate and save Excel with multi-fallback |
