<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\BankExportLog;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Services\BankExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class BankExportController extends Controller
{
    public function __construct(
        private readonly BankExportService $exportService,
    ) {}

    /**
     * Generate and download bank transfer disbursal file for a payroll run.
     */
    public function export(PayrollRun $payrollRun, Request $request): Response
    {
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        $bankCode = (string) $request->input('bank_code', $request->query('bank_code', 'boc'));
        $filterByBank = $request->boolean('filter_by_bank', false);
        $originatingAccount = $request->input('originating_account');

        $result = $this->exportService->export(
            payrollRun: $payrollRun,
            bankCode: $bankCode,
            exportedByUser: $request->user(),
            options: [
                'filter_by_bank' => $filterByBank,
                'originating_account' => $originatingAccount,
            ]
        );

        return response($result['content'], 200, [
            'Content-Type' => $result['mime'],
            'Content-Disposition' => "attachment; filename=\"{$result['filename']}\"",
            'X-Record-Count' => (string) $result['record_count'],
            'X-Total-Amount' => (string) $result['total_amount'],
        ]);
    }

    /**
     * Get list of supported banks and export logs for this payroll run.
     */
    public function banks(PayrollRun $payrollRun, Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        $logs = BankExportLog::query()
            ->where('payroll_run_id', $payrollRun->id)
            ->with('exportedBy:id,name')
            ->latest()
            ->get();

        return response()->json([
            'available_banks' => $this->exportService->getAvailableBanks(),
            'export_history' => $logs,
        ]);
    }

    /**
     * Resolve active tenant from app context or session.
     */
    private function resolveTenant(Request $request): ?Tenant
    {
        if (app()->bound('current_tenant')) {
            return app('current_tenant');
        }

        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        if ($tenantId !== null) {
            return Tenant::find($tenantId);
        }

        return $request->user()?->tenant;
    }
}
