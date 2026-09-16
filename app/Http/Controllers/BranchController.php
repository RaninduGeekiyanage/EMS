<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Branch\StoreBranchRequest;
use App\Http\Requests\Branch\UpdateBranchRequest;
use App\Services\CompanyService;
use Illuminate\Http\RedirectResponse;

final class BranchController extends Controller
{
    public function __construct(
        private readonly CompanyService $companyService,
    ) {}

    /**
     * Store a newly created branch.
     */
    public function store(StoreBranchRequest $request): RedirectResponse
    {
        $this->companyService->createBranch($request->validated());

        return redirect()->back()->with('success', 'Branch created successfully.');
    }

    /**
     * Update the specified branch.
     */
    public function update(UpdateBranchRequest $request, string $branch): RedirectResponse
    {
        $this->companyService->updateBranch($branch, $request->validated());

        return redirect()->back()->with('success', 'Branch updated successfully.');
    }

    /**
     * Remove the specified branch.
     */
    public function destroy(string $branch): RedirectResponse
    {
        $this->companyService->deleteBranch($branch);

        return redirect()->back()->with('success', 'Branch deleted successfully.');
    }
}
