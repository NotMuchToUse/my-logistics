<?php

declare(strict_types=1);

namespace App\Modules\Shipment\DTOs;

final readonly class ShipmentFilterDto
{
    public function __construct(
        public ?string $status,
        public ?string $trackingCode,
        public ?string $phone,
        public ?int $serviceTypeId,
        public ?bool $isPriority,
        public ?string $fromDate,
        public ?string $toDate,
        public int $page,
        public int $perPage,
        public string $sortBy,
        public string $sortDirection,
    ) {
    }
}
