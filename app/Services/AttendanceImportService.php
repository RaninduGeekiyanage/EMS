<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\BiometricImportAdapterInterface;
use App\Models\AttendanceImport;
use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Services\Biometric\ExcelAdapter;
use App\Services\Biometric\GenericCsvAdapter;
use App\Services\Biometric\ZKTecoAdapter;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class AttendanceImportService
{
    /**
     * Resolve the adapter instance based on format type.
     */
    public function getAdapter(string $type): BiometricImportAdapterInterface
    {
        return match (strtolower($type)) {
            'zkteco', 'zk', 'dat' => new ZKTecoAdapter,
            'generic_csv', 'csv' => new GenericCsvAdapter,
            'excel', 'xlsx', 'xls' => new ExcelAdapter,
            default => throw new Exception("Unsupported biometric adapter type: '{$type}'"),
        };
    }

    /**
     * Preview an uploaded attendance file without committing records to the database.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public function previewImport(UploadedFile $file, string $adapterType, array $config = []): array
    {
        $adapter = $this->getAdapter($adapterType);
        $tempPath = $file->getRealPath();

        $rawRecords = $adapter->parse($tempPath, $config);
        $validation = $adapter->validate($rawRecords);

        // Preload tenant employees mapped by biometric_device_id and emp_no
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $employeesQuery = Employee::query()->with('department:id,name');
        if ($tenantId !== null) {
            $employeesQuery->where('tenant_id', $tenantId);
        }
        $employees = $employeesQuery->get();

        $employeeByBioId = [];
        $employeeByEmpNo = [];

        foreach ($employees as $employee) {
            if (! empty($employee->biometric_device_id)) {
                $employeeByBioId[trim((string) $employee->biometric_device_id)] = $employee;
            }
            $employeeByEmpNo[trim((string) $employee->emp_no)] = $employee;
        }

        $mappedCount = 0;
        $unmappedCount = 0;
        $unmappedIds = [];
        $previewRows = [];
        $seenPunches = [];

        foreach ($validation['valid_records'] as $record) {
            $bioId = $record['biometric_id'];
            $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;

            $punchKey = ($matchedEmployee ? $matchedEmployee->id : $bioId).'_'.$record['punch_datetime'].'_'.$record['punch_type'];
            $isDuplicateInFile = isset($seenPunches[$punchKey]);
            $seenPunches[$punchKey] = true;

            $status = 'ready';
            if ($isDuplicateInFile) {
                $status = 'duplicate';
            } elseif ($matchedEmployee === null) {
                $status = 'unmapped';
                $unmappedCount++;
                $unmappedIds[$bioId] = ($unmappedIds[$bioId] ?? 0) + 1;
            } else {
                $mappedCount++;
            }

            if (count($previewRows) < 100) {
                $previewRows[] = [
                    'line_number' => $record['line_number'],
                    'biometric_id' => $bioId,
                    'matched_employee' => $matchedEmployee ? [
                        'id' => $matchedEmployee->id,
                        'full_name' => $matchedEmployee->full_name,
                        'emp_no' => $matchedEmployee->emp_no,
                        'department' => $matchedEmployee->department?->name ?? 'N/A',
                    ] : null,
                    'punch_datetime' => $record['punch_datetime'],
                    'punch_type' => $record['punch_type'],
                    'device_id' => $record['device_id'],
                    'status' => $status,
                ];
            }
        }

        // Formatted list of unique unmapped biometric IDs
        $uniqueUnmappedList = [];
        foreach ($unmappedIds as $id => $occurrences) {
            $uniqueUnmappedList[] = [
                'biometric_id' => (string) $id,
                'occurrences' => $occurrences,
            ];
        }

        return [
            'total_rows' => $validation['summary']['total'],
            'valid_rows' => $validation['summary']['valid'],
            'invalid_rows' => $validation['summary']['invalid'],
            'mapped_count' => $mappedCount,
            'unmapped_count' => $unmappedCount,
            'unique_unmapped' => $uniqueUnmappedList,
            'preview_rows' => $previewRows,
            'invalid_records' => array_slice($validation['invalid_records'], 0, 20),
        ];
    }

    /**
     * Commit an attendance file import, persisting the import job and all valid logs.
     *
     * @param  array<string, mixed>  $config
     */
    public function commitImport(
        UploadedFile $file,
        string $adapterType,
        ?int $userId = null,
        array $config = []
    ): AttendanceImport {
        $adapter = $this->getAdapter($adapterType);
        $originalFilename = $file->getClientOriginalName();
        $tempPath = $file->getRealPath();

        // 1. Parse and validate
        $rawRecords = $adapter->parse($tempPath, $config);
        $validation = $adapter->validate($rawRecords);

        // 2. Resolve tenant
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        if (! $tenantId) {
            $firstEmployee = Employee::first();
            $tenantId = $firstEmployee?->tenant_id;
        }

        if (! $tenantId) {
            throw new Exception('Cannot determine tenant for attendance import.');
        }

        // Store file in private storage
        $storagePath = $file->store("attendance-imports/{$tenantId}", 'local');

        // 3. Preload employee mappings
        $employees = Employee::where('tenant_id', $tenantId)
            ->get(['id', 'tenant_id', 'emp_no', 'biometric_device_id']);

        $employeeByBioId = [];
        $employeeByEmpNo = [];
        foreach ($employees as $employee) {
            if (! empty($employee->biometric_device_id)) {
                $employeeByBioId[trim((string) $employee->biometric_device_id)] = $employee;
            }
            $employeeByEmpNo[trim((string) $employee->emp_no)] = $employee;
        }

        return DB::transaction(function () use (
            $tenantId,
            $originalFilename,
            $storagePath,
            $adapterType,
            $userId,
            $validation,
            $employeeByBioId,
            $employeeByEmpNo
        ): AttendanceImport {
            $import = AttendanceImport::create([
                'tenant_id' => $tenantId,
                'filename' => $originalFilename,
                'file_path' => $storagePath,
                'adapter_type' => $adapterType,
                'total_rows' => $validation['summary']['total'],
                'processed_rows' => 0,
                'failed_rows' => 0,
                'status' => 'processing',
                'imported_by' => $userId,
                'errors' => [],
            ]);

            $punchesToInsert = [];
            $unmappedPunches = [];
            $insertedCount = 0;
            $failedCount = $validation['summary']['invalid'];
            $now = Carbon::now();

            foreach ($validation['valid_records'] as $record) {
                $bioId = $record['biometric_id'];
                $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;

                if ($matchedEmployee === null) {
                    $unmappedPunches[] = [
                        'biometric_id' => $bioId,
                        'punch_datetime' => $record['punch_datetime'],
                        'reason' => 'Unmapped Biometric ID',
                    ];
                    $failedCount++;

                    continue;
                }

                $punchesToInsert[] = [
                    'id' => (string) Str::ulid(),
                    'tenant_id' => $tenantId,
                    'employee_id' => $matchedEmployee->id,
                    'punch_datetime' => $record['punch_datetime'],
                    'punch_type' => $record['punch_type'],
                    'device_id' => $record['device_id'] ?? null,
                    'raw_biometric_id' => $bioId,
                    'import_id' => $import->id,
                    'source' => 'import',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // Insert punches in chunks with duplicate protection
            if (! empty($punchesToInsert)) {
                foreach (array_chunk($punchesToInsert, 500) as $chunk) {
                    // Use insertOrIgnore to skip identical (tenant_id, employee_id, punch_datetime, punch_type) records
                    $inserted = DB::table('attendance_logs')->insertOrIgnore($chunk);
                    $insertedCount += $inserted;
                }
            }

            // Compile error / warning summaries
            $errors = [];
            if (! empty($unmappedPunches)) {
                $errors['unmapped_punches_count'] = count($unmappedPunches);
                $errors['unmapped_samples'] = array_slice($unmappedPunches, 0, 50);
            }
            if (! empty($validation['invalid_records'])) {
                $errors['invalid_records_count'] = count($validation['invalid_records']);
                $errors['invalid_samples'] = array_slice($validation['invalid_records'], 0, 50);
            }

            $finalStatus = 'completed';
            if ($insertedCount === 0 && $failedCount > 0) {
                $finalStatus = 'failed';
            } elseif ($failedCount > 0) {
                $finalStatus = 'partial';
            }

            $import->update([
                'processed_rows' => $insertedCount,
                'failed_rows' => $failedCount,
                'status' => $finalStatus,
                'errors' => $errors,
            ]);

            return $import;
        });
    }

    /**
     * List past attendance imports with pagination.
     */
    public function listImports(int $perPage = 15): LengthAwarePaginator
    {
        return AttendanceImport::query()
            ->with(['importedBy:id,name,email'])
            ->withCount('logs')
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Delete an import batch and roll back its imported attendance logs.
     */
    public function deleteImport(AttendanceImport $import): bool
    {
        return DB::transaction(static function () use ($import): bool {
            // Delete associated logs
            AttendanceLog::where('import_id', $import->id)->delete();

            // Delete storage file if exists
            if ($import->file_path && Storage::disk('local')->exists($import->file_path)) {
                Storage::disk('local')->delete($import->file_path);
            }

            return (bool) $import->delete();
        });
    }

    /**
     * Map a raw biometric ID to an employee profile.
     */
    public function mapBiometricIdToEmployee(string $employeeId, string $biometricId): Employee
    {
        $employee = Employee::findOrFail($employeeId);
        $employee->update(['biometric_device_id' => trim($biometricId)]);

        return $employee;
    }

    /**
     * Get statistics for the attendance ingestion dashboard.
     *
     * @return array<string, mixed>
     */
    public function getDashboardStats(): array
    {
        $totalLogs = AttendanceLog::count();
        $totalImports = AttendanceImport::count();
        $lastImport = AttendanceImport::latest()->first();

        // Employees with missing biometric IDs
        $employeesWithoutBioId = Employee::where(static function ($q) {
            $q->whereNull('biometric_device_id')->orWhere('biometric_device_id', '');
        })->count();

        $totalEmployees = Employee::count();

        return [
            'total_logs' => $totalLogs,
            'total_imports' => $totalImports,
            'last_import_date' => $lastImport?->created_at?->toIso8601String(),
            'last_import_status' => $lastImport?->status ?? 'none',
            'unmapped_employees_count' => $employeesWithoutBioId,
            'total_employees' => $totalEmployees,
        ];
    }

    /**
     * Generate sample template content for download.
     *
     * @return array{content: string, filename: string, mime: string}
     */
    public function getSampleTemplate(string $type): array
    {
        return match (strtolower($type)) {
            'zkteco', 'zk', 'dat' => [
                'content' => "1001\t2026-03-01 08:30:15\t0\t1\n1001\t2026-03-01 17:05:22\t1\t1\n1002\t2026-03-01 08:45:00\t0\t1\n1002\t2026-03-01 17:15:30\t1\t1\n1003\t2026-03-01 09:00:10\t0\t1\n",
                'filename' => 'zkteco_sample_attendance.dat',
                'mime' => 'text/plain',
            ],
            'excel', 'xlsx' => [
                // Minimal valid CSV format that Excel opens natively
                'content' => "biometric_id,punch_datetime,punch_type,device_id\n1001,2026-03-01 08:30:00,in,DEV-01\n1001,2026-03-01 17:00:00,out,DEV-01\n1002,2026-03-01 08:45:00,in,DEV-01\n1002,2026-03-01 17:15:00,out,DEV-01\n",
                'filename' => 'attendance_import_template.csv',
                'mime' => 'text/csv',
            ],
            default => [
                'content' => "biometric_id,punch_datetime,punch_type,device_id\n1001,2026-03-01 08:30:00,in,DEV-01\n1001,2026-03-01 17:00:00,out,DEV-01\n1002,2026-03-01 08:45:00,in,DEV-01\n1002,2026-03-01 17:15:00,out,DEV-01\n",
                'filename' => 'generic_attendance_template.csv',
                'mime' => 'text/csv',
            ],
        };
    }
}
