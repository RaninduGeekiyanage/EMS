<?php

declare(strict_types=1);

namespace App\Services\Payroll;

use App\Models\Employee;
use App\Models\EmployeePayItem;
use App\Models\PayItem;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use InvalidArgumentException;

final class PayItemService
{
    /**
     * Standard Sri Lankan pay item catalog definitions.
     *
     * @var array<int, array<string, mixed>>
     */
    public const STANDARD_PAY_ITEMS = [
        [
            'code' => 'BASIC',
            'name' => 'Basic Salary',
            'item_type' => 'earning',
            'calculation_type' => 'fixed',
            'default_amount' => 0.00,
            'is_epf_eligible' => true,
            'is_etf_eligible' => true,
            'is_taxable' => true,
            'is_system_reserved' => true,
            'display_order' => 1,
            'description' => 'Contractual basic salary governed by Shop & Office / Wages Board Ordinances.',
        ],
        [
            'code' => 'BRA_2005',
            'name' => 'Budgetary Relief Allowance 2005 (Act No. 36)',
            'item_type' => 'earning',
            'calculation_type' => 'fixed',
            'default_amount' => 1000.00,
            'is_epf_eligible' => true,
            'is_etf_eligible' => true,
            'is_taxable' => true,
            'is_system_reserved' => true,
            'display_order' => 2,
            'description' => 'Statutory BRA under Act No. 36 of 2005. Mandatory inclusion in EPF/ETF earnings.',
        ],
        [
            'code' => 'BRA_2016',
            'name' => 'Budgetary Relief Allowance 2016 (Act No. 4)',
            'item_type' => 'earning',
            'calculation_type' => 'fixed',
            'default_amount' => 2500.00,
            'is_epf_eligible' => true,
            'is_etf_eligible' => true,
            'is_taxable' => true,
            'is_system_reserved' => true,
            'display_order' => 3,
            'description' => 'Statutory BRA under Act No. 4 of 2016. Mandatory inclusion in EPF/ETF earnings.',
        ],
        [
            'code' => 'ATTENDANCE_INCENTIVE',
            'name' => 'Attendance Incentive Allowance',
            'item_type' => 'earning',
            'calculation_type' => 'fixed',
            'default_amount' => 5000.00,
            'is_epf_eligible' => false,
            'is_etf_eligible' => false,
            'is_taxable' => true,
            'is_system_reserved' => false,
            'display_order' => 4,
            'description' => 'Incentive for completing full monthly shifts without unapproved absences.',
        ],
        [
            'code' => 'TRAVELLING_ALLOWANCE',
            'name' => 'Travelling & Fuel Allowance',
            'item_type' => 'earning',
            'calculation_type' => 'fixed',
            'default_amount' => 10000.00,
            'is_epf_eligible' => false,
            'is_etf_eligible' => false,
            'is_taxable' => false,
            'is_system_reserved' => false,
            'display_order' => 5,
            'description' => 'Fixed reimbursement for employee transport, travel duties and fuel expenses.',
        ],
        [
            'code' => 'PERFORMANCE_BONUS',
            'name' => 'Performance Allowance',
            'item_type' => 'earning',
            'calculation_type' => 'fixed',
            'default_amount' => 7500.00,
            'is_epf_eligible' => false,
            'is_etf_eligible' => false,
            'is_taxable' => true,
            'is_system_reserved' => false,
            'display_order' => 6,
            'description' => 'Monthly performance or productivity incentive.',
        ],
        [
            'code' => 'SALARY_ADVANCE',
            'name' => 'Salary Advance',
            'item_type' => 'deduction',
            'calculation_type' => 'fixed',
            'default_amount' => 0.00,
            'is_epf_eligible' => false,
            'is_etf_eligible' => false,
            'is_taxable' => false,
            'is_system_reserved' => true,
            'display_order' => 7,
            'description' => 'Mid-month cash advance recovered in full during payroll processing.',
        ],
        [
            'code' => 'STAFF_LOAN',
            'name' => 'Staff Loan Deduction',
            'item_type' => 'deduction',
            'calculation_type' => 'fixed',
            'default_amount' => 0.00,
            'is_epf_eligible' => false,
            'is_etf_eligible' => false,
            'is_taxable' => false,
            'is_system_reserved' => true,
            'display_order' => 8,
            'description' => 'Automated monthly deduction of active company staff loan installment.',
        ],
        [
            'code' => 'WELFARE_DEDUCTION',
            'name' => 'Staff Welfare Society',
            'item_type' => 'deduction',
            'calculation_type' => 'fixed',
            'default_amount' => 500.00,
            'is_epf_eligible' => false,
            'is_etf_eligible' => false,
            'is_taxable' => false,
            'is_system_reserved' => false,
            'display_order' => 9,
            'description' => 'Monthly membership contribution to the Employee Welfare Society.',
        ],
    ];

