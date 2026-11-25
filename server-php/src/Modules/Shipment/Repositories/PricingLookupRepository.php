<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Repositories;

use App\Core\ApiException;
use PDO;

final class PricingLookupRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{origin_region: string, destination_region: string}
     */
    public function findBranchRegions(int $originBranchId, int $destinationBranchId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT origin_province.region AS origin_region,
                    destination_province.region AS destination_region
             FROM branches origin_branch
             INNER JOIN provinces origin_province ON origin_province.id = origin_branch.province_id
             INNER JOIN branches destination_branch ON destination_branch.id = :destination_branch_id
             INNER JOIN provinces destination_province ON destination_province.id = destination_branch.province_id
             WHERE origin_branch.id = :origin_branch_id
               AND origin_branch.is_active = 1
               AND origin_branch.deleted_at IS NULL
               AND destination_branch.is_active = 1
               AND destination_branch.deleted_at IS NULL
             LIMIT 1',
        );
        $statement->execute([
            ':origin_branch_id' => $originBranchId,
            ':destination_branch_id' => $destinationBranchId,
        ]);
        $regions = $statement->fetch(PDO::FETCH_ASSOC);

        if ($regions === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Chi nhánh đi hoặc đến không tồn tại hay đã ngừng hoạt động.');
        }

        return [
            'origin_region' => (string) $regions['origin_region'],
            'destination_region' => (string) $regions['destination_region'],
        ];
    }

    public function assertAddress(int $provinceId, int $districtId, int $wardId, string $fieldPrefix): void
    {
        $statement = $this->pdo->prepare(
            'SELECT 1
             FROM wards w
             INNER JOIN districts d ON d.id = w.district_id
             INNER JOIN provinces p ON p.id = d.province_id
             WHERE p.id = :province_id
               AND d.id = :district_id
               AND w.id = :ward_id
               AND p.is_active = 1
               AND d.is_active = 1
               AND w.is_active = 1
             LIMIT 1',
        );
        $statement->execute([
            ':province_id' => $provinceId,
            ':district_id' => $districtId,
            ':ward_id' => $wardId,
        ]);

        if ($statement->fetchColumn() === false) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Địa chỉ vận đơn không khớp địa giới hành chính đang hoạt động.',
                [$fieldPrefix . '_district_id' => ['Tỉnh, huyện và xã không cùng một nhánh địa giới.']],
            );
        }
    }

    /**
     * @return array{sender_region: string, recipient_region: string}
     */
    public function findProvinceRegions(int $senderProvinceId, int $recipientProvinceId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT sender.region AS sender_region, recipient.region AS recipient_region
             FROM provinces sender
             INNER JOIN provinces recipient ON recipient.id = :recipient_province_id
             WHERE sender.id = :sender_province_id
               AND sender.is_active = 1
               AND recipient.is_active = 1
             LIMIT 1',
        );
        $statement->execute([
            ':sender_province_id' => $senderProvinceId,
            ':recipient_province_id' => $recipientProvinceId,
        ]);
        $regions = $statement->fetch(PDO::FETCH_ASSOC);

        if ($regions === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Tỉnh gửi hoặc tỉnh nhận không tồn tại hay đã ngừng hoạt động.');
        }

        return [
            'sender_region' => (string) $regions['sender_region'],
            'recipient_region' => (string) $regions['recipient_region'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function findActiveServiceType(int $serviceTypeId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, code, name, estimated_days_min, estimated_days_max
             FROM service_types
             WHERE id = :id AND is_active = 1 AND deleted_at IS NULL
             LIMIT 1',
        );
        $statement->execute([':id' => $serviceTypeId]);
        $service = $statement->fetch(PDO::FETCH_ASSOC);

        if ($service === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dịch vụ vận chuyển không tồn tại hoặc đã ngừng hoạt động.');
        }

        return $service;
    }

    public function assertActiveCargoCategory(int $cargoCategoryId): void
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM cargo_categories WHERE id = :id AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
        );
        $statement->execute([':id' => $cargoCategoryId]);

        if ($statement->fetchColumn() === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Danh mục hàng hóa không tồn tại hoặc đã ngừng hoạt động.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function findWeightConversionRule(int $serviceTypeId, string $effectiveDate): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, service_type_id, divisor, min_chargeable_gram
             FROM weight_conversion_rules
             WHERE service_type_id = :service_type_id
               AND is_active = 1
               AND effective_from <= :effective_from
               AND (effective_to IS NULL OR effective_to >= :effective_to)
             ORDER BY effective_from DESC, id DESC
             LIMIT 1',
        );
        $statement->execute([
            ':service_type_id' => $serviceTypeId,
            ':effective_from' => $effectiveDate,
            ':effective_to' => $effectiveDate,
        ]);
        $rule = $statement->fetch(PDO::FETCH_ASSOC);

        if ($rule === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Chưa cấu hình quy đổi trọng lượng cho dịch vụ này.');
        }

        return $rule;
    }

    /**
     * @return array<string, mixed>
     */
    public function findTariff(int $serviceTypeId, string $zoneType, int $chargeableWeightGram, string $effectiveDate): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, service_type_id, zone_type, min_weight_gram, max_weight_gram,
                    base_price, step_weight_gram, step_price
             FROM pricing_tariffs
             WHERE service_type_id = :service_type_id
               AND zone_type = :zone_type
               AND min_weight_gram <= :min_weight_gram
               AND max_weight_gram >= :max_weight_gram
               AND is_active = 1
               AND effective_from <= :effective_from
               AND (effective_to IS NULL OR effective_to >= :effective_to)
             ORDER BY effective_from DESC, min_weight_gram DESC, id DESC
             LIMIT 1',
        );
        $statement->execute([
            ':service_type_id' => $serviceTypeId,
            ':zone_type' => $zoneType,
            ':min_weight_gram' => $chargeableWeightGram,
            ':max_weight_gram' => $chargeableWeightGram,
            ':effective_from' => $effectiveDate,
            ':effective_to' => $effectiveDate,
        ]);
        $tariff = $statement->fetch(PDO::FETCH_ASSOC);

        if ($tariff === false) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Không tìm thấy nấc giá cước phù hợp với dịch vụ, vùng và trọng lượng.',
                ['chargeable_weight_gram' => ['Không tìm thấy bảng giá đang có hiệu lực.']],
            );
        }

        return $tariff;
    }

    /**
     * @param list<int> $vasIds
     * @return array<int, array<string, mixed>>
     */
    public function findValueAddedServices(array $vasIds): array
    {
        if ($vasIds === []) {
            return [];
        }

        [$placeholders, $parameters] = $this->buildIdPlaceholders($vasIds, 'vas');
        $statement = $this->pdo->prepare(
            'SELECT id, code, name, fee_type, fee_value, min_fee, max_fee
             FROM value_added_services
             WHERE is_active = 1 AND deleted_at IS NULL AND id IN (' . $placeholders . ')
             ORDER BY id ASC',
        );
        $statement->execute($parameters);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param list<int> $surchargeIds
     * @return array<int, array<string, mixed>>
     */
    public function findSurcharges(array $surchargeIds): array
    {
        if ($surchargeIds === []) {
            return [];
        }

        [$placeholders, $parameters] = $this->buildIdPlaceholders($surchargeIds, 'surcharge');
        $statement = $this->pdo->prepare(
            'SELECT id, code, name, fee_type, fee_value, is_auto_applied
             FROM surcharges
             WHERE is_active = 1 AND deleted_at IS NULL AND id IN (' . $placeholders . ')
             ORDER BY id ASC',
        );
        $statement->execute($parameters);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findRemoteAreaSurcharge(): ?array
    {
        $statement = $this->pdo->prepare(
            "SELECT id, code, name, fee_type, fee_value, is_auto_applied
             FROM surcharges
             WHERE code = 'REMOTE_AREA' AND is_active = 1 AND deleted_at IS NULL
             LIMIT 1",
        );
        $statement->execute();
        $surcharge = $statement->fetch(PDO::FETCH_ASSOC);

        return $surcharge === false ? null : $surcharge;
    }

    public function isRemoteDistrict(int $districtId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT is_remote_area FROM districts WHERE id = :id AND is_active = 1 LIMIT 1',
        );
        $statement->execute([':id' => $districtId]);

        return (int) $statement->fetchColumn() === 1;
    }

    /**
     * @param list<int> $ids
     * @return array{0: string, 1: array<string, int>}
     */
    private function buildIdPlaceholders(array $ids, string $prefix): array
    {
        $placeholders = [];
        $parameters = [];
        foreach (array_values($ids) as $index => $id) {
            $placeholder = ':' . $prefix . '_' . $index;
            $placeholders[] = $placeholder;
            $parameters[$placeholder] = $id;
        }

        return [implode(', ', $placeholders), $parameters];
    }
}
