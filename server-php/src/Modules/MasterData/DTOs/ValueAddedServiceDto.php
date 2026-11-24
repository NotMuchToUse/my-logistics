<?php

declare(strict_types=1);

namespace App\Modules\MasterData\DTOs;

final class ValueAddedServiceDto
{
    public function __construct(
        public readonly string $code,
        public readonly string $name,
        public readonly string $feeType,
        public readonly string $feeValue,
        public readonly string $minFee,
        public readonly string $maxFee,
        public readonly bool $isActive,
    ) {
    }
}
