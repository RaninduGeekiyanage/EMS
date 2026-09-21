<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AttendanceLog extends Model
{
    use BelongsToTenant, HasFactory, HasUlids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'attendance_logs';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'employee_id',
        'punch_datetime',
        'punch_type',
        'device_id',
        'raw_biometric_id',
        'import_id',
        'source',
        'is_processed',
        'processed_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'punch_datetime' => 'datetime',
            'is_processed' => 'boolean',
            'processed_at' => 'datetime',
        ];
    }

    /**
     * Get the employee who made the punch.
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Get the import batch associated with this punch.
     */
    public function import(): BelongsTo
    {
        return $this->belongsTo(AttendanceImport::class, 'import_id');
    }
}
