# PHP Conventions & Guidelines

## 1. Strict Typing
All PHP files must include `declare(strict_types=1);` immediately after opening tags.

## 2. Layered Pattern
- **Repositories**: Encapsulate Eloquent queries. Always inject via interfaces.
- **Services**: Pure business logic, calculation engines, and third-party interactions.
- **Controllers**: Thin controllers, accepting FormRequests, dispatching to services, and returning Inertia responses.

## 3. Mandatory Database Transaction Integrity (`DB::transaction`)
- Any service, controller, or action performing **multi-table writes**, **multi-record mutations**, or **batch generation** MUST wrap the operation inside `DB::transaction(static function () { ... })` or `DB::transaction(function () use (...) { ... })`.
- Never leave partial writes or orphaned records on failure. If any single query or validation check fails, the entire database transaction must roll back cleanly.
- Examples across the codebase:
  - `AttendanceProcessingService::processDate` (atomic daily attendance ledger persistence)
  - `LeaveService::allocateEntitlements` (atomic annual quota allocations)
  - `LeaveService::seedStatutoryTypes` (atomic statutory preset seeding)
  - `ShiftService::seedSriLankanHolidays` (atomic statutory calendar seeding)
  - `RosterService::generateRoster`, `updateEntry`, `swapShift`, `publishRoster`, `clearRoster`
  - `PayrollCalculationService::calculateRun` (atomic salary & statutory tax calculations)
  - `EmployeeService::createEmployee`, `updateEmployee` (atomic master + bank + statutory records)

## 4. High-Volume Bulk Data & Memory Optimization
- **Do not hydrate large Eloquent collections in memory** when processing hundreds or thousands of rows (e.g. multi-month rosters, biometric punch files).
- **Chunked Operations**: Split raw arrays into batches of **250 to 500 records**:
  - Use native database `upsert` (e.g. `RosterEntry::upsert($chunk, [...], [...])`) for idempotent batch synchronization.
  - Use `insertOrIgnore` (e.g. `DB::table('attendance_logs')->insertOrIgnore($chunk)`) for high-throughput punch ingestion with duplicate filtering.
- Ensure PHP peak memory overhead remains below 10 MB and processes complete well within standard shared-hosting timeouts (30–60s).

## 5. UI Responsive Feedback for Bulk Requests
- Every frontend Inertia/React page that initiates a bulk database operation (attendance calculation, biometric import, roster generation, payroll runs, leave allocations) must provide:
  - Immediate disabling of submit buttons.
  - A centered, full-screen glassmorphic loading spinner overlay (`backdrop-blur-sm`) to indicate server transaction progress and prevent duplicate submissions or browser unresponsiveness.

