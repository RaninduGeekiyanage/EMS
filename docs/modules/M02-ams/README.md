# M02: Attendance Management System (AMS)

## 1. Overview
M02 handles work calendars, holiday management, shift definitions, attendance log ingestion via file adapters, automated daily attendance computation, Sri Lanka compliant overtime (OT), late arrivals, and comprehensive leave management.

## 2. Dependencies
Requires **M01 (Organization & Employee Master)** complete and signed off.

## 3. Core Capabilities
- Text file upload adapter (ZKTeco DAT, generic CSV, Excel XLSX, pipe/tab delimited).
- Automatic matching of biometric device ID to employee profile.
- Daily attendance categorization: Present, Absent, Half-Day, On Leave, Public Holiday.
- Overtime calculation: Weekday standard OT (1.5x), Sunday rest day (1.5x), Public & Poya holidays (2.0x).
- Leave management: Annual (14d), Casual (7d), Sick (7d), Maternity (84d), No-pay.
