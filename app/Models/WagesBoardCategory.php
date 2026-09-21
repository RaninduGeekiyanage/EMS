<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class WagesBoardCategory extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'wages_board_categories';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'minimum_wage',
        'entitle_start_day',
        'entitle_end_day',
        'devided_days_by',
        'max_annual_leave',
        'casual_leave_days',
        'description',
        'is_active',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'minimum_wage' => 'decimal:2',
            'entitle_start_day' => 'integer',
            'entitle_end_day' => 'integer',
            'devided_days_by' => 'integer',
            'max_annual_leave' => 'integer',
            'casual_leave_days' => 'float',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get the designations associated with this wages board category.
     *
     * @return HasMany<Designation, $this>
     */
    public function designations(): HasMany
    {
        return $this->hasMany(Designation::class, 'wages_board_category_id');
    }
}
