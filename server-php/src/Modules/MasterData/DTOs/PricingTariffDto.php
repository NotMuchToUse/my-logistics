<?php

declare(strict_types=1);

namespace App\Modules\MasterData\DTOs;

final class PricingTariffDto
{
    public function __construct(
        public readonly int $serviceTypeId,
        public readonly string $zoneType,
        public readonly int $minWeightGram,
        public readonly int $maxWeightGram,
        public readonly string $basePrice,
        public readonly int $stepWeightGram,
        public readonly string $stepPrice,
        public readonly string $effectiveFrom,
        public readonly ?string $effectiveTo,
        public readonly bool $isActive,
    ) {
    }
}
