<?php

declare(strict_types=1);

namespace App\Modules\Shipment\DTOs;

final readonly class CreateShipmentDto
{
    /**
     * @param list<array{
     *     actual_weight_gram: int,
     *     length_cm: string,
     *     width_cm: string,
     *     height_cm: string,
     *     description: string|null
     * }> $parcels
     * @param list<int> $vasIds
     * @param list<int> $surchargeIds
     */
    public function __construct(
        public string $senderName,
        public string $senderPhone,
        public string $senderAddress,
        public int $senderProvinceId,
        public int $senderDistrictId,
        public int $senderWardId,
        public string $recipientName,
        public string $recipientPhone,
        public string $recipientAddress,
        public int $recipientProvinceId,
        public int $recipientDistrictId,
        public int $recipientWardId,
        public int $destinationBranchId,
        public int $serviceTypeId,
        public int $cargoCategoryId,
        public string $paymentMethod,
        public string $codAmount,
        public string $declaredValue,
        public string $creationMode,
        public array $parcels,
        public array $vasIds,
        public array $surchargeIds,
    ) {
    }
}
