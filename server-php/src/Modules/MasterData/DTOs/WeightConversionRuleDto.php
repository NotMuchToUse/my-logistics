<?php

declare(strict_types=1);

namespace App\Modules\MasterData\DTOs;

final class WeightConversionRuleDto
{
    public function __construct(
        public readonly int $serviceTypeId,
        public readonly int $divisor,
        public readonly int $minChargeableGram,
        public readonly string $effectiveFrom,
        public readonly ?string $effectiveTo,
        public readonly bool $isActive,
    ) {
    }
}
