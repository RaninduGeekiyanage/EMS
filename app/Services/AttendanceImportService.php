<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\BiometricImportAdapterInterface;
use App\Models\AttendanceImport;
use App\Models\AttendanceLog;
use App\Models\BiometricDeviceProfile;
use App\Models\Employee;
use App\Models\RawBiometricPunch;
use App\Services\Biometric\ConfigurableTextAdapter;
use App\Services\Biometric\DatabaseStagingAdapter;
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
     *
     * @param  array<string, mixed>  $config
     */
    public function getAdapter(string $type, array $config = []): BiometricImportAdapterInterface
    {
        if (strtolower($type) === 'database_staging' || ($config['source_type'] ?? null) === 'database_staging') {
            return new DatabaseStagingAdapter;
        }

        $profile = $config['profile'] ?? null;
        if (! $profile && isset($config['profile_id'])) {
            $profile = BiometricDeviceProfile::find($config['profile_id']);
        }
        if (! $profile && strlen($type) === 26) {
            $profile = BiometricDeviceProfile::find($type);
        }

        if ($profile && $profile->source_type === 'database_staging') {
            return new DatabaseStagingAdapter;
        }

        if ($profile || isset($config['profile']) || isset($config['profile_id']) || in_array(strtolower($type), ['configurable', 'profile'], true)) {
            return new ConfigurableTextAdapter;
        }

        return match (strtolower($type)) {
            'zkteco', 'zk', 'dat' => new ZKTecoAdapter,
            'generic_csv', 'csv' => new GenericCsvAdapter,
            'excel', 'xlsx', 'xls' => new ExcelAdapter,
            'configurable', 'profile' => new ConfigurableTextAdapter,
            'database_staging', 'staging' => new DatabaseStagingAdapter,
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
        $profileId = $config['profile_id'] ?? (strlen($adapterType) === 26 ? $adapterType : null);
        if ($profileId) {
            $profile = BiometricDeviceProfile::find($profileId);
            if ($profile) {
                $config['profile'] = $profile;
                $config['date_format'] = $config['date_format'] ?? $profile->date_format;
            }
        }

        $adapter = $this->getAdapter($adapterType, $config);
        $tempPath = $file->getRealPath();

        $rawRecords = $adapter->parse($tempPath, $config);
        $validation = $adapter->validate($rawRecords, $config);

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

        // Preload existing attendance logs for matched employees in this timeframe to detect duplicates
        $matchedEmpIds = [];
        $punchTimes = [];
        foreach ($validation['valid_records'] as $record) {
            $bioId = $record['biometric_id'];
            $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;
            if ($matchedEmployee !== null) {
                $matchedEmpIds[] = $matchedEmployee->id;
                $punchTimes[] = $record['punch_datetime'];
            }
        }

        $existingLogsMap = $tenantId ? $this->getExistingAttendanceLogsMap($tenantId, $matchedEmpIds, $punchTimes) : [];

        $mappedCount = 0;
        $unmappedCount = 0;
        $duplicateCount = 0;
        $readyCount = 0;
        $unmappedIds = [];
        $previewRows = [];
        $seenPunches = [];

        foreach ($validation['valid_records'] as $record) {
            $bioId = $record['biometric_id'];
            $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;

            $formattedDt = Carbon::parse($record['punch_datetime'])->format('Y-m-d H:i:s');
            $punchKey = ($matchedEmployee ? $matchedEmployee->id : $bioId).'_'.$formattedDt.'_'.$record['punch_type'];
            $isDuplicateInFile = isset($seenPunches[$punchKey]);
            $seenPunches[$punchKey] = true;
            $isAlreadyInLogs = $matchedEmployee && isset($existingLogsMap[$punchKey]);

            $status = 'ready';
            if ($matchedEmployee === null) {
                $status = 'unmapped';
                $unmappedCount++;
                $unmappedIds[$bioId] = ($unmappedIds[$bioId] ?? 0) + 1;
            } elseif ($isAlreadyInLogs || $isDuplicateInFile) {
                $status = 'duplicate';
                $duplicateCount++;
                $mappedCount++;
            } else {
                $status = 'ready';
                $readyCount++;
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
                    'punch_datetime' => $formattedDt,
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
            'ready_count' => $readyCount,
            'duplicate_count' => $duplicateCount,
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
        $profile = null;
        $profileId = $config['profile_id'] ?? (strlen($adapterType) === 26 ? $adapterType : null);
        if ($profileId) {
            $profile = BiometricDeviceProfile::find($profileId);
            if ($profile) {
                $config['profile'] = $profile;
                $config['date_format'] = $config['date_format'] ?? $profile->date_format;
            }
        }

        $adapter = $this->getAdapter($adapterType, $config);
        $originalFilename = $file->getClientOriginalName();
        $tempPath = $file->getRealPath();

        // 1. Parse and validate
        $rawRecords = $adapter->parse($tempPath, $config);
        $validation = $adapter->validate($rawRecords, $config);

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
            $profile,
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
                'profile_id' => $profile?->id,
                'total_rows' => $validation['summary']['total'],
                'processed_rows' => 0,
                'failed_rows' => 0,
                'status' => 'processing',
                'imported_by' => $userId,
                'errors' => [],
            ]);

            // Preload existing attendance logs for matched employees in this batch
            $matchedEmpIds = [];
            $punchTimes = [];
            foreach ($validation['valid_records'] as $record) {
                $bioId = $record['biometric_id'];
                $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;
                if ($matchedEmployee !== null) {
                    $matchedEmpIds[] = $matchedEmployee->id;
                    $punchTimes[] = $record['punch_datetime'];
                }
            }

            $existingLogsMap = $this->getExistingAttendanceLogsMap($tenantId, $matchedEmpIds, $punchTimes);

            $punchesToInsert = [];
            $unmappedPunches = [];
            $seenInBatch = [];
            $insertedCount = 0;
            $duplicateCount = 0;
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

                $formattedDt = Carbon::parse($record['punch_datetime'])->format('Y-m-d H:i:s');
                $punchKey = $matchedEmployee->id.'_'.$formattedDt.'_'.$record['punch_type'];

                if (isset($existingLogsMap[$punchKey]) || isset($seenInBatch[$punchKey])) {
                    $duplicateCount++;
                    continue;
                }

                $seenInBatch[$punchKey] = true;

                $punchesToInsert[] = [
                    'id' => (string) Str::ulid(),
                    'tenant_id' => $tenantId,
                    'employee_id' => $matchedEmployee->id,
                    'punch_datetime' => $formattedDt,
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
            if ($duplicateCount > 0) {
                $errors['duplicate_skipped_count'] = $duplicateCount;
            }

            $finalStatus = 'completed';
            if ($insertedCount === 0 && $duplicateCount === 0 && $failedCount > 0) {
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
     * Preview biometric punches from the direct database staging table without committing.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public function previewStaging(array $config = []): array
    {
        $profileId = $config['profile_id'] ?? null;
        $profile = null;
        if ($profileId) {
            $profile = BiometricDeviceProfile::find($profileId);
            if ($profile) {
                $config['profile'] = $profile;
                $config['date_format'] = $config['date_format'] ?? $profile->date_format;
            }
        }

        $adapter = new DatabaseStagingAdapter;
        $rawRecords = $adapter->parse('', $config);
        $validation = $adapter->validate($rawRecords, $config);

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

        // Preload existing attendance logs for matched employees in this timeframe to detect duplicates
        $matchedEmpIds = [];
        $punchTimes = [];
        foreach ($validation['valid_records'] as $record) {
            $bioId = $record['biometric_id'];
            $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;
            if ($matchedEmployee !== null) {
                $matchedEmpIds[] = $matchedEmployee->id;
                $punchTimes[] = $record['punch_datetime'];
            }
        }

        $existingLogsMap = $tenantId ? $this->getExistingAttendanceLogsMap($tenantId, $matchedEmpIds, $punchTimes) : [];

        $mappedCount = 0;
        $unmappedCount = 0;
        $duplicateCount = 0;
        $readyCount = 0;
        $unmappedIds = [];
        $previewRows = [];
        $seenPunches = [];

        foreach ($validation['valid_records'] as $record) {
            $bioId = $record['biometric_id'];
            $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;

            $formattedDt = Carbon::parse($record['punch_datetime'])->format('Y-m-d H:i:s');
            $punchKey = ($matchedEmployee ? $matchedEmployee->id : $bioId).'_'.$formattedDt.'_'.$record['punch_type'];
            $isDuplicateInBatch = isset($seenPunches[$punchKey]);
            $seenPunches[$punchKey] = true;
            $isAlreadyInLogs = $matchedEmployee && isset($existingLogsMap[$punchKey]);

            $status = 'ready';
            if ($matchedEmployee === null) {
                $status = 'unmapped';
                $unmappedCount++;
                $unmappedIds[$bioId] = ($unmappedIds[$bioId] ?? 0) + 1;
            } elseif ($isAlreadyInLogs || $isDuplicateInBatch) {
                $status = 'duplicate';
                $duplicateCount++;
                $mappedCount++;
            } else {
                $status = 'ready';
                $readyCount++;
                $mappedCount++;
            }

            if (count($previewRows) < 100) {
                $previewRows[] = [
                    'line_number' => $record['line_number'],
                    'staging_id' => $record['staging_id'] ?? null,
                    'biometric_id' => $bioId,
                    'matched_employee' => $matchedEmployee ? [
                        'id' => $matchedEmployee->id,
                        'full_name' => $matchedEmployee->full_name,
                        'emp_no' => $matchedEmployee->emp_no,
                        'department' => $matchedEmployee->department?->name ?? 'N/A',
                    ] : null,
                    'punch_datetime' => $formattedDt,
                    'punch_type' => $record['punch_type'],
                    'device_id' => $record['device_id'],
                    'status' => $status,
                ];
            }
        }

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
            'ready_count' => $readyCount,
            'duplicate_count' => $duplicateCount,
            'unmapped_count' => $unmappedCount,
            'unique_unmapped' => $uniqueUnmappedList,
            'preview_rows' => $previewRows,
            'invalid_records' => array_slice($validation['invalid_records'], 0, 20),
        ];
    }

    /**
     * Commit biometric punches from the staging table to attendance_logs.
     *
     * @param  array<string, mixed>  $config
     */
    public function commitStaging(array $config = [], ?int $userId = null): AttendanceImport
    {
        $profileId = $config['profile_id'] ?? null;
        $profile = null;
        if ($profileId) {
            $profile = BiometricDeviceProfile::find($profileId);
            if ($profile) {
                $config['profile'] = $profile;
                $config['date_format'] = $config['date_format'] ?? $profile->date_format;
            }
        }

        $adapter = new DatabaseStagingAdapter;
        $rawRecords = $adapter->parse('', $config);
        $validation = $adapter->validate($rawRecords, $config);

        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        if (! $tenantId) {
            $firstEmployee = Employee::first();
            $tenantId = $firstEmployee?->tenant_id;
        }

        if (! $tenantId) {
            throw new Exception('Cannot determine tenant for attendance staging commit.');
        }

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
            $profile,
            $userId,
            $validation,
            $employeeByBioId,
            $employeeByEmpNo
        ): AttendanceImport {
            $batchTitle = 'Staging DB Sync: ' . ($profile ? $profile->name : 'Direct Staging') . ' (' . Carbon::now()->format('Y-m-d H:i') . ')';

            $import = AttendanceImport::create([
                'tenant_id' => $tenantId,
                'filename' => $batchTitle,
                'file_path' => null,
                'adapter_type' => 'database_staging',
                'profile_id' => $profile?->id,
                'total_rows' => $validation['summary']['total'],
                'processed_rows' => 0,
                'failed_rows' => 0,
                'status' => 'processing',
                'imported_by' => $userId,
                'errors' => [],
            ]);

            // Preload existing attendance logs for matched employees in this batch
            $matchedEmpIds = [];
            $punchTimes = [];
            foreach ($validation['valid_records'] as $record) {
                $bioId = $record['biometric_id'];
                $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;
                if ($matchedEmployee !== null) {
                    $matchedEmpIds[] = $matchedEmployee->id;
                    $punchTimes[] = $record['punch_datetime'];
                }
            }

            $existingLogsMap = $this->getExistingAttendanceLogsMap($tenantId, $matchedEmpIds, $punchTimes);

            $punchesToInsert = [];
            $unmappedPunches = [];
            $importedStagingIds = [];
            $failedStagingIds = [];
            $seenInBatch = [];
            $insertedCount = 0;
            $duplicateCount = 0;
            $failedCount = $validation['summary']['invalid'];
            $now = Carbon::now();

            foreach ($validation['valid_records'] as $record) {
                $bioId = $record['biometric_id'];
                $stagingId = $record['staging_id'] ?? null;
                $matchedEmployee = $employeeByBioId[$bioId] ?? $employeeByEmpNo[$bioId] ?? null;

                if ($matchedEmployee === null) {
                    $unmappedPunches[] = [
                        'biometric_id' => $bioId,
                        'punch_datetime' => $record['punch_datetime'],
                        'reason' => 'Unmapped Biometric ID',
                    ];
                    if ($stagingId) {
                        $failedStagingIds[] = $stagingId;
                    }
                    $failedCount++;

                    continue;
                }

                $formattedDt = Carbon::parse($record['punch_datetime'])->format('Y-m-d H:i:s');
                $punchKey = $matchedEmployee->id.'_'.$formattedDt.'_'.$record['punch_type'];

                // 1. If already exists in attendance_logs
                if (isset($existingLogsMap[$punchKey])) {
                    $duplicateCount++;
                    if ($stagingId) {
                        $importedStagingIds[$stagingId] = $existingLogsMap[$punchKey];
                    }
                    continue;
                }

                // 2. If duplicate within this batch
                if (isset($seenInBatch[$punchKey])) {
                    $duplicateCount++;
                    if ($stagingId && isset($seenInBatch[$punchKey]['log_id'])) {
                        $importedStagingIds[$stagingId] = $seenInBatch[$punchKey]['log_id'];
                    }
                    continue;
                }

                $logId = (string) Str::ulid();
                $seenInBatch[$punchKey] = ['log_id' => $logId];

                $punchesToInsert[] = [
                    'id' => $logId,
                    'tenant_id' => $tenantId,
                    'employee_id' => $matchedEmployee->id,
                    'punch_datetime' => $formattedDt,
                    'punch_type' => $record['punch_type'],
                    'device_id' => $record['device_id'] ?? null,
                    'raw_biometric_id' => $bioId,
                    'import_id' => $import->id,
                    'source' => 'staging_database',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                if ($stagingId) {
                    $importedStagingIds[$stagingId] = $logId;
                }
            }

            // Insert punches in chunks with duplicate protection
            if (! empty($punchesToInsert)) {
                foreach (array_chunk($punchesToInsert, 500) as $chunk) {
                    $inserted = DB::table('attendance_logs')->insertOrIgnore($chunk);
                    $insertedCount += $inserted;
                }
            }

            // Update staging table status for imported punches
            if (! empty($importedStagingIds)) {
                foreach (array_chunk(array_keys($importedStagingIds), 500) as $chunkIds) {
                    RawBiometricPunch::whereIn('id', $chunkIds)->update([
                        'status' => 'imported',
                        'error_message' => null,
                        'imported_at' => $now,
                    ]);
                }
                foreach ($importedStagingIds as $stgId => $lgId) {
                    RawBiometricPunch::where('id', $stgId)->update([
                        'attendance_log_id' => $lgId,
                    ]);
                }
            }

            // Update staging table status for failed / unmapped punches
            if (! empty($failedStagingIds)) {
                foreach (array_chunk($failedStagingIds, 500) as $chunkFailIds) {
                    RawBiometricPunch::whereIn('id', $chunkFailIds)->update([
                        'status' => 'failed',
                        'error_message' => 'Unmapped Biometric ID',
                    ]);
                }
            }

            $errors = [];
            if (! empty($unmappedPunches)) {
                $errors['unmapped_punches_count'] = count($unmappedPunches);
                $errors['unmapped_samples'] = array_slice($unmappedPunches, 0, 50);
            }
            if (! empty($validation['invalid_records'])) {
                $errors['invalid_records_count'] = count($validation['invalid_records']);
                $errors['invalid_samples'] = array_slice($validation['invalid_records'], 0, 50);
            }
            if ($duplicateCount > 0) {
                $errors['duplicate_skipped_count'] = $duplicateCount;
            }

            $finalStatus = 'completed';
            if ($insertedCount === 0 && $duplicateCount === 0 && $failedCount > 0) {
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
            ->with([
                'importedBy:id,name,email',
                'profile:id,name,device_brand,model_name',
            ])
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
            // Reset staging records if import was from staging DB
            $logIds = AttendanceLog::where('import_id', $import->id)->pluck('id');
            if ($logIds->isNotEmpty()) {
                RawBiometricPunch::whereIn('attendance_log_id', $logIds)->update([
                    'status' => 'pending',
                    'imported_at' => null,
                    'attendance_log_id' => null,
                    'error_message' => null,
                ]);
            }

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
     * Map a raw biometric ID to an employee profile and release unmapped failed punches.
     */
    public function mapBiometricIdToEmployee(string $employeeId, string $biometricId): Employee
    {
        $employee = Employee::findOrFail($employeeId);
        $cleanBioId = trim($biometricId);

        // Count how many failed staging punches exist for this ID before saving employee
        $failedCount = RawBiometricPunch::withoutGlobalScopes()
            ->where('tenant_id', $employee->tenant_id)
            ->where('raw_user_id', $cleanBioId)
            ->where('status', 'failed')
            ->count();

        $employee->update(['biometric_device_id' => $cleanBioId]);

        // In case not caught by model events, ensure they are reset
        RawBiometricPunch::withoutGlobalScopes()
            ->where('tenant_id', $employee->tenant_id)
            ->where('raw_user_id', $cleanBioId)
            ->where('status', 'failed')
            ->update([
                'status' => 'pending',
                'error_message' => null,
            ]);

        $employee->punches_reset_count = $failedCount;

        return $employee;
    }

    /**
     * Retry / reset failed staging punches back to pending.
     *
     * @param  array<string, mixed>  $filters
     * @return int Number of records reset to pending
     */
    public function retryFailedStagingPunches(array $filters = []): int
    {
        $query = RawBiometricPunch::query()->where('status', 'failed');

        $tenantId = $filters['tenant_id'] ?? session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);
        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        if (! empty($filters['device_sn'])) {
            $query->where('device_sn', (string) $filters['device_sn']);
        }

        if (! empty($filters['raw_user_id'])) {
            $query->where('raw_user_id', (string) $filters['raw_user_id']);
        }

        return $query->update([
            'status' => 'pending',
            'error_message' => null,
        ]);
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
        $pendingStagingPunches = RawBiometricPunch::pending()->count();
        $failedStagingPunches = RawBiometricPunch::failed()->count();

        return [
            'total_logs' => $totalLogs,
            'total_imports' => $totalImports,
            'last_import_date' => $lastImport?->created_at?->toIso8601String(),
            'last_import_status' => $lastImport?->status ?? 'none',
            'unmapped_employees_count' => $employeesWithoutBioId,
            'total_employees' => $totalEmployees,
            'pending_staging_punches' => $pendingStagingPunches,
            'failed_staging_punches' => $failedStagingPunches,
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
            'hikvision', 'hik' => [
                'content' => "No.\tTime\tCard No.\tName\tDevice\tEvent\n1\t2026-03-01 08:30:00\t1001\tSunil Perera\tMain Gate Turnstile\tCheck-In\n2\t2026-03-01 17:05:00\t1001\tSunil Perera\tMain Gate Turnstile\tCheck-Out\n3\t2026-03-01 08:45:00\t1002\tKamal Silva\tMain Gate Turnstile\tCheck-In\n",
                'filename' => 'hikvision_sample_attendance.txt',
                'mime' => 'text/plain',
            ],
            'realand' => [
                'content' => "1001 2026-03-01 08:30:00 0 1\n1001 2026-03-01 17:05:00 1 1\n1002 2026-03-01 08:45:00 0 1\n",
                'filename' => 'realand_sample_attendance.txt',
                'mime' => 'text/plain',
            ],
            'excel', 'xlsx' => [
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

    /**
     * Build an existing punches lookup map from attendance_logs for the given records.
     *
     * @param  string  $tenantId
     * @param  array<int, string>  $employeeIds
     * @param  array<int, string>  $punchDatetimes
     * @return array<string, string> Key: "{employee_id}_{punch_datetime}_{punch_type}" => attendance_log_id
     */
    private function getExistingAttendanceLogsMap(string $tenantId, array $employeeIds, array $punchDatetimes): array
    {
        if (empty($employeeIds) || empty($punchDatetimes)) {
            return [];
        }

        $minTime = min($punchDatetimes);
        $maxTime = max($punchDatetimes);

        $existing = DB::table('attendance_logs')
            ->where('tenant_id', $tenantId)
            ->whereIn('employee_id', array_values(array_unique($employeeIds)))
            ->whereBetween('punch_datetime', [
                Carbon::parse($minTime)->subMinute()->toDateTimeString(),
                Carbon::parse($maxTime)->addMinute()->toDateTimeString(),
            ])
            ->select(['id', 'employee_id', 'punch_datetime', 'punch_type'])
            ->get();

        $map = [];
        foreach ($existing as $row) {
            $dt = Carbon::parse($row->punch_datetime)->format('Y-m-d H:i:s');
            $key = $row->employee_id.'_'.$dt.'_'.$row->punch_type;
            $map[$key] = (string) $row->id;
        }

        return $map;
    }
}
