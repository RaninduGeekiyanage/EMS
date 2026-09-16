<?php

declare(strict_types=1);

namespace App\Enums;

enum PaymentMode: string
{
    case Monthly = 'monthly';
    case Daily = 'daily';
    case Hourly = 'hourly';

    public function label(): string
    {
        return match ($this) {
            self::Monthly => 'Monthly Salaried',
            self::Daily => 'Daily Rate',
            self::Hourly => 'Hourly Rate',
        };
    }
}
