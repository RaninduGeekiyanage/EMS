<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Company\UpdateCompanyRequest;
use App\Models\Tenant;
use App\Services\CompanyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class CompanyController extends Controller
{
    public function __construct(
        private readonly CompanyService $companyService,
    ) {}

    /**
     * Display the company profile and associated branches.
     */
    public function profile(Request $request): Response
    {
        $tenantId = (string) (session('tenant_id') ?? app('current_tenant_id'));
        $tenant = app()->has('current_tenant') ? app('current_tenant') : Tenant::find($tenantId);
        $defaultName = $tenant !== null ? $tenant->name : 'EMS Company';

        $company = $this->companyService->getOrCreateCompany($tenantId, $defaultName);
        $branches = $this->companyService->listBranches((string) $company->id);

        return Inertia::render('Company/Profile', [
            'company' => $company,
            'branches' => $branches,
        ]);
    }

    /**
     * Update the company profile.
     */
    public function update(UpdateCompanyRequest $request, string $company): RedirectResponse
    {
        $this->companyService->updateCompany($company, $request->validated());

        return redirect()->back()->with('success', 'Company profile updated successfully.');
    }
}
