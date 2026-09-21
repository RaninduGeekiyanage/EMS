<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Roster\GenerateRosterRequest;
use App\Http\Requests\Roster\StoreRosterPatternRequest;
use App\Http\Requests\Roster\UpdateRosterPatternRequest;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\RosterPattern;
use App\Services\RosterService;
use App\Services\ShiftService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class RosterPatternController extends Controller
{
    public function __construct(
        private readonly RosterService $rosterService,
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Display the Roster Patterns library and builder interface.
     */
    public function index(Request $request): Response
    {
        $patterns = $this->rosterService->listPatterns();
        $shifts = $this->shiftService->listShifts(true);

        $employees = Employee::query()
            ->select('id', 'emp_no', 'full_name', 'department_id', 'designation_id')
            ->with(['department:id,name', 'designation:id,title'])
            ->where('employment_status', 'active')
            ->orderBy('emp_no')
            ->get();

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $designations = Designation::query()
            ->where('is_active', true)
            ->orderBy('title')
            ->get(['id', 'title']);

        $stats = [
            'total_patterns' => $patterns->count(),
            'weekly_patterns' => $patterns->where('pattern_type', 'weekly')->count(),
            'cyclical_patterns' => $patterns->where('pattern_type', 'cyclical')->count(),
            'daily_patterns' => $patterns->where('pattern_type', 'daily')->count(),
            'total_active_employees' => $employees->count(),
        ];

        return Inertia::render('Roster/Patterns', [
            'patterns' => $patterns,
            'shifts' => $shifts,
            'employees' => $employees,
            'departments' => $departments,
            'designations' => $designations,
            'stats' => $stats,
        ]);
    }

    /**
     * Store a newly created roster pattern.
     */
    public function store(StoreRosterPatternRequest $request): RedirectResponse
    {
        $this->rosterService->createPattern($request->validated());

        return redirect()->back()->with('success', 'Roster pattern created successfully.');
    }

    /**
     * Update the specified roster pattern.
     */
    public function update(UpdateRosterPatternRequest $request, RosterPattern $pattern): RedirectResponse
    {
        $this->rosterService->updatePattern($pattern, $request->validated());

        return redirect()->back()->with('success', 'Roster pattern updated successfully.');
    }

    /**
     * Remove the specified roster pattern.
     */
    public function destroy(RosterPattern $pattern): RedirectResponse
    {
        $this->rosterService->deletePattern($pattern);

        return redirect()->back()->with('success', 'Roster pattern deleted successfully.');
    }

    /**
     * Assign a roster pattern directly to target employees over a date range.
     */
    public function assign(GenerateRosterRequest $request): RedirectResponse
    {
        $result = $this->rosterService->generateRoster($request->validated());

        return redirect()->back()->with(
            'success',
            "Roster assigned successfully. {$result['created']} entries created, {$result['updated']} updated."
        );
    }

    /**
     * Create an entire Shift Group Set (Option 2 Industry Standard).
     */
    public function storeGroupSet(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'preset_type' => ['required', 'string', 'in:three_shift_247,two_shift,general_weekly'],
            'name_prefix' => ['required', 'string', 'max:100'],
            'code_prefix' => ['required', 'string', 'max:20'],
            'shift_1_id' => ['required', 'string', 'exists:shifts,id'],
            'shift_2_id' => ['nullable', 'string', 'exists:shifts,id'],
            'shift_3_id' => ['nullable', 'string', 'exists:shifts,id'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $created = $this->rosterService->createGroupSet($validated);
        $count = count($created);

        return redirect()->back()->with(
            'success',
            "Shift Group Set created successfully. {$count} rotating group card(s) generated."
        );
    }

    /**
     * Auto-generate complementary rotated squad groups from an existing cyclical pattern.
     */
    public function generateComplementarySquads(Request $request, RosterPattern $pattern): RedirectResponse
    {
        $validated = $request->validate([
            'total_squads' => ['nullable', 'integer', 'min:2', 'max:26'],
            'stagger_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $totalSquads = isset($validated['total_squads']) ? (int) $validated['total_squads'] : null;
        $staggerDays = isset($validated['stagger_days']) ? (int) $validated['stagger_days'] : null;

        $created = $this->rosterService->generateComplementarySquads($pattern, $totalSquads, $staggerDays);
        $count = count($created);

        return redirect()->back()->with(
            'success',
            "Generated {$count} complementary rotated squad group cards successfully."
        );
    }
}
