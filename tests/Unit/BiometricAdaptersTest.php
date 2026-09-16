<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Biometric\ExcelAdapter;
use App\Services\Biometric\GenericCsvAdapter;
use App\Services\Biometric\ZKTecoAdapter;
use PHPUnit\Framework\TestCase;

final class BiometricAdaptersTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tempDir = sys_get_temp_dir().'/biometric_test_'.uniqid();
        mkdir($this->tempDir, 0777, true);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->tempDir.'/*.*') ?: []);
        if (is_dir($this->tempDir)) {
            rmdir($this->tempDir);
        }
        parent::tearDown();
    }

    public function test_zkteco_adapter_parses_tab_separated_lines(): void
    {
        $filePath = $this->tempDir.'/zkteco.dat';
        $content = "1001\t2026-03-01 08:30:15\t0\t1\n".
                   "1001\t2026-03-01 17:05:00\t1\t1\n".
                   "1002\t2026-03-01 08:45:00\t0\t1\n";
        file_put_contents($filePath, $content);

        $adapter = new ZKTecoAdapter;
        $records = $adapter->parse($filePath);

        $this->assertCount(3, $records);
        $this->assertSame('1001', $records[0]['biometric_id']);
        $this->assertSame('2026-03-01 08:30:15', $records[0]['punch_datetime']);
        $this->assertSame('in', $records[0]['punch_type']);

        $this->assertSame('out', $records[1]['punch_type']);

        $validated = $adapter->validate($records);
        $this->assertCount(3, $validated['valid_records']);
        $this->assertCount(0, $validated['invalid_records']);
    }

    public function test_zkteco_adapter_flags_malformed_datetime(): void
    {
        $filePath = $this->tempDir.'/zk_bad.dat';
        $content = "1001\tnot-a-valid-date\t0\t1\n";
        file_put_contents($filePath, $content);

        $adapter = new ZKTecoAdapter;
        $records = $adapter->parse($filePath);
        $validated = $adapter->validate($records);

        $this->assertCount(0, $validated['valid_records']);
        $this->assertCount(1, $validated['invalid_records']);
        $this->assertStringContainsString('Malformed datetime', $validated['invalid_records'][0]['error']);
    }

    public function test_generic_csv_adapter_parses_comma_separated_file_with_headers(): void
    {
        $filePath = $this->tempDir.'/punches.csv';
        $content = "biometric_id,punch_datetime,punch_type,device_id\n".
                   "BIO-99,2026-03-02 08:29:45,in,ZK-01\n".
                   "BIO-99,2026-03-02 17:15:20,out,ZK-01\n";
        file_put_contents($filePath, $content);

        $adapter = new GenericCsvAdapter;
        $records = $adapter->parse($filePath);

        $this->assertCount(2, $records);
        $this->assertSame('BIO-99', $records[0]['biometric_id']);
        $this->assertSame('2026-03-02 08:29:45', $records[0]['punch_datetime']);
        $this->assertSame('in', $records[0]['punch_type']);
        $this->assertSame('ZK-01', $records[0]['device_id']);

        $validated = $adapter->validate($records);
        $this->assertCount(2, $validated['valid_records']);
    }

    public function test_generic_csv_adapter_handles_separate_date_and_time_columns(): void
    {
        $filePath = $this->tempDir.'/separate.csv';
        $content = "emp_no,date,time,status\n".
                   "EMP001,2026-03-03,08:30:00,in\n";
        file_put_contents($filePath, $content);

        $adapter = new GenericCsvAdapter;
        $records = $adapter->parse($filePath);

        $this->assertCount(1, $records);
        $this->assertSame('EMP001', $records[0]['biometric_id']);
        $this->assertSame('2026-03-03 08:30:00', $records[0]['punch_datetime']);

        $validated = $adapter->validate($records);
        $this->assertSame('2026-03-03 08:30:00', $validated['valid_records'][0]['punch_datetime']);
    }

    public function test_excel_adapter_falls_back_to_csv_reading_for_tabular_files(): void
    {
        $filePath = $this->tempDir.'/excel_sample.csv';
        $content = "biometric_id,punch_datetime,punch_type\n".
                   "EX-10,2026-03-04 09:00:00,in\n";
        file_put_contents($filePath, $content);

        $adapter = new ExcelAdapter;
        $records = $adapter->parse($filePath);

        $this->assertCount(1, $records);
        $this->assertSame('EX-10', $records[0]['biometric_id']);

        $validated = $adapter->validate($records);
        $this->assertCount(1, $validated['valid_records']);
    }
}
