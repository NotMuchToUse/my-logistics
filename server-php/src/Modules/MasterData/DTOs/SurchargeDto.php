<?php

declare(strict_types=1);

namespace App\Modules\MasterData\DTOs;

final class SurchargeDto
{
    public function __construct(
        public readonly string $code,
        public readonly string $name,
        public readonly string $feeType,
        public readonly string $feeValue,
        public readonly bool $isAutoApplied,
        public readonly bool $isActive,
    ) {
    }
}
