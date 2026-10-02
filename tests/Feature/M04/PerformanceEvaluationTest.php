<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Company;
use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\EmployeeEvaluation;
use App\Models\Tenant;
use App\Models\User;
use App\Services\EmployeeEvaluationService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PerformanceEvaluationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private User $hodUser;
    private Employee $employee;
    private Department $department;
    private EmployeeEvaluationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Apex Operations PLC',
            'slug' => 'apex-operations',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Apex Operations PLC',
            'code' => 'APEX',
            'is_active' => true,
        ]);

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Engineering',
            'code' => 'ENG',
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'emp_no' => 'EMP-1001',
            'full_name' => 'Kasun Perera',
            'email' => 'kasun.perera@apex.lk',
            'nic' => '199201019999',
            'employment_status' => 'active',
            'date_of_joining' => '2023-01-15',
        ]);

        $hodEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'emp_no' => 'EMP-HOD',
            'full_name' => 'Sunil Shantha (HOD)',
            'email' => 'sunil.hod@apex.lk',
            'nic' => '198001018888',
            'employment_status' => 'active',
            'date_of_joining' => '2020-01-15',
        ]);

        $this->hodUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Sunil Shantha (HOD)',
            'email' => 'sunil.hod@apex.lk',
        ]);
        $this->hodUser->assignRole('Supervisor');

        DepartmentHead::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'employee_id' => $hodEmployee->id,
            'appointed_at' => now(),
        ]);

        $this->hrManager = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Amanda Silva (HR)',
            'email' => 'amanda.hr@apex.lk',
        ]);
        $this->hrManager->assignRole('HR Manager');

        $this->service = app(EmployeeEvaluationService::class);
    }

    public function test_can_calculate_weighted_score_and_grade_accurately(): void
    {
        $ratings = [
            'attendance_punctuality' => ['score' => 90, 'weight' => 20], // 18.0
            'job_performance' => ['score' => 85, 'weight' => 25],        // 21.25
            'teamwork' => ['score' => 80, 'weight' => 20],               // 16.0
            'leadership' => ['score' => 70, 'weight' => 15],             // 10.5
            'technical_skills' => ['score' => 95, 'weight' => 20],       // 19.0
        ];
        // Total expected = 18.0 + 21.25 + 16.0 + 10.5 + 19.0 = 84.75 -> Grade A

        $result = $this->service->calculateOverallScore($ratings);

        $this->assertEquals(84.75, $result['overall_score']);
        $this->assertEquals(EmployeeEvaluation::GRADE_A, $result['performance_grade']);
        $this->assertCount(5, $result['sanitized_ratings']);
    }

    public function test_hod_can_create_draft_and_submit_to_hr(): void
    {
        $response = $this->actingAs($this->hodUser)->post(route('evaluations.store'), [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Annual 2026',
            'evaluation_date' => '2026-10-02',
            'ratings_json' => [
                'attendance_punctuality' => ['score' => 85],
                'job_performance' => ['score' => 90],
                'teamwork' => ['score' => 80],
                'leadership' => ['score' => 85],
                'technical_skills' => ['score' => 90],
            ],
            'hod_comments' => 'Outstanding technical work on system refactoring.',
            'is_draft' => false,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('employee_evaluations', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'evaluator_id' => $this->hodUser->id,
            'evaluation_period' => 'Annual 2026',
            'status' => EmployeeEvaluation::STATUS_SUBMITTED_TO_HR,
            'performance_grade' => EmployeeEvaluation::GRADE_A,
        ]);
    }

    public function test_prevents_duplicate_active_evaluations_for_same_period(): void
    {
        // First evaluation
        $this->service->createEvaluation($this->hodUser, [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Annual 2026',
            'evaluation_date' => '2026-10-02',
            'ratings_json' => [],
        ], false);

        // Attempt second evaluation for the same employee and period
        $response = $this->actingAs($this->hodUser)->post(route('evaluations.store'), [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Annual 2026',
            'evaluation_date' => '2026-10-02',
            'ratings_json' => [],
        ]);

        $response->assertSessionHasErrors('evaluation_period');
    }

    public function test_can_save_as_draft_and_later_submit_to_hr(): void
    {
        $evaluation = $this->service->createEvaluation($this->hodUser, [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Q1 2026',
            'evaluation_date' => '2026-03-31',
            'ratings_json' => [
                'attendance_punctuality' => ['score' => 75],
                'job_performance' => ['score' => 75],
                'teamwork' => ['score' => 75],
                'leadership' => ['score' => 75],
                'technical_skills' => ['score' => 75],
            ],
            'hod_comments' => 'Draft observations pending 1-on-1 interview.',
        ], true);

        $this->assertEquals(EmployeeEvaluation::STATUS_DRAFT, $evaluation->status);

        // Submit draft to HR
        $response = $this->actingAs($this->hodUser)->post(route('evaluations.submit', $evaluation->id));
        $response->assertRedirect();
        $response->assertSessionHas('success');

        $evaluation->refresh();
        $this->assertEquals(EmployeeEvaluation::STATUS_SUBMITTED_TO_HR, $evaluation->status);
    }

    public function test_hr_can_review_and_confirm_evaluation(): void
    {
        $evaluation = $this->service->createEvaluation($this->hodUser, [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Q2 2026',
            'evaluation_date' => '2026-06-30',
            'ratings_json' => [
                'attendance_punctuality' => ['score' => 95],
                'job_performance' => ['score' => 90],
                'teamwork' => ['score' => 90],
                'leadership' => ['score' => 90],
                'technical_skills' => ['score' => 90],
            ],
            'hod_comments' => 'Recommended for senior grade increment.',
        ], false);

        $response = $this->actingAs($this->hrManager)->post(route('evaluations.hr-review', $evaluation->id), [
            'decision' => 'confirm',
            'hr_comments' => 'Confirmed by HR committee. Increment approved.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $evaluation->refresh();
        $this->assertEquals(EmployeeEvaluation::STATUS_CONFIRMED_BY_HR, $evaluation->status);
        $this->assertEquals($this->hrManager->id, $evaluation->hr_reviewer_id);
        $this->assertNotNull($evaluation->hr_actioned_at);
        $this->assertFalse($evaluation->is_bypassed_by_hr);
        $this->assertEquals('Confirmed by HR committee. Increment approved.', $evaluation->hr_comments);
    }

    public function test_hr_can_amend_ratings_and_confirm_directly(): void
    {
        $evaluation = $this->service->createEvaluation($this->hodUser, [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Q3 2026',
            'evaluation_date' => '2026-09-30',
            'ratings_json' => [
                'attendance_punctuality' => ['score' => 70],
                'job_performance' => ['score' => 70],
                'teamwork' => ['score' => 70],
                'leadership' => ['score' => 70],
                'technical_skills' => ['score' => 70],
            ],
        ], false);

        $response = $this->actingAs($this->hrManager)->post(route('evaluations.hr-review', $evaluation->id), [
            'decision' => 'amend_and_confirm',
            'hr_comments' => 'Adjusted upwards due to verified cross-team project delivery.',
            'adjusted_ratings' => [
                'attendance_punctuality' => ['score' => 90],
                'job_performance' => ['score' => 90],
                'teamwork' => ['score' => 90],
                'leadership' => ['score' => 90],
                'technical_skills' => ['score' => 90],
            ],
        ]);

        $response->assertRedirect();
        $evaluation->refresh();

        $this->assertEquals(EmployeeEvaluation::STATUS_CONFIRMED_BY_HR, $evaluation->status);
        $this->assertTrue($evaluation->is_bypassed_by_hr);
        $this->assertEquals(90.0, $evaluation->overall_score);
        $this->assertEquals(EmployeeEvaluation::GRADE_A_PLUS, $evaluation->performance_grade);
    }

    public function test_hr_can_execute_direct_bypass_on_draft(): void
    {
        $draft = $this->service->createEvaluation($this->hodUser, [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Mid-Year 2026',
            'evaluation_date' => '2026-06-30',
            'ratings_json' => [
                'attendance_punctuality' => ['score' => 85],
                'job_performance' => ['score' => 85],
                'teamwork' => ['score' => 85],
                'leadership' => ['score' => 85],
                'technical_skills' => ['score' => 85],
            ],
        ], true);

        $response = $this->actingAs($this->hrManager)->post(route('evaluations.hr-review', $draft->id), [
            'decision' => 'confirm',
            'direct_bypass' => true,
            'hr_comments' => 'Managerial bypass applied during HOD overseas leave.',
        ]);

        $response->assertRedirect();
        $draft->refresh();

        $this->assertEquals(EmployeeEvaluation::STATUS_CONFIRMED_BY_HR, $draft->status);
        $this->assertTrue($draft->is_bypassed_by_hr);
    }

    public function test_can_generate_pdf_appraisal(): void
    {
        $evaluation = $this->service->createEvaluation($this->hodUser, [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Probation Review',
            'evaluation_date' => '2026-07-15',
            'ratings_json' => [
                'attendance_punctuality' => ['score' => 92, 'remarks' => 'Zero late punches.'],
                'job_performance' => ['score' => 88, 'remarks' => 'Quick learner.'],
                'teamwork' => ['score' => 90, 'remarks' => 'Great team fit.'],
                'leadership' => ['score' => 80, 'remarks' => 'Takes initiative.'],
                'technical_skills' => ['score' => 94, 'remarks' => 'Solid PHP / React skills.'],
            ],
            'hod_comments' => 'Highly recommended for full permanent confirmation.',
        ], false);

        $response = $this->actingAs($this->hrManager)->get(route('evaluations.pdf', $evaluation->id));

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('Content-Type'));
    }

    public function test_statistics_aggregation(): void
    {
        // Evaluation 1: 90 score -> Confirmed
        $eval1 = $this->service->createEvaluation($this->hodUser, [
            'employee_id' => $this->employee->id,
            'evaluation_period' => 'Period-A',
            'evaluation_date' => '2026-01-01',
            'ratings_json' => [
                'attendance_punctuality' => ['score' => 90],
                'job_performance' => ['score' => 90],
                'teamwork' => ['score' => 90],
                'leadership' => ['score' => 90],
                'technical_skills' => ['score' => 90],
            ],
        ], false);
        $this->service->hrReview($eval1, $this->hrManager, 'confirm');

        $stats = $this->service->getStatistics($this->tenant->id);

        $this->assertEquals(1, $stats['total']);
        $this->assertEquals(1, $stats['confirmed']);
        $this->assertEquals(0, $stats['pending_hr']);
        $this->assertEquals(90.0, $stats['average_score']);
        $this->assertEquals(EmployeeEvaluation::GRADE_A_PLUS, $stats['average_grade']);
        $this->assertEquals(1, $stats['grade_counts']['A+']);
    }
}
