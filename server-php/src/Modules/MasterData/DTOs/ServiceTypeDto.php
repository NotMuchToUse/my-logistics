<?php

declare(strict_types=1);

namespace App\Modules\MasterData\DTOs;

final class ServiceTypeDto
{
    public function __construct(
        public readonly string $code,
        public readonly string $name,
        public readonly ?string $description,
        public readonly int $estimatedDaysMin,
        public readonly int $estimatedDaysMax,
        public readonly bool $isActive,
    ) {
    }
}
