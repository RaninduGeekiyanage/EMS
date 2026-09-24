<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Roster\ClearRosterRequest;
use App\Http\Requests\Roster\GenerateRosterRequest;
use App\Http\Requests\Roster\PublishRosterRequest;
use App\Http\Requests\Roster\UpdateRosterEntryRequest;
use App\Models\Roster;
use App\Models\RosterGroup;
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
        $squadId = $request->input('squad_id');

        $data = $this->rosterService->getMonthMatrix($year, $month, $departmentId, $rosterId, $squadId);

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
            'generation_mode' => ['required', 'string', 'in:auto_stagger_squads,multi_pattern,direct_pattern,blank'],
            'base_pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
            'squad_count' => ['nullable', 'integer', 'min:2', 'max:26'],
            'stagger_days' => ['nullable', 'integer', 'min:1', 'max:31'],
            'pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string', 'exists:employees,id'],
            'squads' => ['nullable', 'array'],
            'squads.*.name' => ['nullable', 'string', 'max:100'],
            'squads.*.code' => ['nullable', 'string', 'max:50'],
            'squads.*.color' => ['nullable', 'string', 'max:20'],
            'squads.*.pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
            'squads.*.offset_days' => ['nullable', 'integer', 'min:0'],
            'squads.*.employee_ids' => ['nullable', 'array'],
            'squads.*.employee_ids.*' => ['string', 'exists:employees,id'],
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

            return redirect()->route('roster.index')->with('success', "Roster deleted successfully.");
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
     * Clone a Named Roster, its Squads, and Member Enrollments to a new date range.
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
        ])->with('success', "Roster cloned to '{$newRoster->name}' successfully with squads and enrollments.");
    }

    /**
     * Synchronize and recalculate calendar entries for all squads in a Named Roster.
     */
    public function syncRoster(Roster $roster): RedirectResponse
    {
        $result = $this->rosterService->syncRosterDates($roster);

        return redirect()->back()->with(
            'success',
            "Roster '{$roster->name}' synchronized successfully ({$result['created']} created, {$result['updated']} refreshed)."
        );
    }

    /**
     * Create a new Master Company Squad (without a specific roster).
     */
    public function storeSquadStandalone(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:20'],
            'roster_pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
            'description' => ['nullable', 'string'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string', 'exists:employees,id'],
        ]);

        try {
            $this->rosterService->createSquad(null, $validated);

            return redirect()->back()->with('success', "Master squad '{$validated['name']}' created successfully.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Create a new Squad under a Roster.
     */
    public function storeSquad(Request $request, Roster $roster): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:20'],
            'roster_pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
            'description' => ['nullable', 'string'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string', 'exists:employees,id'],
        ]);

        try {
            $this->rosterService->createSquad($roster, $validated);

            return redirect()->back()->with('success', 'Squad created successfully.');
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Update an existing Squad.
     */
    public function updateSquad(Request $request, RosterGroup $squad): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:20'],
            'roster_pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
            'description' => ['nullable', 'string'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string', 'exists:employees,id'],
        ]);

        try {
            $this->rosterService->updateSquad($squad, $validated);

            return redirect()->back()->with('success', "Squad '{$squad->name}' updated successfully.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Delete a Squad.
     */
    public function destroySquad(RosterGroup $squad): RedirectResponse
    {
        try {
            $name = $squad->name;
            $this->rosterService->deleteSquad($squad);

            return redirect()->back()->with('success', "Squad '{$name}' deleted successfully.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Enroll one or more employees into a Squad.
     */
    public function enrollSquadMembers(Request $request, RosterGroup $squad): RedirectResponse
    {
        $validated = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['required', 'string', 'exists:employees,id'],
            'effective_start_date' => ['nullable', 'date'],
            'effective_end_date' => ['nullable', 'date'],
        ]);

        try {
            $enrolled = $this->rosterService->enrollEmployees(
                $squad,
                $validated['employee_ids'],
                $validated['effective_start_date'] ?? null,
                $validated['effective_end_date'] ?? null
            );
            $count = count($enrolled);

            return redirect()->back()->with('success', "{$count} staff member(s) enrolled into {$squad->name}.");
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Transfer an employee into a Squad from an effective date.
     */
    public function transferSquadMember(Request $request, RosterGroup $squad): RedirectResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'effective_date' => ['required', 'date'],
        ]);

        try {
            $result = $this->rosterService->transferEmployeeSquad(
                $squad,
                $validated['employee_id'],
                $validated['effective_date']
            );

            return redirect()->back()->with(
                'success',
                "Staff member '{$result['employee']->full_name}' transferred to {$squad->name} effective from {$result['effective_date']}."
            );
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    /**
     * Remove an employee from a Squad.
     */
    public function removeSquadMember(Request $request, RosterGroup $squad): RedirectResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'effective_date' => ['nullable', 'date'],
        ]);

        try {
            $this->rosterService->removeEmployeeFromSquad(
                $squad,
                $validated['employee_id'],
                $validated['effective_date'] ?? null
            );

            return redirect()->back()->with('success', 'Employee squad assignment updated successfully.');
        } catch (\DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
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
            $validated['roster_id'] ?? null,
            $validated['roster_group_id'] ?? null
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
}
