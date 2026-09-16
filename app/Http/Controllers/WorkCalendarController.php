<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\WorkCalendar\StorePublicHolidayRequest;
use App\Http\Requests\WorkCalendar\UpdatePublicHolidayRequest;
use App\Models\PublicHoliday;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class WorkCalendarController extends Controller
{
    public function __construct(
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Display work calendar and holiday schedule.
     */
    public function index(Request $request): Response
    {
        $year = (int) ($request->query('year') ?? Carbon::now()->year);

        $holidays = $this->shiftService->listHolidays($year);

        $stats = [
            'year' => $year,
            'total_holidays' => $holidays->count(),
            'poya_days' => $holidays->where('type', 'poya')->count(),
            'statutory_days' => $holidays->where('type', 'statutory')->count(),
            'mercantile_days' => $holidays->where('type', 'mercantile')->count(),
        ];

        return Inertia::render('WorkCalendar/Index', [
            'holidays' => $holidays,
            'stats' => $stats,
            'currentYear' => $year,
        ]);
    }

    /**
     * Store a newly created public holiday.
     */
    public function storeHoliday(StorePublicHolidayRequest $request): RedirectResponse
    {
        $this->shiftService->createHoliday($request->validated());

        return redirect()->back()->with('success', 'Public holiday added.');
    }

    /**
     * Update the specified public holiday.
     */
    public function updateHoliday(UpdatePublicHolidayRequest $request, PublicHoliday $holiday): RedirectResponse
    {
        $this->shiftService->updateHoliday($holiday, $request->validated());

        return redirect()->back()->with('success', 'Public holiday updated.');
    }

    /**
     * Remove the specified public holiday.
     */
    public function destroyHoliday(PublicHoliday $holiday): RedirectResponse
    {
        $this->shiftService->deleteHoliday($holiday);

        return redirect()->back()->with('success', 'Public holiday deleted.');
    }

    /**
     * Seed Sri Lankan statutory, mercantile and Poya holidays for selected year.
     */
    public function seedHolidays(Request $request): RedirectResponse
    {
        $year = (int) ($request->input('year') ?? Carbon::now()->year);

        $this->shiftService->seedSriLankanHolidays($year);

        return redirect()->back()->with('success', "Sri Lankan holidays populated for {$year}.");
    }
}
