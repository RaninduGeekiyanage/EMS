<?php

declare(strict_types=1);

namespace App\Services\Payroll;

use App\Models\Employee;
use App\Models\PayItem;
use App\Models\PayrollMonthlyAdjustment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class PayrollAdjustmentService
{
    /**
     * Create an individual monthly variable adjustment.
     *
     * @param array<string, mixed> $data
     */
    public function createAdjustment(Tenant $tenant, array $data, ?User $creator = null): PayrollMonthlyAdjustment
    {
        $employee = Employee::where('tenant_id', $tenant->id)->findOrFail($data['employee_id']);

        $amount = round((float) ($data['amount'] ?? 0.00), 2);
        if ($amount <= 0.00) {
            throw new InvalidArgumentException('Adjustment amount must be greater than zero.');
        }

        $year = (int) ($data['period_year'] ?? date('Y'));
        $month = (int) ($data['period_month'] ?? date('n'));
        if ($month < 1 || $month > 12) {
            throw new InvalidArgumentException("Invalid period month: {$month}");
        }

        $entryType = in_array($data['entry_type'] ?? 'addition', ['addition', 'deduction'], true)
            ? $data['entry_type']
            : 'addition';

        $payItemId = ! empty($data['pay_item_id']) ? $data['pay_item_id'] : null;
        $isEpf = (bool) ($data['is_epf_eligible'] ?? false);
        $isEtf = (bool) ($data['is_etf_eligible'] ?? false);
        $isTaxable = (bool) ($data['is_taxable'] ?? false);

        if ($payItemId !== null) {
            $payItem = PayItem::where('tenant_id', $tenant->id)->find($payItemId);
            if ($payItem !== null) {
                // If not explicitly provided, adopt pay item flags
                $isEpf = $data['is_epf_eligible'] ?? $payItem->is_epf_eligible;
                $isEtf = $data['is_etf_eligible'] ?? $payItem->is_etf_eligible;
                $isTaxable = $data['is_taxable'] ?? $payItem->is_taxable;
            }
        }

        return PayrollMonthlyAdjustment::create([
            'tenant_id' => $tenant->id,
            'employee_id' => $employee->id,
            'pay_item_id' => $payItemId,
            'period_year' => $year,
            'period_month' => $month,
            'entry_type' => $entryType,
            'title' => trim((string) ($data['title'] ?? 'Monthly Variable Adjustment')),
            'amount' => $amount,
            'is_epf_eligible' => $isEpf,
            'is_etf_eligible' => $isEtf,
            'is_taxable' => $isTaxable,
            'status' => $data['status'] ?? 'approved',
            'remarks' => $data['remarks'] ?? null,
            'created_by' => $creator?->id,
            'approved_by' => ($data['status'] ?? 'approved') === 'approved' ? $creator?->id : null,
        ]);
    }

    /**
     * Approve a pending adjustment.
     */
    public function approveAdjustment(PayrollMonthlyAdjustment $adjustment, ?User $approver = null): PayrollMonthlyAdjustment
    {
        $adjustment->update([
            'status' => 'approved',
            'approved_by' => $approver?->id,
        ]);

        return $adjustment->fresh();
    }

    /**
     * Delete an adjustment.
     */
    public function deleteAdjustment(PayrollMonthlyAdjustment $adjustment): bool
    {
        if ($adjustment->status === 'processed') {
            throw new InvalidArgumentException('Processed adjustments linked to completed payroll runs cannot be deleted.');
        }

        return (bool) $adjustment->delete();
    }

    /**
     * Bulk create multiple adjustments in a single transaction.
     *
     * @param array<int, array<string, mixed>> $records
     * @return Collection<int, PayrollMonthlyAdjustment>
     */
    public function bulkCreateAdjustments(Tenant $tenant, array $records, ?User $creator = null): Collection
    {
        return DB::transaction(function () use ($tenant, $records, $creator): Collection {
            $created = collect();
            foreach ($records as $record) {
                $created->push($this->createAdjustment($tenant, $record, $creator));
            }

            return $created;
        });
    }
}
