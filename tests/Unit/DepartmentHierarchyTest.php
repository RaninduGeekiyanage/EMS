<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Tenant;
use App\Services\CompanyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

final class DepartmentHierarchyTest extends TestCase
{
    use RefreshDatabase;

    private CompanyService $companyService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyService = app(CompanyService::class);
    }

    public function test_department_recursive_tree_structure(): void
    {
        $tenant = Tenant::create([
            'name' => 'Delta Tech',
            'slug' => 'delta',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $parent = $this->companyService->createDepartment([
            'tenant_id' => $tenant->id,
            'name' => 'Engineering',
            'code' => 'ENG',
            'cost_center' => 'CC-ENG',
            'is_active' => true,
        ]);

        $child1 = $this->companyService->createDepartment([
            'tenant_id' => $tenant->id,
            'name' => 'Frontend Systems',
            'code' => 'ENG-FE',
            'parent_id' => $parent->id,
            'cost_center' => 'CC-ENG-FE',
            'is_active' => true,
        ]);

        $child2 = $this->companyService->createDepartment([
            'tenant_id' => $tenant->id,
            'name' => 'Backend Core',
            'code' => 'ENG-BE',
            'parent_id' => $parent->id,
            'cost_center' => 'CC-ENG-BE',
            'is_active' => true,
        ]);

        $tree = $this->companyService->getDepartmentTree();

        $this->assertCount(1, $tree);
        $this->assertEquals('Engineering', $tree->first()->name);
        $this->assertCount(2, $tree->first()->children);
        $this->assertEquals($parent->id, $child1->parent->id);
    }

    public function test_cannot_set_department_as_its_own_parent(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $tenant = Tenant::create([
            'name' => 'Epsilon Org',
            'slug' => 'epsilon',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $dept = $this->companyService->createDepartment([
            'tenant_id' => $tenant->id,
            'name' => 'Finance',
            'code' => 'FIN',
        ]);

        $this->companyService->updateDepartment((string) $dept->id, [
            'parent_id' => (string) $dept->id,
        ]);
    }
}
