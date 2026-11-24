<?php

declare(strict_types=1);

namespace App\Modules\Customer\Repositories;

use App\Core\ApiException;
use PDO;

final class PublicPortalRepository
{
    private const VAT_RATE_PERCENT = '10.00';

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function trackShipment(string $trackingCode): array
    {
        $code = strtoupper(trim($trackingCode));
        if ($code === '') {
            throw new ApiException('400_BAD_REQUEST', 'Vui lòng nhập mã vận đơn cần tra cứu.');
        }

        $stmt =$this->pdo->prepare(
            'SELECT s.id, s.public_id, s.tracking_code, s.shipment_type, s.status,
                    s.sender_name, s.sender_phone_masked, s.sender_province_id, s.sender_district_id,
                    s.recipient_name, s.recipient_phone_masked, s.recipient_province_id, s.recipient_district_id,
                    s.parcel_count, s.total_actual_weight_gram, s.chargeable_weight_gram,
                    s.payment_method, s.total_freight_amount, s.cod_amount, s.is_priority,
                    s.sla_deadline_at, s.picked_up_at, s.delivered_at, s.cancelled_at, s.created_at,
                    st.code AS service_code, st.name AS service_name,
                    ob.code AS origin_branch_code, ob.name AS origin_branch_name,
                    db.code AS destination_branch_code, db.name AS destination_branch_name,
                    sp.name AS sender_province_name, sd.name AS sender_district_name,
                    rp.name AS recipient_province_name, rd.name AS recipient_district_name
             FROM shipments s
             LEFT JOIN service_types st ON st.id = s.service_type_id
             LEFT JOIN branches ob ON ob.id = s.origin_branch_id
             LEFT JOIN branches db ON db.id = s.destination_branch_id
             LEFT JOIN provinces sp ON sp.id = s.sender_province_id
             LEFT JOIN districts sd ON sd.id = s.sender_district_id
             LEFT JOIN provinces rp ON rp.id = s.recipient_province_id
             LEFT JOIN districts rd ON rd.id = s.recipient_district_id
             WHERE s.tracking_code = :tracking_code
               AND s.deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([':tracking_code' =>$code]);
        $shipment =$stmt->fetch(PDO::FETCH_ASSOC);

        if ($shipment === false) {
            throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn với mã {$code}.", [], 404);
        }

        $histStmt = $this->pdo->prepare( 'SELECT h.id, h.from_status, h.to_status, h.description, h.evidence_image_url, h.occurred_at, b.code AS branch_code, b.name AS branch_name FROM shipment_status_history h LEFT JOIN branches b ON b.id = h.branch_id WHERE h.shipment_id = :shipment_id AND h.is_public_visible = 1 ORDER BY h.occurred_at ASC, h.id ASC' );$histStmt->execute([':shipment_id' => (int) $shipment['id']]);$history = [];
        foreach ($histStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {$history[] = [
                'id' => (int) $row['id'],
                'from_status' => $row['from_status'],
                'to_status' => $row['to_status'],
                'description' => $row['description'],
                'evidence_image_url' => $row['evidence_image_url'],
                'branch_code' => $row['branch_code'],
                'branch_name' => $row['branch_name'],
                'occurred_at' => $row['occurred_at'],
            ];
        }

        return [
            'public_id' => $shipment['public_id'],
            'tracking_code' => $shipment['tracking_code'],
            'shipment_type' => $shipment['shipment_type'],
            'status' => $shipment['status'],
            'is_priority' => (bool) $shipment['is_priority'],
            'service' => [
                'code' => $shipment['service_code'],
                'name' => $shipment['service_name'],
            ],
            'sender' => [
                'name' => $shipment['sender_name'],
                'phone_masked' => $shipment['sender_phone_masked'],
                'province_name' => $shipment['sender_province_name'],
                'district_name' => $shipment['sender_district_name'],
            ],
            'recipient' => [
                'name' => $shipment['recipient_name'],
                'phone_masked' => $shipment['recipient_phone_masked'],
                'province_name' => $shipment['recipient_province_name'],
                'district_name' => $shipment['recipient_district_name'],
            ],
            'origin_branch' => [
                'code' => $shipment['origin_branch_code'],
                'name' => $shipment['origin_branch_name'],
            ],
            'destination_branch' => [
                'code' => $shipment['destination_branch_code'],
                'name' => $shipment['destination_branch_name'],
            ],
            'parcel_count' => (int) $shipment['parcel_count'],
            'total_actual_weight_gram' => (int) $shipment['total_actual_weight_gram'],
            'chargeable_weight_gram' => (int) $shipment['chargeable_weight_gram'],
            'payment_method' => $shipment['payment_method'],
            'total_freight_amount' => (string) $shipment['total_freight_amount'],
            'cod_amount' => (string) $shipment['cod_amount'],
            'sla_deadline_at' => $shipment['sla_deadline_at'],
            'picked_up_at' => $shipment['picked_up_at'],
            'delivered_at' => $shipment['delivered_at'],
            'cancelled_at' => $shipment['cancelled_at'],
            'created_at' => $shipment['created_at'],
            'timeline' => $history,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return list<array<string, mixed>>
     */
    public function searchBranchesWithGps(array $filters): array
    {
        $params = [];$where = [
            'b.is_active = 1',
            'b.deleted_at IS NULL',
        ];

        if (!empty($filters['province_id'])) {$where[] = 'b.province_id = :province_id';
            $params[':province_id'] = (int)$filters['province_id'];
        }
        if (!empty($filters['district_id'])) {$where[] = 'b.district_id = :district_id';
            $params[':district_id'] = (int)$filters['district_id'];
        }
        if (!empty($filters['branch_type'])) {$where[] = 'b.branch_type = :branch_type';
            $params[':branch_type'] = (string)$filters['branch_type'];
        }
        if (isset($filters['accepts_counter_dropoff']) && $filters['accepts_counter_dropoff'] !== '') {$where[] = 'b.accepts_counter_dropoff = :accepts_counter_dropoff';
            $params[':accepts_counter_dropoff'] = (int)$filters['accepts_counter_dropoff'];
        }
        if (!empty($filters['search'])) {$where[] = '(b.name LIKE :search OR b.address_line LIKE :search OR b.code LIKE :search)';
            $params[':search'] = '\%' . trim((string) $filters['search']) . '%';
        }

        $latRaw = $filters['latitude'] ?? $filters['lat'] ?? null;
        $lngRaw = $filters['longitude'] ?? $filters['lng'] ?? null;
        $hasGps = is_numeric($latRaw) && is_numeric($lngRaw);

        $distanceSelect = 'NULL AS distance_km';
        $orderBy = 'b.province_id ASC, b.name ASC';$havingSql = '';

        if ($hasGps) {
            $lat = (float)$latRaw;
            $lng = (float)$lngRaw;
            $distanceSelect = 'CASE
                WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN
                    ROUND(6371 * ACOS(LEAST(1.0, GREATEST(-1.0,
                        COS(RADIANS(:lat1)) * COS(RADIANS(b.latitude)) * COS(RADIANS(b.longitude) - RADIANS(:lng1))
                        + SIN(RADIANS(:lat2)) * SIN(RADIANS(b.latitude))
                    ))), 2)
                ELSE NULL
            END AS distance_km';
            $params[':lat1'] =$lat;
            $params[':lng1'] =$lng;
            $params[':lat2'] =$lat;
            $orderBy = 'CASE WHEN distance_km IS NULL THEN 1 ELSE 0 END ASC, distance_km ASC, b.id ASC';

            if (!empty($filters['radius_km']) && is_numeric($filters['radius_km']) && (float) $filters['radius_km'] > 0) {$havingSql = 'HAVING distance_km IS NOT NULL AND distance_km <= :radius_km';
                $params[':radius_km'] = (float)$filters['radius_km'];
            }
        }

        $limit = isset($filters['limit']) && is_numeric($filters['limit'])
            ? min(200, max(1, (int) $filters['limit']))
            : 100;

        $whereSql = implode(' AND ', $where);$sql = "SELECT b.public_id, b.code, b.name, b.branch_type,
                       b.province_id, p.name AS province_name,
                       b.district_id, d.name AS district_name,
                       b.ward_id, w.name AS ward_name,
                       b.address_line, b.latitude, b.longitude,
                       b.hotline_phone, b.operating_hours, b.accepts_counter_dropoff,
                       {$distanceSelect}
                FROM branches b
                LEFT JOIN provinces p ON p.id = b.province_id
                LEFT JOIN districts d ON d.id = b.district_id
                LEFT JOIN wards w ON w.id = b.ward_id
                WHERE {$whereSql}
                {$havingSql}
                ORDER BY {$orderBy}
                LIMIT {$limit}";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $results = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {$results[] = [
                'public_id' => $row['public_id'],
                'code' => $row['code'],
                'name' => $row['name'],
                'branch_type' => $row['branch_type'],
                'province_id' => (int) $row['province_id'],
                'province_name' => $row['province_name'],
                'district_id' => (int) $row['district_id'],
                'district_name' => $row['district_name'],
                'ward_id' => (int) $row['ward_id'],
                'ward_name' => $row['ward_name'],
                'address_line' => $row['address_line'],
                'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
                'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
                'hotline_phone' => $row['hotline_phone'],
                'operating_hours' => $row['operating_hours'],
                'accepts_counter_dropoff' => (bool) $row['accepts_counter_dropoff'],
                'distance_km' => $row['distance_km'] !== null ? (float) $row['distance_km'] : null,
            ];
        }

        return $results;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function calculateRate(array $payload): array
    {
        $senderProvinceId = (int) ($payload['sender_province_id'] ?? 0);
        $recipientProvinceId = (int) ($payload['recipient_province_id'] ?? 0);
        $recipientDistrictId = (int) ($payload['recipient_district_id'] ?? 0);
        $serviceTypeId = (int) ($payload['service_type_id'] ?? 0);
        $declaredValue = isset($payload['declared_value']) && is_numeric($payload['declared_value'])
            ? $this->roundMoney((string) $payload['declared_value'])
            : '0.00';

        $errors = [];
        if ($senderProvinceId < 1) {
            $errors['sender_province_id'] = ['Vui lòng chọn tỉnh/thành phố gửi.'];
        }
        if ($recipientProvinceId < 1) {
            $errors['recipient_province_id'] = ['Vui lòng chọn tỉnh/thành phố nhận.'];
        }
        if ($serviceTypeId < 1) {
            $errors['service_type_id'] = ['Vui lòng chọn loại dịch vụ vận chuyển.'];
        }

        $rawParcels = [];
        if (!empty($payload['parcels']) && is_array($payload['parcels'])) {
            $rawParcels = $payload['parcels'];
        } elseif (isset($payload['weight_gram']) || isset($payload['actual_weight_gram'])) {
            $rawParcels = [[
                'actual_weight_gram' => (int) ($payload['actual_weight_gram'] ?? $payload['weight_gram'] ?? 0),
                'length_cm' => (string) ($payload['length_cm'] ?? '10'),
                'width_cm' => (string) ($payload['width_cm'] ?? '10'),
                'height_cm' => (string) ($payload['height_cm'] ?? '10'),
            ]];
        } else {
            $errors['parcels'] = ['Vui lòng nhập trọng lượng hoặc danh sách kiện hàng.'];
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu tính cước không hợp lệ.', $errors, 422);
        }

        $serviceStmt = $this->pdo->prepare('SELECT id, code, name FROM service_types WHERE id = :id AND is_active = 1 AND deleted_at IS NULL LIMIT 1');
        $serviceStmt->execute([':id' => $serviceTypeId]);
        $service = $serviceStmt->fetch(PDO::FETCH_ASSOC);
        if ($service === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Loại dịch vụ không tồn tại hoặc đã ngừng hoạt động.', ['service_type_id' => ['Dịch vụ không hợp lệ']], 422);
        }

        $zoneType = $this->resolveZoneType($senderProvinceId, $recipientProvinceId);
        $today = date('Y-m-d');

        $wcrStmt = $this->pdo->prepare(
            'SELECT divisor, min_chargeable_gram
             FROM weight_conversion_rules
             WHERE service_type_id = :service_type_id
               AND is_active = 1
               AND effective_from <= :today1
               AND (effective_to IS NULL OR effective_to >= :today2)
             ORDER BY effective_from DESC, id DESC
             LIMIT 1'
        );
        $wcrStmt->execute([':service_type_id' => $serviceTypeId, ':today1' => $today, ':today2' => $today]);
        $wcr = $wcrStmt->fetch(PDO::FETCH_ASSOC);
        $divisor = $wcr !== false ? max(1, (int) $wcr['divisor']) : 6000;
        $minChargeableGram = $wcr !== false ? max(0, (int) $wcr['min_chargeable_gram']) : 500;

        $totalActual = 0;
        $totalVolumetric = 0;
        $totalChargeable = 0;
        foreach ($rawParcels as $idx => $p) {
            $actual = (int) ($p['actual_weight_gram'] ?? $p['weight_gram'] ?? 0);
            if ($actual < 1) {
                throw new ApiException('422_VALIDATION_ERROR', "Trọng lượng kiện #" . ($idx + 1) . " phải lớn hơn 0 gram.", [], 422);
            }
            $l = is_numeric($p['length_cm'] ?? null) ? (string) $p['length_cm'] : '0';
            $w = is_numeric($p['width_cm'] ?? null) ? (string) $p['width_cm'] : '0';
            $h = is_numeric($p['height_cm'] ?? null) ? (string) $p['height_cm'] : '0';

            $vol = $this->volumetricWeight($l, $w, $h, $divisor);
            $chg = max($actual, $vol, $minChargeableGram);

            $totalActual += $actual;
            $totalVolumetric += $vol;
            $totalChargeable += $chg;
        }

        $tariffStmt = $this->pdo->prepare(
            'SELECT *
             FROM pricing_tariffs
             WHERE service_type_id = :service_type_id
               AND zone_type = :zone_type
               AND min_weight_gram <= :w1
               AND max_weight_gram >= :w2
               AND is_active = 1
               AND effective_from <= :today1
               AND (effective_to IS NULL OR effective_to >= :today2)
             ORDER BY effective_from DESC, id DESC
             LIMIT 1'
        );
        $tariffStmt->execute([
            ':service_type_id' => $serviceTypeId,
            ':zone_type' => $zoneType,
            ':w1' => $totalChargeable,
            ':w2' => $totalChargeable,
            ':today1' => $today,
            ':today2' => $today,
        ]);
        $tariff = $tariffStmt->fetch(PDO::FETCH_ASSOC);
        if ($tariff === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Chưa có biểu cước áp dụng cho tuyến và mức trọng lượng này.', [], 422);
        }

        $minWeight = (int) $tariff['min_weight_gram'];
        $stepWeight = max(1, (int) $tariff['step_weight_gram']);
        $overWeight = max(0, $totalChargeable - $minWeight);
        $steps = intdiv($overWeight + $stepWeight - 1, $stepWeight);
        $stepAmount = bcmul((string) $steps, (string) $tariff['step_price'], 2);
        $baseFreightAmount = bcadd((string) $tariff['base_price'], $stepAmount, 2);

        // Dịch vụ gia tăng (VAS)
        $vasIds = array_values(array_unique(array_filter(array_map('intval', (array) ($payload['vas_ids'] ?? [])), static fn (int $id): bool => $id > 0)));
        $vasAmount = '0.00';
        $vasItems = [];
        if ($vasIds !== []) {
            $phs = implode(', ', array_map(static fn (int $i): string => ':v_' . $i, array_keys($vasIds)));
            $vStmt = $this->pdo->prepare("SELECT * FROM value_added_services WHERE id IN ({$phs}) AND is_active = 1 AND deleted_at IS NULL");
            foreach ($vasIds as $i => $vid) {
                $vStmt->bindValue(':v_' . $i, $vid, PDO::PARAM_INT);
            }
            $vStmt->execute();
            foreach ($vStmt->fetchAll(PDO::FETCH_ASSOC) as $vas) {
                $fee = $this->catalogFee((string) $vas['fee_type'], (string) $vas['fee_value'], $declaredValue, (string) $vas['min_fee'], $vas['max_fee'] !== null ? (string) $vas['max_fee'] : null);
                $vasAmount = bcadd($vasAmount, $fee, 2);
                $vasItems[] = ['id' => (int) $vas['id'], 'code' => $vas['code'], 'name' => $vas['name'], 'fee_amount' => $fee];
            }
        }

        // Phụ phí tự động & phụ phí chọn thêm
        $selectedSurchargeIds = array_values(array_unique(array_filter(array_map('intval', (array) ($payload['surcharge_ids'] ?? [])), static fn (int $id): bool => $id > 0)));
        $autoStmt = $this->pdo->query("SELECT * FROM surcharges WHERE is_active = 1 AND deleted_at IS NULL AND is_auto_applied = 1");
        $autoRows = $autoStmt->fetchAll(PDO::FETCH_ASSOC);

        if ($recipientDistrictId > 0) {
            $distStmt = $this->pdo->prepare('SELECT is_remote FROM districts WHERE id = :id LIMIT 1');
            $distStmt->execute([':id' => $recipientDistrictId]);
            if ((int) $distStmt->fetchColumn() === 1) {
                $remStmt = $this->pdo->query("SELECT id FROM surcharges WHERE code = 'REMOTE_AREA' AND is_active = 1 AND deleted_at IS NULL LIMIT 1");
                $remId = $remStmt->fetchColumn();
                if ($remId !== false) {
                    $selectedSurchargeIds[] = (int) $remId;
                }
            }
        }

        $surchargeMap = [];
        foreach ($autoRows as $sr) {$surchargeMap[(int) $sr['id']] =$sr;
        }
        $selectedSurchargeIds = array_values(array_unique($selectedSurchargeIds));
        if ($selectedSurchargeIds !== []) {
            $phs = implode(', ', array_map(static fn (int$i): string => ':s_' . $i, array_keys($selectedSurchargeIds)));
            $sStmt =$this->pdo->prepare("SELECT * FROM surcharges WHERE id IN ({$phs}) AND is_active = 1 AND deleted_at IS NULL");
            foreach ($selectedSurchargeIds as$i => $sid) {$sStmt->bindValue(':s_' . $i,$sid, PDO::PARAM_INT);
            }
            $sStmt->execute();
            foreach ($sStmt->fetchAll(PDO::FETCH_ASSOC) as $sr) {$surchargeMap[(int) $sr['id']] =$sr;
            }
        }

        $surchargeAmount = '0.00';$surchargeItems = [];
        foreach ($surchargeMap as $sr) {$fee = $this->catalogFee((string)$sr['fee_type'], (string) $sr['fee_value'],$baseFreightAmount, '0.00', null);
            $surchargeAmount = bcadd($surchargeAmount, $fee, 2);$surchargeItems[] = ['id' => (int) $sr['id'], 'code' =>$sr['code'], 'name' => $sr['name'], 'fee_amount' =>$fee];
        }

        $taxable = bcadd(bcadd($baseFreightAmount, $vasAmount, 2),$surchargeAmount, 2);
        $vatAmount =$this->percentageAmount($taxable, self::VAT_RATE_PERCENT);$totalFreightAmount = bcadd($taxable,$vatAmount, 2);

        $slaStmt = $this->pdo->prepare('SELECT pickup_sla_minutes, delivery_sla_hours FROM sla_deadlines WHERE service_type_id = :sid AND zone_type = :zt AND is_active = 1 LIMIT 1');$slaStmt->execute([':sid' => $serviceTypeId, ':zt' =>$zoneType]);
        $sla =$slaStmt->fetch(PDO::FETCH_ASSOC);

        return [
            'service' => [
                'id' => (int) $service['id'],
                'code' => $service['code'],
                'name' => $service['name'],
            ],
            'zone_type' => $zoneType,
            'parcel_count' => count($rawParcels),
            'total_actual_weight_gram' => $totalActual,
            'total_volumetric_weight_gram' => $totalVolumetric,
            'chargeable_weight_gram' => $totalChargeable,
            'base_freight_amount' => $baseFreightAmount,
            'vas_amount' => $vasAmount,
            'vas_items' => $vasItems,
            'surcharge_amount' => $surchargeAmount,
            'surcharge_items' => $surchargeItems,
            'vat_amount' => $vatAmount,
            'total_freight_amount' => $totalFreightAmount,
            'estimated_delivery_hours' => $sla !== false ? (int) $sla['delivery_sla_hours'] : 24,
        ];
    }

    private function resolveZoneType(int $senderProvinceId, int$recipientProvinceId): string
    {
        if ($senderProvinceId ===$recipientProvinceId) {
            return 'intra_province';
        }

        $stmt =$this->pdo->prepare('SELECT id, region FROM provinces WHERE id IN (:p1, :p2)');
        $stmt->execute([':p1' =>$senderProvinceId, ':p2' => $recipientProvinceId]);$regions = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {$regions[(int) $row['id']] = (string)$row['region'];
        }

        if (!isset($regions[$senderProvinceId], $regions[$recipientProvinceId])) {
            throw new ApiException('422_VALIDATION_ERROR', 'Tỉnh/thành phố gửi hoặc nhận không hợp lệ.', [], 422);
        }

        if ($regions[$senderProvinceId] === $regions[$recipientProvinceId]) {
            return 'intra_region';
        }

        $pair = [$regions[$senderProvinceId], $regions[$recipientProvinceId]];
        sort($pair);

        return $pair === ['north', 'south'] ? 'inter_region_far' : 'inter_region_near';
    }

    private function volumetricWeight(string $length, string$width, string $height, int$divisor): int
    {
        $volume = bcmul(bcmul($length,$width, 4), $height, 6);$volumeGram = bcmul($volume, '1000', 6);$whole = bcdiv($volumeGram, (string)$divisor, 0);
        if (bccomp($volumeGram, bcmul($whole, (string)$divisor, 6), 6) > 0) {
            $whole = bcadd($whole, '1', 0);
        }
        return (int) $whole;
    }

    private function catalogFee(string $feeType, string $feeValue, string$base, string $minFee, ?string $maxFee): string
    {
        $amount =$feeType === 'percentage'
            ? $this->percentageAmount($base,$feeValue)
            : $this->roundMoney($feeValue);
        if (bccomp($amount,$minFee, 2) < 0) {
            $amount =$minFee;
        }
        if ($maxFee !== null && bccomp($amount,$maxFee, 2) > 0) {
            $amount =$maxFee;
        }
        return $this->roundMoney($amount);
    }

    private function percentageAmount(string $base, string$percent): string
    {
        return $this->roundMoney(bcdiv(bcmul($base,$percent, 6), '100', 6));
    }

    private function roundMoney(string $amount): string
    {
        $cents = bcdiv(bcmul($amount, '100', 6), '1', 0);$frac = bcsub(bcmul($amount, '100', 6),$cents, 6);
        if (bccomp($frac, '0.5', 6) >= 0) {
            $cents = bcadd($cents, '1', 0);
        }
        return bcdiv($cents, '100', 2);
    }
}