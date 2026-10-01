<?php

namespace App\Providers;

use App\Repositories\Contracts\BranchRepositoryInterface;
use App\Repositories\Contracts\CompanyRepositoryInterface;
use App\Repositories\Contracts\DepartmentRepositoryInterface;
use App\Repositories\Contracts\EmployeeRepositoryInterface;
use App\Repositories\Eloquent\BranchRepository;
use App\Repositories\Eloquent\CompanyRepository;
use App\Repositories\Eloquent\DepartmentRepository;
use App\Repositories\Eloquent\EmployeeRepository;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            CompanyRepositoryInterface::class,
            CompanyRepository::class
        );

        $this->app->bind(
            BranchRepositoryInterface::class,
            BranchRepository::class
        );

        $this->app->bind(
            DepartmentRepositoryInterface::class,
            DepartmentRepository::class
        );

        $this->app->bind(
            EmployeeRepositoryInterface::class,
            EmployeeRepository::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Gate::before(function ($user, string $ability): ?bool {
            return $user->isSuperAdmin() ? true : null;
        });

        // Prevent Carbon and Date objects from converting to UTC when serializing to JSON.
        // Preserves local Asia/Colombo time everywhere across the application.
        $localFormat = fn (\DateTimeInterface $date): string => $date->format('Y-m-d H:i:s');
        \Illuminate\Support\Facades\Date::serializeUsing($localFormat);
        \Illuminate\Support\Carbon::serializeUsing($localFormat);
        \Carbon\Carbon::serializeUsing($localFormat);
        \Carbon\CarbonImmutable::serializeUsing($localFormat);
    }

}
