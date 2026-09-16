<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasFactory, HasRoles {
        hasRole as spatieHasRole;
    }
    use Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'is_super_admin',
        'tenant_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_super_admin' => 'boolean',
        ];
    }

    /**
     * Get the tenant that this user belongs to.
     *
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Determine if this user is a Global Super Admin.
     */
    public function isSuperAdmin(): bool
    {
        return (bool) $this->is_super_admin;
    }

    /**
     * Determine if this user has given role(s), recognizing Global Super Admin automatically.
     */
    public function hasRole($roles, ?string $guard = null): bool
    {
        if ($this->isSuperAdmin()) {
            $roleList = is_array($roles) ? $roles : [$roles];
            if (in_array('Super Admin', $roleList, true)) {
                return true;
            }
        }

        return $this->spatieHasRole($roles, $guard);
    }

    /**
     * Determine if this user is a Company Owner.
     */
    public function isCompanyOwner(): bool
    {
        return $this->hasRole('Company Owner');
    }
}
