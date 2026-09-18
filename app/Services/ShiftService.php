<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Employee;
use App\Models\PublicHoliday;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class ShiftService
{
    /**
     * Get list of shifts.
     *
     * @return Collection<int, Shift>
     */
    public function listShifts(bool $onlyActive = false): Collection
    {
        $query = Shift::query()
            ->withCount('assignments')
            ->orderBy('name');

        if ($onlyActive) {
            $query->where('is_active', true);
        }

        return $query->get();
    }

    /**
     * Create a new shift definition.
     *
     * @param  array<string, mixed>  $data
     */
    public function createShift(array $data): Shift
    {
        return DB::transaction(static function () use ($data): Shift {
            return Shift::create([
                'name' => $data['name'],
                'code' => strtoupper($data['code']),
                'shift_type' => $data['shift_type'] ?? 'regular',
                'start_time' => $data['start_time'],
                'end_time' => $data['end_time'],
                'break_minutes' => (int) ($data['break_minutes'] ?? 60),
                'grace_minutes' => (int) ($data['grace_minutes'] ?? 10),
                'ot_threshold_minutes' => (int) ($data['ot_threshold_minutes'] ?? 480),
                'is_night_shift' => (bool) ($data['is_night_shift'] ?? false),
                'color' => $data['color'] ?? null,
                'description' => $data['description'] ?? null,
                'is_active' => (bool) ($data['is_active'] ?? true),
            ]);
        });
    }

    /**
     * Update an existing shift definition.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateShift(Shift $shift, array $data): Shift
    {
        return DB::transaction(static function () use ($shift, $data): Shift {
            $shift->update([
                'name' => $data['name'],
                'code' => strtoupper($data['code']),
                'shift_type' => $data['shift_type'] ?? $shift->shift_type,
                'start_time' => $data['start_time'],
                'end_time' => $data['end_time'],
                'break_minutes' => (int) ($data['break_minutes'] ?? $shift->break_minutes),
                'grace_minutes' => (int) ($data['grace_minutes'] ?? $shift->grace_minutes),
                'ot_threshold_minutes' => (int) ($data['ot_threshold_minutes'] ?? $shift->ot_threshold_minutes),
                'is_night_shift' => (bool) ($data['is_night_shift'] ?? $shift->is_night_shift),
                'color' => $data['color'] ?? $shift->color,
                'description' => $data['description'] ?? $shift->description,
                'is_active' => (bool) ($data['is_active'] ?? $shift->is_active),
            ]);

            return $shift;
        });
    }

    /**
     * Delete a shift.
     */
    public function deleteShift(Shift $shift): bool
    {
        return (bool) $shift->delete();
    }

    /**
     * Seed 4 Sri Lankan industry standard shift presets into the active tenant.
     *
     * @return array<int, Shift>
     */
    public function seedStandardTemplates(): array
    {
        $presets = [
            [
                'name' => 'General Day Shift',
                'code' => 'GEN-DAY',
                'shift_type' => 'regular',
                'start_time' => '08:30',
                'end_time' => '17:00',
                'break_minutes' => 60,
                'grace_minutes' => 10,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => false,
                'color' => '#3B82F6',
                'description' => 'Standard commercial/office day shift under Sri Lanka Shop & Office Act (8h worked + 1h meal break).',
                'is_active' => true,
            ],
            [
                'name' => 'Morning Shift (A)',
                'code' => 'ROT-MORN',
                'shift_type' => 'rotational',
                'start_time' => '06:00',
                'end_time' => '14:00',
                'break_minutes' => 30,
                'grace_minutes' => 10,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => false,
                'color' => '#10B981',
                'description' => 'First rotation for manufacturing, services and hospitality operations.',
                'is_active' => true,
            ],
            [
                'name' => 'Evening Shift (B)',
                'code' => 'ROT-EVE',
                'shift_type' => 'rotational',
                'start_time' => '14:00',
                'end_time' => '22:00',
                'break_minutes' => 30,
                'grace_minutes' => 10,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => false,
                'color' => '#F59E0B',
                'description' => 'Second rotation for continuous shift cycles.',
                'is_active' => true,
            ],
            [
                'name' => 'Night Shift (C)',
                'code' => 'ROT-NIGHT',
                'shift_type' => 'night',
                'start_time' => '22:00',
                'end_time' => '06:00',
                'break_minutes' => 30,
                'grace_minutes' => 10,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => true,
                'color' => '#8B5CF6',
                'description' => 'Overnight cross-midnight shift eligible for statutory night allowance.',
                'is_active' => true,
            ],
            [
                'name' => 'Half-Day Saturday Shift',
                'code' => 'SAT-HALF',
                'shift_type' => 'half_day',
                'start_time' => '08:30',
                'end_time' => '13:00',
                'break_minutes' => 0,
                'grace_minutes' => 10,
                'ot_threshold_minutes' => 270,
                'is_night_shift' => false,
                'color' => '#EC4899',
                'description' => 'Saturday half-day shift satisfying the 45-hour weekly Shop & Office Act cap.',
                'is_active' => true,
            ],
            [
                'name' => 'Flexible Core Hours Shift',
                'code' => 'FLEX-CORE',
                'shift_type' => 'flexible',
                'start_time' => '08:00',
                'end_time' => '18:00',
                'break_minutes' => 60,
                'grace_minutes' => 15,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => false,
                'color' => '#06B6D4',
                'description' => 'Flexible sliding window with required 8 hours daily presence.',
                'is_active' => true,
            ],
        ];

        $created = [];
        foreach ($presets as $preset) {
            $shift = Shift::firstOrCreate(
                ['code' => $preset['code']],
                $preset
            );
            $created[] = $shift;
        }

        return $created;
    }

    /**
     * Assign a shift to an employee.
     *
     * @param  array<string, mixed>  $data
     */
    public function assignShift(array $data): ShiftAssignment
    {
        return DB::transaction(static function () use ($data): ShiftAssignment {
            return ShiftAssignment::create([
                'employee_id' => $data['employee_id'],
                'shift_id' => $data['shift_id'],
                'effective_from' => $data['effective_from'],
                'effective_to' => $data['effective_to'] ?? null,
            ]);
        });
    }

    /**
     * Delete/unassign a shift assignment.
     */
    public function removeAssignment(ShiftAssignment $assignment): bool
    {
        return (bool) $assignment->delete();
    }

    /**
     * Find effective shift for an employee on a given date.
     * Prioritizes scheduled RosterEntry (if exists) before falling back to permanent ShiftAssignment.
     */
    public function getEffectiveShiftForEmployee(Employee $employee, CarbonInterface $date): ?Shift
    {
        $dateString = $date->toDateString();

        // 1. Check for specific roster entry on this date
        $rosterEntry = RosterEntry::where('employee_id', $employee->id)
            ->whereDate('roster_date', $dateString)
            ->with('shift')
            ->first();

        if ($rosterEntry !== null) {
            if ($rosterEntry->schedule_type === 'rest_day' || $rosterEntry->schedule_type === 'off') {
                return null;
            }

            if ($rosterEntry->shift !== null) {
                return $rosterEntry->shift;
            }
        }

        // 2. Fallback to permanent baseline ShiftAssignment
        $assignment = ShiftAssignment::where('employee_id', $employee->id)
            ->where('effective_from', '<=', $dateString)
            ->where(static function ($q) use ($dateString) {
                $q->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $dateString);
            })
            ->latest('effective_from')
            ->first();

        return $assignment?->shift;
    }

    /**
     * Get specific roster entry for an employee on a given date.
     */
    public function getRosterEntryForEmployee(Employee $employee, CarbonInterface $date): ?RosterEntry
    {
        return RosterEntry::where('employee_id', $employee->id)
            ->whereDate('roster_date', $date->toDateString())
            ->with('shift')
            ->first();
    }

    /**
     * List public holidays.
     *
     * @return Collection<int, PublicHoliday>
     */
    public function listHolidays(?int $year = null): Collection
    {
        $query = PublicHoliday::query()->orderBy('holiday_date');

        if ($year !== null) {
            $query->whereYear('holiday_date', $year);
        }

        return $query->get();
    }

    /**
     * Create public holiday.
     *
     * @param  array<string, mixed>  $data
     */
    public function createHoliday(array $data): PublicHoliday
    {
        return DB::transaction(static function () use ($data): PublicHoliday {
            return PublicHoliday::create([
                'name' => $data['name'],
                'holiday_date' => $data['holiday_date'],
                'type' => $data['type'] ?? 'statutory',
                'description' => $data['description'] ?? null,
            ]);
        });
    }

    /**
     * Update public holiday.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateHoliday(PublicHoliday $holiday, array $data): PublicHoliday
    {
        return DB::transaction(static function () use ($holiday, $data): PublicHoliday {
            $holiday->update([
                'name' => $data['name'],
                'holiday_date' => $data['holiday_date'],
                'type' => $data['type'] ?? $holiday->type,
                'description' => $data['description'] ?? $holiday->description,
            ]);

            return $holiday;
        });
    }

    /**
     * Delete public holiday.
     */
    public function deleteHoliday(PublicHoliday $holiday): bool
    {
        return (bool) $holiday->delete();
    }

    /**
     * Check if a date is a public holiday.
     */
    public function isHoliday(CarbonInterface $date): ?PublicHoliday
    {
        return PublicHoliday::whereDate('holiday_date', $date->toDateString())->first();
    }

    /**
     * Seed Sri Lankan statutory, mercantile and Poya holidays for a year.
     *
     * @return array<int, PublicHoliday>
     */
    public function seedSriLankanHolidays(int $year): array
    {
        $defaults = [
            ['date' => "{$year}-01-14", 'name' => 'Tamil Thai Pongal Day', 'type' => 'statutory'],
            ['date' => "{$year}-01-25", 'name' => 'Duruthu Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-02-04", 'name' => 'National Independence Day', 'type' => 'statutory'],
            ['date' => "{$year}-02-23", 'name' => 'Navam Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-03-08", 'name' => 'Mahasivarathri Day', 'type' => 'mercantile'],
            ['date' => "{$year}-03-24", 'name' => 'Medin Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-03-29", 'name' => 'Good Friday', 'type' => 'mercantile'],
            ['date' => "{$year}-04-11", 'name' => 'Id Ul-Fitr (Ramazan Festival)', 'type' => 'mercantile'],
            ['date' => "{$year}-04-13", 'name' => 'Day Prior to Sinhala & Tamil New Year', 'type' => 'statutory'],
            ['date' => "{$year}-04-14", 'name' => 'Sinhala & Tamil New Year Day', 'type' => 'statutory'],
            ['date' => "{$year}-04-23", 'name' => 'Bak Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-05-01", 'name' => 'May Day (International Workers\' Day)', 'type' => 'statutory'],
            ['date' => "{$year}-05-23", 'name' => 'Vesak Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-05-24", 'name' => 'Day Following Vesak Full Moon Poya Day', 'type' => 'statutory'],
            ['date' => "{$year}-06-21", 'name' => 'Poson Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-07-20", 'name' => 'Esala Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-08-19", 'name' => 'Nikini Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-09-17", 'name' => 'Binara Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-10-17", 'name' => 'Vap Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-11-15", 'name' => 'Il Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-12-14", 'name' => 'Unduvap Full Moon Poya Day', 'type' => 'poya'],
            ['date' => "{$year}-12-25", 'name' => 'Christmas Day', 'type' => 'statutory'],
        ];

        return DB::transaction(static function () use ($defaults): array {
            $created = [];
            foreach ($defaults as $item) {
                $holiday = PublicHoliday::firstOrCreate(
                    ['holiday_date' => $item['date']],
                    [
                        'name' => $item['name'],
                        'type' => $item['type'],
                        'description' => "Official Sri Lankan holiday ({$item['type']}).",
                    ]
                );
                $created[] = $holiday;
            }

            return $created;
        });
    }
}
