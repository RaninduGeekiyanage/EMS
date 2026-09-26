<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

// Automated Daily Attendance Processing Schedule
// 1. Hourly check to absorb newly arrived/synced biometric punch logs
Schedule::command('attendance:process --unprocessed-only')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

// 2. Nightly rolling 3-day window to reconcile late punches, night shifts, and OT adjustments
Schedule::command('attendance:process --rolling-days=3')
    ->dailyAt('00:05')
    ->withoutOverlapping()
    ->runInBackground();

