<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Roster\ClearRosterRequest;
use App\Http\Requests\Roster\GenerateRosterRequest;
use App\Http\Requests\Roster\PublishRosterRequest;
use App\Http\Requests\Roster\RemoveRosterAllocationRequest;
use App\Http\Requests\Roster\StoreRosterAllocationRequest;
use App\Http\Requests\Roster\TransferRosterAllocationRequest;
use App\Http\Requests\Roster\UpdateRosterEntryRequest;
use App\Models\Roster;
use App\Services\RosterService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class RosterController extends Controller
{
    public function __construct(
        private readonly RosterService $rosterService,
    ) {}

    /**
     * Display the interactive duty roster matrix planner.
     */
    public function index(Request $request): Response
    {
        $year = (int) $request->input('year', Carbon::now()->year);
        $month = (int) $request->input('month', Carbon::now()->month);
        $departmentId = $request->input('department_id');
        $rosterId = $request->input('roster_id');

        $data = $this->rosterService->getMonthMatrix($year, $month, $departmentId, $rosterId);

        return Inertia::render('Roster/Index', $data);
    }

    /**
     * Store a newly created Named Roster.
     */
    public function storeRoster(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'department_id' => ['nullable', 'string'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'status' => ['nullable', 'string', 'in:draft,published'],
            'notes' => ['nullable', 'string'],
            'pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string', 'exists:employees,id'],
            'pattern_allocations' => ['nullable', 'array'],
            'pattern_allocations.*.pattern_id' => ['required_with:pattern_allocations', 'string', 'exists:roster_patterns,id'],
            'pattern_allocations.*.employee_ids' => ['required_with:pattern_allocations', 'array'],
            'pattern_allocations.*.employee_ids.*' => ['string', 'exists:employees,id'],
        ]);

        try {
            $roster = $this->rosterService->createRoster($validated);

            return redirect()->route('roster.index', [
                'roster_id' => $roster->id,
                'year' => Carbon::parse($roster->start_date)->year,
                'month' => Carbon::parse($roster->start_date)->month,
            ])->with('success', "Roster '{$roster->name}' created successfully.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Update an existing Named Roster.
     */
    public function updateRoster(Request $request, Roster $roster): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'department_id' => ['nullable', 'string'],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date' => ['sometimes', 'required', 'date', 'after_or_equal:start_date'],
            'notes' => ['nullable', 'string'],
        ]);

        $this->rosterService->updateRoster($roster, $validated);

        return redirect()->back()->with('success', "Roster '{$roster->name}' updated successfully.");
    }

    /**
     * Delete a Named Roster.
     */
    public function destroyRoster(Roster $roster): RedirectResponse
    {
        try {
            $this->rosterService->deleteRoster($roster);

            return redirect()->route('roster.index')->with('success', 'Roster deleted successfully.');
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Archive an existing Named Roster.
     */
    public function archiveRoster(Roster $roster): RedirectResponse
    {
        try {
            $this->rosterService->archiveRoster($roster);

            return redirect()->route('roster.index')->with('success', "Roster '{$roster->name}' archived successfully.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Publish or unpublish a Named Roster.
     */
    public function publishNamedRoster(Request $request, Roster $roster): RedirectResponse
    {
        try {
            $publish = (bool) $request->input('publish', true);
            $this->rosterService->publishNamedRoster($roster, $publish);

            $action = $publish ? 'published' : 'reverted to draft';

            return redirect()->back()->with('success', "Roster '{$roster->name}' {$action} successfully.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Clone a Named Roster and its entries to a new date range.
     */
    public function cloneRoster(Request $request, Roster $roster): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ]);

        $newRoster = $this->rosterService->cloneRoster($roster, $validated);

        return redirect()->route('roster.index', [
            'roster_id' => $newRoster->id,
            'year' => Carbon::parse($newRoster->start_date)->year,
            'month' => Carbon::parse($newRoster->start_date)->month,
        ])->with('success', "Roster cloned to '{$newRoster->name}' successfully.");
    }

    /**
     * Generate bulk roster entries via selected pattern mode.
     */
    public function generate(GenerateRosterRequest $request): RedirectResponse
    {
        $result = $this->rosterService->generateRoster($request->validated());

        return redirect()->back()->with(
            'success',
            "Roster generated successfully. {$result['created']} entries created, {$result['updated']} updated."
        );
    }

    /**
     * Update single cell roster entry with audit trail and override reason.
     */
    public function updateEntry(UpdateRosterEntryRequest $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validated();

        $entry = $this->rosterService->updateEntry(
            $validated['employee_id'],
            $validated['date'],
            $validated['shift_id'] ?? null,
            $validated['schedule_type'],
            $validated['notes'] ?? null,
            $validated['status'] ?? 'published',
            $validated['override_reason'] ?? null,
            $validated['roster_id'] ?? null
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'entry' => $entry,
            ]);
        }

        return redirect()->back()->with('success', 'Roster entry updated.');
    }

    /**
     * Schedule an extended shift or extra duty.
     */
    public function extend(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'date' => ['required', 'date'],
            'shift_id' => ['required', 'string', 'exists:shifts,id'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->rosterService->extendShift(
            $validated['employee_id'],
            $validated['date'],
            $validated['shift_id'],
            $validated['notes'] ?? null
        );

        return redirect()->back()->with('success', 'Extended operational duty scheduled successfully.');
    }

    /**
     * Publish or unpublish an entire month roster.
     */
    public function publish(PublishRosterRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $count = $this->rosterService->publishRoster(
            (int) $validated['year'],
            (int) $validated['month'],
            $validated['department_id'] ?? null,
            (bool) $validated['publish']
        );

        $action = $validated['publish'] ? 'published' : 'reverted to draft';

        return redirect()->back()->with('success', "Roster {$action} successfully ({$count} entries updated).");
    }

    /**
     * Clear roster entries for a given month and optional department.
     */
    public function clear(ClearRosterRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $count = $this->rosterService->clearRoster(
            (int) $validated['year'],
            (int) $validated['month'],
            $validated['department_id'] ?? null,
            (bool) ($validated['only_drafts'] ?? false)
        );

        return redirect()->back()->with('success', "Cleared {$count} roster entries.");
    }

    /**
     * Allocate employee(s) to a named roster for a specific date range.
     */
    public function storeAllocation(StoreRosterAllocationRequest $request, Roster $roster): RedirectResponse
    {
        $validated = $request->validated();

        try {
            $count = $this->rosterService->allocateEmployee(
                $roster->id,
                $validated['employee_ids'],
                $validated['effective_from'],
                $validated['effective_to'],
                $validated['pattern_id'] ?? null,
                $validated['notes'] ?? null
            );

            return redirect()->back()->with('success', "{$count} employee(s) successfully allocated to roster '{$roster->name}'.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Remove an employee from a roster (full month or effective date).
     */
    public function removeAllocation(RemoveRosterAllocationRequest $request, Roster $roster): RedirectResponse
    {
        $validated = $request->validated();

        $this->rosterService->deallocateEmployee(
            $roster->id,
            $validated['employee_id'],
            $validated['effective_removal_date'] ?? null
        );

        return redirect()->back()->with('success', "Employee successfully removed from roster '{$roster->name}'.");
    }

    /**
     * Transfer an employee from source roster to target roster starting on transfer date.
     */
    public function transferRoster(TransferRosterAllocationRequest $request, Roster $roster): RedirectResponse
    {
        $validated = $request->validated();

        $this->rosterService->transferEmployee(
            $roster->id,
            $validated['target_roster_id'],
            $validated['employee_id'],
            $validated['transfer_date'],
            $validated['pattern_id'] ?? null
        );

        return redirect()->back()->with('success', "Employee successfully transferred to target roster.");
    }
}
