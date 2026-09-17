<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Services\PayslipGeneratorService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class PayslipController extends Controller
{
    public function __construct(
        private readonly PayslipGeneratorService $payslipService,
    ) {}

    /**
     * Download individual employee payslip PDF.
     */
    public function download(PayrollEmployee $payrollEmployee, Request $request): Response
    {
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollEmployee->tenant_id !== $tenant->id) {
            abort(404, 'Payroll record not found.');
        }

        $pdf = $this->payslipService->generate($payrollEmployee);

        $empNo = $payrollEmployee->employee?->emp_no ?? 'EMP';
        $period = $payrollEmployee->payrollRun?->period_label ?? date('Y-m');
        $filename = "Payslip-{$empNo}-" . str_replace(' ', '-', $period) . '.pdf';

        return $pdf->download($filename);
    }

    /**
     * Preview individual employee payslip PDF in browser stream.
     */
    public function stream(PayrollEmployee $payrollEmployee, Request $request): Response
    {
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollEmployee->tenant_id !== $tenant->id) {
            abort(404, 'Payroll record not found.');
        }

        $pdf = $this->payslipService->generate($payrollEmployee);

        $empNo = $payrollEmployee->employee?->emp_no ?? 'EMP';
        $filename = "Payslip-{$empNo}.pdf";

        return $pdf->stream($filename);
    }

    /**
     * Download multi-page bulk payslips PDF for a payroll run.
     */
    public function bulk(PayrollRun $payrollRun, Request $request): Response
    {
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        $departmentId = $request->query('department_id');
        $pdf = $this->payslipService->generateBulk(
            $payrollRun,
            is_string($departmentId) ? $departmentId : null
        );

        $period = str_replace(' ', '-', $payrollRun->period_label);
        $filename = "Bulk-Payslips-{$period}.pdf";

        return $pdf->download($filename);
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
