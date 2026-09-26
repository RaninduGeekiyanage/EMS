<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\AttendanceProcessingService;
use Carbon\Carbon;
use Illuminate\Console\Command;

final class ProcessDailyAttendanceCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:process
                            {--date= : Specific date to calculate (YYYY-MM-DD)}
                            {--start-date= : Range start date (YYYY-MM-DD)}
                            {--end-date= : Range end date (YYYY-MM-DD)}
                            {--rolling-days= : Process the last N rolling days up to today}
                            {--unprocessed-only : Process only dates having unprocessed biometric punch logs}
                            {--overwrite-manual : Force overwrite existing manual HR adjustments}
                            {--tenant= : Specific tenant ULID}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automated processing engine for daily attendance ledgers, shifts, and overtime calculations';

    public function handle(AttendanceProcessingService $service): int
    {
        $overwriteManual = (bool) $this->option('overwrite-manual');
        $tenantIdOption = $this->option('tenant');

        $tenants = $tenantIdOption
            ? Tenant::where('id', $tenantIdOption)->where('is_active', true)->get()
            : Tenant::where('is_active', true)->get();

        if ($tenants->isEmpty()) {
            $this->warn('No active tenants found to process.');

            return self::SUCCESS;
        }

        foreach ($tenants as $tenant) {
            $this->info("Processing attendance for tenant: {$tenant->name} ({$tenant->slug})");
            session(['tenant_id' => $tenant->id]);
            app()->instance('current_tenant', $tenant);
            app()->instance('current_tenant_id', $tenant->id);

            // Mode 1: Unprocessed backlog only
            if ($this->option('unprocessed-only')) {
                $summary = $service->getUnprocessedSummary($tenant->id);
                if ($summary['unprocessed_count'] === 0) {
                    $this->line(" - No pending unprocessed logs for tenant {$tenant->slug}.");
                    continue;
                }

                $this->line(" - Found {$summary['unprocessed_count']} unprocessed logs across {$summary['unprocessed_dates_count']} dates.");
                $res = $service->processUnprocessedBacklog($tenant->id, $overwriteManual);
                $this->info(" - Backlog completed: {$res['total_processed']} records updated across {$res['dates_count']} dates.");
                continue;
            }

            // Mode 2: Rolling days (e.g. --rolling-days=3)
            $rollingDays = $this->option('rolling-days');
            if ($rollingDays !== null) {
                $days = max(1, (int) $rollingDays);
                $endDate = Carbon::today();
                $startDate = Carbon::today()->subDays($days - 1);

                $this->line(" - Processing rolling {$days}-day window: {$startDate->toDateString()} to {$endDate->toDateString()}");
                $res = $service->reprocessDateRange($startDate, $endDate, null, null, $overwriteManual);
                $this->info(" - Rolling window completed: {$res['total_processed']} daily records calculated.");
                continue;
            }

            // Mode 3: Date range (--start-date & --end-date)
            $startDateStr = $this->option('start-date');
            $endDateStr = $this->option('end-date');
            if ($startDateStr && $endDateStr) {
                $startDate = Carbon::parse((string) $startDateStr);
                $endDate = Carbon::parse((string) $endDateStr);

                $this->line(" - Processing date range: {$startDate->toDateString()} to {$endDate->toDateString()}");
                $res = $service->reprocessDateRange($startDate, $endDate, null, null, $overwriteManual);
                $this->info(" - Range completed: {$res['total_processed']} daily records calculated.");
                continue;
            }

            // Mode 4: Single date (--date or default today)
            $targetDateStr = $this->option('date') ?? Carbon::today()->toDateString();
            $targetDate = Carbon::parse((string) $targetDateStr);

            $this->line(" - Processing single date: {$targetDate->toDateString()}");
            $res = $service->processDate($targetDate, null, null, $overwriteManual, $tenant->id);
            $this->info(" - Single date completed: {$res['processed']} processed ({$res['present']} present, {$res['absent']} absent, {$res['late']} late, {$res['missing_punch']} missing punches).");
        }

        $this->info('Attendance calculation pipeline finished successfully.');

        return self::SUCCESS;
    }
}
