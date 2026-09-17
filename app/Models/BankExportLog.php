<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class BankExportLog extends Model
{
    use BelongsToTenant, HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'bank_export_logs';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'payroll_run_id',
        'bank_code',
        'file_path',
        'record_count',
        'total_amount',
        'exported_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'record_count' => 'integer',
            'total_amount' => 'decimal:2',
        ];
    }

    /**
     * The payroll run this export was generated from.
     *
     * @return BelongsTo<PayrollRun, $this>
     */
    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    /**
     * The user who generated this bank export.
     *
     * @return BelongsTo<User, $this>
     */
    public function exportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'exported_by');
    }
}
