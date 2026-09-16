<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Shift\AssignShiftRequest;
use App\Http\Requests\Shift\StoreShiftRequest;
use App\Http\Requests\Shift\UpdateShiftRequest;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Services\ShiftService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ShiftController extends Controller
{
    public function __construct(
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Display shift definitions and management view.
     */
    public function index(Request $request): Response
    {
        $shifts = $this->shiftService->listShifts();

        $employees = Employee::query()
            ->select('id', 'emp_no', 'full_name', 'department_id')
            ->with(['department:id,name', 'shiftAssignments.shift:id,name,code,color'])
            ->where('employment_status', 'active')
            ->orderBy('emp_no')
            ->get();

        $stats = [
            'total_shifts' => $shifts->count(),
            'active_shifts' => $shifts->where('is_active', true)->count(),
            'night_shifts' => $shifts->where('is_night_shift', true)->count(),
            'rotational_shifts' => $shifts->where('shift_type', 'rotational')->count(),
            'total_assignments' => ShiftAssignment::count(),
        ];

        return Inertia::render('Shifts/Index', [
            'shifts' => $shifts,
            'employees' => $employees,
            'stats' => $stats,
        ]);
    }

    /**
     * Store a newly created shift.
     */
    public function store(StoreShiftRequest $request): RedirectResponse
    {
        $this->shiftService->createShift($request->validated());

        return redirect()->back()->with('success', 'Shift created successfully.');
    }

    /**
     * Update the specified shift.
     */
    public function update(UpdateShiftRequest $request, Shift $shift): RedirectResponse
    {
        $this->shiftService->updateShift($shift, $request->validated());

        return redirect()->back()->with('success', 'Shift updated successfully.');
    }

    /**
     * Remove the specified shift.
     */
    public function destroy(Shift $shift): RedirectResponse
    {
        $this->shiftService->deleteShift($shift);

        return redirect()->back()->with('success', 'Shift deleted successfully.');
    }

    /**
     * Seed Sri Lankan industry standard shift presets into active tenant.
     */
    public function seedPresets(): RedirectResponse
    {
        $this->shiftService->seedStandardTemplates();

        return redirect()->back()->with('success', 'Standard Sri Lankan shift presets populated successfully.');
    }

    /**
     * Assign a shift to an employee.
     */
    public function assign(AssignShiftRequest $request): RedirectResponse
    {
        $this->shiftService->assignShift($request->validated());

        return redirect()->back()->with('success', 'Shift assigned successfully.');
    }

    /**
     * Remove an employee's shift assignment.
     */
    public function removeAssignment(ShiftAssignment $assignment): RedirectResponse
    {
        $this->shiftService->removeAssignment($assignment);

        return redirect()->back()->with('success', 'Shift assignment removed.');
    }
}
