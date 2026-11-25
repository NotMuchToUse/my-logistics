<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Services;

use App\Core\ApiException;
use App\Modules\Shipment\DTOs\CreateShipmentDto;
use App\Modules\Shipment\Repositories\PricingLookupRepository;

final class ShipmentPricingService
{
    private const VAT_RATE_PERCENT = '10.00';
    private const MAX_UNSIGNED_INTEGER = 4_294_967_295;

    public function __construct(private readonly PricingLookupRepository $lookupRepository)
    {
    }

    /**
     * @return array{
     *     zone_type: string,
     *     parcels: list<array{
     *         parcel_index: int,
     *         parcel_barcode: string,
     *         length_cm: string,
     *         width_cm: string,
     *         height_cm: string,
     *         actual_weight_gram: int,
     *         volumetric_weight_gram: int,
     *         chargeable_weight_gram: int,
     *         description: string|null
     *     }>,
     *     parcel_count: int,
     *     total_actual_weight_gram: int,
     *     total_volumetric_weight_gram: int,
     *     chargeable_weight_gram: int,
     *     base_freight_amount: string,
     *     vas_snapshots: list<array{vas_id: int, vas_code_snapshot: string, vas_name_snapshot: string, fee_amount: string}>,
     *     vas_amount: string,
     *     surcharge_snapshots: list<array{surcharge_id: int, surcharge_code_snapshot: string, surcharge_name_snapshot: string, fee_amount: string}>,
     *     surcharge_amount: string,
     *     vat_amount: string,
     *     total_freight_amount: string
     * }
     */
    public function calculate(
        CreateShipmentDto $shipment,
        int $originBranchId,
        string $trackingCode,
        string $effectiveDate,
    ): array {
        $this->lookupRepository->assertAddress(
            $shipment->senderProvinceId,
            $shipment->senderDistrictId,
            $shipment->senderWardId,
            'sender',
        );
        $this->lookupRepository->assertAddress(
            $shipment->recipientProvinceId,
            $shipment->recipientDistrictId,
            $shipment->recipientWardId,
            'recipient',
        );
        $this->lookupRepository->findBranchRegions($originBranchId, $shipment->destinationBranchId);
        $zoneType = $this->zoneType(
            $shipment->senderProvinceId,
            $shipment->recipientProvinceId,
        );
        $this->lookupRepository->findActiveServiceType($shipment->serviceTypeId);
        $this->lookupRepository->assertActiveCargoCategory($shipment->cargoCategoryId);
        $weightRule = $this->lookupRepository->findWeightConversionRule($shipment->serviceTypeId, $effectiveDate);
        $divisor = (int) $weightRule['divisor'];
        $minimumChargeableWeight = (int) $weightRule['min_chargeable_gram'];
        if ($divisor < 1 || $minimumChargeableWeight < 0) {
            throw new ApiException('500_INTERNAL_ERROR', 'Quy tắc quy đổi trọng lượng đang cấu hình không hợp lệ.');
        }

        $parcels = [];
        $totalActualWeight = 0;
        $totalVolumetricWeight = 0;
        $totalChargeableWeight = 0;
        foreach ($shipment->parcels as $index => $parcel) {
            $volumetricWeight = $this->volumetricWeight(
                $parcel['length_cm'],
                $parcel['width_cm'],
                $parcel['height_cm'],
                $divisor,
            );
            $chargeableWeight = max(
                $parcel['actual_weight_gram'],
                $volumetricWeight,
                $minimumChargeableWeight,
            );
            $totalActualWeight += $parcel['actual_weight_gram'];
            $totalVolumetricWeight += $volumetricWeight;
            $totalChargeableWeight += $chargeableWeight;
            $parcels[] = [
                'parcel_index' => $index + 1,
                'parcel_barcode' => $trackingCode . '-' . str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT),
                'length_cm' => $parcel['length_cm'],
                'width_cm' => $parcel['width_cm'],
                'height_cm' => $parcel['height_cm'],
                'actual_weight_gram' => $parcel['actual_weight_gram'],
                'volumetric_weight_gram' => $volumetricWeight,
                'chargeable_weight_gram' => $chargeableWeight,
                'description' => $parcel['description'],
            ];
        }