    /**
     * Seed or sync Sri Lankan standard statutory and common pay items for a tenant.
     *
     * @return Collection<int, PayItem>
     */
    public function seedStandardPayItems(Tenant $tenant): Collection
    {
        $items = collect();

        foreach (self::STANDARD_PAY_ITEMS as $itemData) {
            $item = PayItem::updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'code' => $itemData['code'],
                ],
                [
                    'name' => $itemData['name'],
                    'item_type' => $itemData['item_type'],
                    'calculation_type' => $itemData['calculation_type'],
                    'default_amount' => $itemData['default_amount'],
                    'percentage' => $itemData['percentage'] ?? null,
                    'is_epf_eligible' => $itemData['is_epf_eligible'],
                    'is_etf_eligible' => $itemData['is_etf_eligible'],
                    'is_taxable' => $itemData['is_taxable'],
                    'is_active' => true,
                    'is_system_reserved' => $itemData['is_system_reserved'],
                    'display_order' => $itemData['display_order'],
                    'description' => $itemData['description'],
                ]
            );

            $items->push($item);
        }

        return $items;
    }

    /**
     * Create a new custom pay item.
     *
     * @param array<string, mixed> $data
     */
    public function createPayItem(Tenant $tenant, array $data): PayItem
    {
        $code = strtoupper(trim((string) ($data['code'] ?? '')));
        $code = preg_replace('/[^A-Z0-9_]/', '_', $code) ?: 'PAY_ITEM_' . time();

        return PayItem::create([
            'tenant_id' => $tenant->id,
            'code' => $code,
            'name' => trim((string) ($data['name'] ?? '')),
            'item_type' => $data['item_type'] ?? 'earning',
            'calculation_type' => $data['calculation_type'] ?? 'fixed',
            'default_amount' => (float) ($data['default_amount'] ?? 0.00),
            'percentage' => isset($data['percentage']) && $data['percentage'] !== '' ? (float) $data['percentage'] : null,
            'is_epf_eligible' => (bool) ($data['is_epf_eligible'] ?? false),
            'is_etf_eligible' => (bool) ($data['is_etf_eligible'] ?? false),
            'is_taxable' => (bool) ($data['is_taxable'] ?? false),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'is_system_reserved' => false,
            'display_order' => (int) ($data['display_order'] ?? 10),
            'description' => $data['description'] ?? null,
        ]);
    }

    /**
     * Update an existing pay item.
     *
     * @param array<string, mixed> $data
     */
    public function updatePayItem(PayItem $payItem, array $data): PayItem
    {
        // Reserved system codes cannot have their code or core reserved status altered
        $updateData = [
            'name' => trim((string) ($data['name'] ?? $payItem->name)),
            'default_amount' => isset($data['default_amount']) ? (float) $data['default_amount'] : $payItem->default_amount,
            'percentage' => isset($data['percentage']) && $data['percentage'] !== '' ? (float) $data['percentage'] : $payItem->percentage,
            'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : $payItem->is_active,
            'display_order' => isset($data['display_order']) ? (int) $data['display_order'] : $payItem->display_order,
            'description' => array_key_exists('description', $data) ? $data['description'] : $payItem->description,
        ];

        if (! $payItem->is_system_reserved) {
            $updateData['item_type'] = $data['item_type'] ?? $payItem->item_type;
            $updateData['calculation_type'] = $data['calculation_type'] ?? $payItem->calculation_type;
            $updateData['is_epf_eligible'] = (bool) ($data['is_epf_eligible'] ?? $payItem->is_epf_eligible);
            $updateData['is_etf_eligible'] = (bool) ($data['is_etf_eligible'] ?? $payItem->is_etf_eligible);
            $updateData['is_taxable'] = (bool) ($data['is_taxable'] ?? $payItem->is_taxable);
        }

        $payItem->update($updateData);

        return $payItem->fresh();
    }

    /**
     * Delete a non-reserved pay item.
     */
    public function deletePayItem(PayItem $payItem): bool
    {
        if ($payItem->is_system_reserved) {
            throw new InvalidArgumentException("System reserved pay item '{$payItem->code}' cannot be deleted.");
        }

        return (bool) $payItem->delete();
    }

    /**
     * Assign a recurring pay item to an employee.
     *
     * @param array<string, mixed> $data
     */
    public function assignPayItemToEmployee(Tenant $tenant, array $data): EmployeePayItem
    {
        $employee = Employee::where('tenant_id', $tenant->id)->findOrFail($data['employee_id']);
        $payItem = PayItem::where('tenant_id', $tenant->id)->findOrFail($data['pay_item_id']);

        return EmployeePayItem::updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'employee_id' => $employee->id,
                'pay_item_id' => $payItem->id,
            ],
            [
                'amount' => (float) ($data['amount'] ?? $payItem->default_amount),
                'effective_from' => $data['effective_from'] ?? Carbon::now()->startOfMonth()->toDateString(),
                'effective_to' => ! empty($data['effective_to']) ? $data['effective_to'] : null,
                'is_active' => (bool) ($data['is_active'] ?? true),
                'remarks' => $data['remarks'] ?? null,
            ]
        );
    }

    /**
     * Remove or deactivate an employee pay item.
     */
    public function removeEmployeePayItem(EmployeePayItem $employeePayItem): bool
    {
        return (bool) $employeePayItem->delete();
    }
}
