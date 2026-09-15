# ADR-005: Biometric Machine Import via Adapter Pattern

## Context
Clients utilize varied biometric devices (ZKTeco, FingerTec, Realand, etc.) exporting data in distinct formats (DAT, CSV, Excel, TXT).

## Decision
Design an extensible `BiometricImportAdapterInterface` that decouples file ingestion and column parsing from core attendance ledger creation.