        foreach ([$totalActualWeight, $totalVolumetricWeight, $totalChargeableWeight] as $weight) {
            if ($weight > self::MAX_UNSIGNED_INTEGER) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Tổng trọng lượng vượt giới hạn lưu trữ.',
                    ['parcels' => ['Tổng trọng lượng tính cước quá lớn.']],
                );
            }
        }

        $tariff = $this->lookupRepository->findTariff(
            $shipment->serviceTypeId,
            $zoneType,
            $totalChargeableWeight,
            $effectiveDate,
        );
        $baseFreightAmount = $this->calculateBaseFreight($tariff, $totalChargeableWeight);

        $vasRows = $this->lookupRepository->findValueAddedServices($shipment->vasIds);
        if (count($vasRows) !== count($shipment->vasIds)) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Một hoặc nhiều dịch vụ gia tăng không tồn tại hay đã ngừng hoạt động.',
                ['vas_ids' => ['Chỉ được chọn dịch vụ gia tăng đang hoạt động.']],
            );
        }
        $vasSnapshots = [];
        $vasAmount = '0.00';
        foreach ($vasRows as $vas) {
            $feeAmount = $this->catalogFee(
                (string) $vas['fee_type'],
                (string) $vas['fee_value'],
                (string) $shipment->declaredValue,
                (string) $vas['min_fee'],
                $vas['max_fee'] === null ? null : (string) $vas['max_fee'],
            );
            $vasSnapshots[] = [
                'vas_id' => (int) $vas['id'],
                'vas_code_snapshot' => (string) $vas['code'],
                'vas_name_snapshot' => (string) $vas['name'],
                'fee_amount' => $feeAmount,
            ];
            $vasAmount = bcadd($vasAmount, $feeAmount, 2);
        }

        $selectedSurchargeIds = $shipment->surchargeIds;
        if ($this->lookupRepository->isRemoteDistrict($shipment->recipientDistrictId)) {
            $remoteAreaSurcharge = $this->lookupRepository->findRemoteAreaSurcharge();
            if ($remoteAreaSurcharge === null) {
                throw new ApiException('500_INTERNAL_ERROR', 'Thiếu cấu hình phụ phí vùng sâu vùng xa.');
            }
            $selectedSurchargeIds[] = (int) $remoteAreaSurcharge['id'];
        }
        $selectedSurchargeIds = array_values(array_unique($selectedSurchargeIds));
        $surchargeRows = $this->lookupRepository->findSurcharges($selectedSurchargeIds);
        if (count($surchargeRows) !== count($selectedSurchargeIds)) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Một hoặc nhiều phụ phí không tồn tại hay đã ngừng hoạt động.',
                ['surcharge_ids' => ['Chỉ được chọn phụ phí đang hoạt động.']],
            );
        }
        $surchargeSnapshots = [];
        $surchargeAmount = '0.00';
        foreach ($surchargeRows as $surcharge) {
            $feeAmount = $this->catalogFee(
                (string) $surcharge['fee_type'],
                (string) $surcharge['fee_value'],
                $baseFreightAmount,
                '0.00',
                null,
            );
            $surchargeSnapshots[] = [
                'surcharge_id' => (int) $surcharge['id'],
                'surcharge_code_snapshot' => (string) $surcharge['code'],
                'surcharge_name_snapshot' => (string) $surcharge['name'],
                'fee_amount' => $feeAmount,
            ];
            $surchargeAmount = bcadd($surchargeAmount, $feeAmount, 2);
        }

        $taxableAmount = bcadd(
            bcadd($baseFreightAmount, $vasAmount, 2),
            $surchargeAmount,
            2,
        );
        $vatAmount = $this->percentageAmount($taxableAmount, self::VAT_RATE_PERCENT);
        $totalFreightAmount = bcadd($taxableAmount, $vatAmount, 2);

        return [
            'zone_type' => $zoneType,
            'parcels' => $parcels,
            'parcel_count' => count($parcels),
            'total_actual_weight_gram' => $totalActualWeight,
            'total_volumetric_weight_gram' => $totalVolumetricWeight,
            'chargeable_weight_gram' => $totalChargeableWeight,
            'base_freight_amount' => $baseFreightAmount,
            'vas_snapshots' => $vasSnapshots,
            'vas_amount' => $vasAmount,
            'surcharge_snapshots' => $surchargeSnapshots,
            'surcharge_amount' => $surchargeAmount,
            'vat_amount' => $vatAmount,
            'total_freight_amount' => $totalFreightAmount,
        ];
    }

    /**
     * @param array<string, mixed> $tariff
     */
    private function calculateBaseFreight(array $tariff, int $chargeableWeightGram): string
    {
        $minimumWeight = (int) $tariff['min_weight_gram'];
        $stepWeight = (int) $tariff['step_weight_gram'];
        if ($stepWeight < 1) {
            throw new ApiException('500_INTERNAL_ERROR', 'Nấc trọng lượng trong bảng giá phải lớn hơn 0.');
        }

        $weightOverMinimum = max(0, $chargeableWeightGram - $minimumWeight);
        $steps = intdiv($weightOverMinimum + $stepWeight - 1, $stepWeight);
        $stepAmount = bcmul((string) $steps, (string) $tariff['step_price'], 2);

        return bcadd((string) $tariff['base_price'], $stepAmount, 2);
    }

    private function catalogFee(
        string $feeType,
        string $feeValue,
        string $percentageBase,
        string $minimumFee,
        ?string $maximumFee,
    ): string {
        $amount = match ($feeType) {
            'fixed' => $this->roundMoney($feeValue),
            'percentage' => $this->percentageAmount($percentageBase, $feeValue),
            default => throw new ApiException('500_INTERNAL_ERROR', 'Loại phí danh mục không được hỗ trợ.'),
        };
        if (bccomp($amount, $minimumFee, 2) < 0) {
            $amount = $minimumFee;
        }
        if ($maximumFee !== null && bccomp($amount, $maximumFee, 2) > 0) {
            $amount = $maximumFee;
        }

        return $this->roundMoney($amount);
    }

    private function percentageAmount(string $baseAmount, string $percentage): string
    {
        $rawAmount = bcdiv(bcmul($baseAmount, $percentage, 6), '100', 6);

        return $this->roundMoney($rawAmount);
    }

    private function roundMoney(string $amount): string
    {
        $cents = bcdiv(bcmul($amount, '100', 6), '1', 0);
        $fractionalCent = bcsub(bcmul($amount, '100', 6), $cents, 6);
        if (bccomp($fractionalCent, '0.5', 6) >= 0) {
            $cents = bcadd($cents, '1', 0);
        }

        return bcdiv($cents, '100', 2);
    }

    private function volumetricWeight(string $length, string $width, string $height, int $divisor): int
    {
        $volume = bcmul(bcmul($length, $width, 4), $height, 6);
        $volumeInGramUnits = bcmul($volume, '1000', 6);
        $wholeWeight = bcdiv($volumeInGramUnits, (string) $divisor, 0);
        $calculatedVolume = bcmul($wholeWeight, (string) $divisor, 6);

        if (bccomp($volumeInGramUnits, $calculatedVolume, 6) > 0) {
            $wholeWeight = bcadd($wholeWeight, '1', 0);
        }

        if (bccomp($wholeWeight, (string) self::MAX_UNSIGNED_INTEGER, 0) > 0) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Trọng lượng quy đổi vượt giới hạn lưu trữ.',
                ['parcels' => ['Kiện hàng có kích thước quá lớn.']],
            );
        }

        return (int) $wholeWeight;
    }

    private function zoneType(int $senderProvinceId, int $recipientProvinceId): string
    {
        if ($senderProvinceId === $recipientProvinceId) {
            return 'intra_province';
        }

        $regions = $this->lookupRepository->findProvinceRegions($senderProvinceId, $recipientProvinceId);
        if ($regions['sender_region'] === $regions['recipient_region']) {
            return 'intra_region';
        }

        $regionPair = [$regions['sender_region'], $regions['recipient_region']];
        sort($regionPair);

        return $regionPair === ['north', 'south'] ? 'inter_region_far' : 'inter_region_near';
    }
}
