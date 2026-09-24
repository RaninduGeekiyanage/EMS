<?php

declare(strict_types=1);

namespace App\Http\Requests\Roster;

use Illuminate\Foundation\Http\FormRequest;

final class TransferRosterAllocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'target_roster_id' => ['required', 'string', 'exists:rosters,id'],
            'transfer_date' => ['required', 'date'],
            'pattern_id' => ['nullable', 'string', 'exists:roster_patterns,id'],
        ];
    }
}
