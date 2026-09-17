<?php

declare(strict_types=1);

namespace App\Http\Requests\AccessControl;

use App\Models\User;
use App\Services\PermissionCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateUserAccessRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        /** @var User|null $currentUser */
        $currentUser = $this->user();

        if ($currentUser === null) {
            return false;
        }

        /** @var User $targetUser */
        $targetUser = $this->route('user');

        // Super Admin can do anything
        if ($currentUser->isSuperAdmin()) {
            return true;
        }

        // Non-super-admins cannot edit a Super Admin
        if ($targetUser->isSuperAdmin()) {
            return false;
        }

        // Must have access-control.manage, user.manage, or be Company Owner
        return $currentUser->isCompanyOwner()
            || $currentUser->can('access-control.manage')
            || $currentUser->can('user.manage');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $allPermissions = array_keys(PermissionCatalog::PERMISSIONS);

        return [
            'role' => [
                'required',
                'string',
                Rule::in(PermissionCatalog::getAvailableRoles(true)),
            ],
            'direct_permissions' => [
                'present',
                'array',
            ],
            'direct_permissions.*' => [
                'string',
                Rule::in($allPermissions),
            ],
        ];
    }

    /**
     * Configure the validator instance with custom guardrail checks.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            /** @var User|null $currentUser */
            $currentUser = $this->user();
            /** @var User $targetUser */
            $targetUser = $this->route('user');

            if ($currentUser === null) {
                return;
            }

            $requestedRole = (string) $this->input('role');
            $requestedDirectPerms = (array) $this->input('direct_permissions', []);

            // Guardrail 1: Non-super-admins cannot assign Company Owner unless they are the Owner
            if ($requestedRole === 'Company Owner' && ! $currentUser->isSuperAdmin() && ! $currentUser->isCompanyOwner()) {
                $validator->errors()->add('role', 'Only existing Company Owners or Super Admins can assign the Company Owner role.');
            }

            // Guardrail 2: Non-super-admins cannot grant platform-level privileges
            if (! $currentUser->isSuperAdmin() && in_array('tenant.manage', $requestedDirectPerms, true)) {
                $validator->errors()->add('direct_permissions', 'Tenant administrators cannot grant global platform governance permissions (tenant.manage).');
            }

            // Guardrail 3: Anti-Self-Lockout
            if ($currentUser->id === $targetUser->id) {
                // If user is Owner or Admin, they cannot demote themselves to Staff/Supervisor
                if ($currentUser->isCompanyOwner() && $requestedRole !== 'Company Owner') {
                    $validator->errors()->add('role', 'You cannot demote yourself from Company Owner. Another administrator or Super Admin must perform this change.');
                }

                // Cannot revoke own access-control or user management if they hold it
                $currentCanManage = $currentUser->can('access-control.manage') || $currentUser->isCompanyOwner() || $currentUser->hasRole('Company Admin');
                if ($currentCanManage && in_array($requestedRole, ['Staff', 'Supervisor'], true)) {
                    $validator->errors()->add('role', 'You cannot revoke your own administrative management access.');
                }
            }
        });
    }

    /**
     * Get custom error messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'role.required' => 'A primary base role must be selected for the user.',
            'role.in' => 'The selected role is not recognized in the system catalog.',
            'direct_permissions.*.in' => 'One or more specified direct permissions are invalid.',
        ];
    }
}
