# Biometric File Import Specification

## 1. Supported File Types
- **ZKTeco Standard DAT**: Space/Tab separated (`EmpID`, `DateTime`, `Status`, `VerifyCode`).
- **Generic CSV**: Tenant-configurable headers or index-based column mappings.
- **Excel XLSX**: Sheet-based row iteration using Laravel-Excel/Spout.

## 2. Ingestion Flow
1. File upload to private storage.
2. Tenant selects configured adapter format.
3. Queue job reads rows and parses employee biometric IDs.
4. Validation highlights unmapped employee IDs or malformed timestamps.
5. User confirms commit -> logs stored -> daily calculation job queued.
