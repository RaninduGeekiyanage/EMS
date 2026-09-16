<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Scopes\TenantScope;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_can_be_created_with_ulid(): void
    {
        $tenant = Tenant::create([
            'name' => 'Acme Corporation',
            'slug' => 'acme',
            'is_active' => true,
        ]);

        $this->assertNotEmpty($tenant->id);
        $this->assertSame(26, strlen($tenant->id));
        $this->assertSame('acme', $tenant->slug);
        $this->assertTrue($tenant->is_active);
    }

    public function test_tenant_settings_can_be_stored_and_retrieved(): void
    {
        $tenant = Tenant::create([
            'name' => 'Apex Logistics',
            'slug' => 'apex',
            'is_active' => true,
        ]);

        $tenant->setSetting('epf_employee_rate', 8.00);
        $tenant->setSetting('ot_weekday_rate', 1.5);

        $this->assertSame('8', (string) $tenant->getSetting('epf_employee_rate'));
        $this->assertSame('1.5', (string) $tenant->getSetting('ot_weekday_rate'));
        $this->assertSame('default_val', $tenant->getSetting('non_existent', 'default_val'));
    }

    public function test_tenant_scope_filters_models_to_active_tenant(): void
    {
        $tenantA = Tenant::create([
            'name' => 'Tenant A',
            'slug' => 'tenant-a',
            'is_active' => true,
        ]);

        $tenantB = Tenant::create([
            'name' => 'Tenant B',
            'slug' => 'tenant-b',
            'is_active' => true,
        ]);

        // Explicitly create settings for both tenants without scope
        TenantSetting::withoutGlobalScope(TenantScope::class)->create([
            'tenant_id' => $tenantA->id,
            'key' => 'currency',
            'value' => 'LKR',
        ]);

        TenantSetting::withoutGlobalScope(TenantScope::class)->create([
            'tenant_id' => $tenantB->id,
            'key' => 'currency',
            'value' => 'USD',
        ]);

        // When session has tenant A
        session(['tenant_id' => $tenantA->id]);

        $settings = TenantSetting::all();
        $this->assertCount(1, $settings);
        $this->assertSame('LKR', $settings->first()->value);
        $this->assertSame($tenantA->id, $settings->first()->tenant_id);

        // When session has tenant B
        session(['tenant_id' => $tenantB->id]);

        $settingsB = TenantSetting::all();
        $this->assertCount(1, $settingsB);
        $this->assertSame('USD', $settingsB->first()->value);
        $this->assertSame($tenantB->id, $settingsB->first()->tenant_id);

        // Super Admin bypass using withoutGlobalScope
        $allSettings = TenantSetting::withoutGlobalScope(TenantScope::class)->get();
        $this->assertCount(2, $allSettings);
    }

    public function test_belongs_to_tenant_trait_auto_assigns_tenant_id_on_create(): void
    {
        $tenant = Tenant::create([
            'name' => 'Auto Tenant',
            'slug' => 'auto-tenant',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        // Create setting without explicitly setting tenant_id
        $setting = TenantSetting::create([
            'key' => 'date_format',
            'value' => 'Y-m-d',
        ]);

        $this->assertSame($tenant->id, $setting->tenant_id);
        $this->assertNotNull($setting->id);
        $this->assertSame(26, strlen($setting->id));
    }
}
