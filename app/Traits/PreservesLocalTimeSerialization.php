<?php

declare(strict_types=1);

namespace App\Traits;

use DateTimeInterface;

trait PreservesLocalTimeSerialization
{
    /**
     * Prepare a date for array / JSON serialization without converting to UTC.
     * Always preserves local application time (Asia/Colombo).
     */
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }
}
