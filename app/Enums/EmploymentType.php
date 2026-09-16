<?php

declare(strict_types=1);

namespace App\Enums;

enum EmploymentType: string
{
    case Permanent = 'permanent';
    case Probationary = 'probationary';
    case Contract = 'contract';
    case Casual = 'casual';
    case PartTime = 'part_time';

    public function label(): string
    {
        return match ($this) {
            self::Permanent => 'Permanent',
            self::Probationary => 'Probationary',
            self::Contract => 'Contract',
            self::Casual => 'Casual',
            self::PartTime => 'Part-Time',
        };
    }
}
