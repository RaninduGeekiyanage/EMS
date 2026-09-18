<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Roster\ClearRosterRequest;
use App\Http\Requests\Roster\GenerateRosterRequest;
use App\Http\Requests\Roster\PublishRosterRequest;
use App\Http\Requests\Roster\SwapRosterRequest;
use App\Http\Requests\Roster\UpdateRosterEntryRequest;
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

        $data = $this->rosterService->getMonthMatrix($year, $month, $departmentId);

        return Inertia::render('Roster/Index', $data);
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
     * Update single cell roster entry.
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
            $validated['status'] ?? 'published'
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
     * Atomic shift swap between two employees on a given date.
     */
    public function swap(SwapRosterRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $this->rosterService->swapShift(
            $validated['employee_a_id'],
            $validated['employee_b_id'],
            $validated['date']
        );

        return redirect()->back()->with('success', 'Shifts swapped successfully.');
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
