<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Scopes\TenantScope;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['web', 'tenant'])->group(function (): void {
            Route::get('/test/tenant-context', function () {
                return response()->json([
                    'tenant_id' => app('current_tenant_id'),
                    'tenant_slug' => app('current_tenant')->slug,
                    'settings_count' => TenantSetting::count(),
                    'settings' => TenantSetting::pluck('value', 'key'),
                ]);
            });
        });

        Route::middleware(['web', 'tenant:optional'])->group(function (): void {
            Route::get('/test/optional-tenant', function () {
                return response()->json([
                    'has_tenant' => app()->has('current_tenant'),
                ]);
            });
        });
    }

    public function test_resolves_tenant_via_x_tenant_id_header(): void
    {
        $tenant = Tenant::create([
            'name' => 'Header Corp',
            'slug' => 'header-corp',
            'is_active' => true,
        ]);

        $response = $this->withHeader('X-Tenant-ID', $tenant->id)
            ->getJson('/test/tenant-context');

        $response->assertStatus(200);
        $response->assertJson([
            'tenant_id' => $tenant->id,
            'tenant_slug' => 'header-corp',
        ]);
    }

    public function test_resolves_tenant_via_x_tenant_slug_header(): void
    {
        $tenant = Tenant::create([
            'name' => 'Slug Enterprises',
            'slug' => 'slug-enterprises',
            'is_active' => true,
        ]);

        $response = $this->withHeader('X-Tenant-Slug', 'slug-enterprises')
            ->getJson('/test/tenant-context');

        $response->assertStatus(200);
        $response->assertJson([
            'tenant_id' => $tenant->id,
            'tenant_slug' => 'slug-enterprises',
        ]);
    }

    public function test_blocks_inactive_tenant_with_forbidden(): void
    {
        $tenant = Tenant::create([
            'name' => 'Suspended Co',
            'slug' => 'suspended-co',
            'is_active' => false,
        ]);

        $response = $this->withHeader('X-Tenant-ID', $tenant->id)
            ->getJson('/test/tenant-context');

        $response->assertStatus(403);
    }

    public function test_returns_404_when_required_tenant_is_missing(): void
    {
        $response = $this->getJson('/test/tenant-context');

        $response->assertStatus(404);
    }

    public function test_optional_tenant_route_succeeds_without_tenant(): void
    {
        $response = $this->getJson('/test/optional-tenant');

        $response->assertStatus(200);
        $response->assertJson([
            'has_tenant' => false,
        ]);
    }

    public function test_tenant_isolation_prevents_cross_tenant_data_leakage(): void
    {
        $tenantA = Tenant::create([
            'name' => 'Tenant Alpha',
            'slug' => 'alpha',
            'is_active' => true,
        ]);

        $tenantB = Tenant::create([
            'name' => 'Tenant Beta',
            'slug' => 'beta',
            'is_active' => true,
        ]);

        TenantSetting::withoutGlobalScope(TenantScope::class)->create([
            'tenant_id' => $tenantA->id,
            'key' => 'secret_key',
            'value' => 'alpha-secret',
        ]);

        TenantSetting::withoutGlobalScope(TenantScope::class)->create([
            'tenant_id' => $tenantB->id,
            'key' => 'secret_key',
            'value' => 'beta-secret',
        ]);

        // Request as Tenant Alpha
        $responseA = $this->withHeader('X-Tenant-ID', $tenantA->id)
            ->getJson('/test/tenant-context');

        $responseA->assertStatus(200);
        $responseA->assertJson([
            'tenant_id' => $tenantA->id,
            'settings_count' => 1,
            'settings' => ['secret_key' => 'alpha-secret'],
        ]);
        $responseA->assertJsonMissing(['beta-secret']);

        // Request as Tenant Beta
        $responseB = $this->withHeader('X-Tenant-ID', $tenantB->id)
            ->getJson('/test/tenant-context');

        $responseB->assertStatus(200);
        $responseB->assertJson([
            'tenant_id' => $tenantB->id,
            'settings_count' => 1,
            'settings' => ['secret_key' => 'beta-secret'],
        ]);
        $responseB->assertJsonMissing(['alpha-secret']);
    }
}
