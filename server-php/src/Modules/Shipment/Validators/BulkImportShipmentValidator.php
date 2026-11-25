<?php
declare(strict_types=1);
namespace App\Modules\Shipment\Validators;
use App\Core\ApiException;
use App\Modules\Shipment\DTOs\CreateShipmentDto;
use App\Modules\Shipment\Repositories\PricingLookupRepository;
final class BulkImportShipmentValidator
{
    private const MAX_ROWS = 500;
    public function __construct(
        private readonly CreateShipmentValidator $shipmentValidator,
        private readonly PricingLookupRepository $lookupRepository,
    ) {
    }
    /**
     * @param array<string, mixed> $payload
     * @return array{
     *     valid_rows: list<array{row_index: int, dto: CreateShipmentDto}>,
     *     row_errors: list<array{row_index: int, errors: array<string, list<string>>}>,
     *     total_rows: int,
     *     dry_run: bool
     * }
     */
    public function validateBatch(array $payload): array
    {
        $rawRows = $payload['rows'] ?? $payload['shipments'] ?? $payload['items'] ?? null;
        if (!is_array($rawRows) or !array_is_list($rawRows) or ($rawRows === [])) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Danh sách dòng vận đơn import (rows) không được để trống.',
                ['rows' => ['Vui lòng truyền mảng rows chứa ít nhất 1 dòng dữ liệu từ file Excel.']],
            );
        }
        $totalRows = count($rawRows);
        if ($totalRows > self::MAX_ROWS) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Số lượng dòng vượt quá giới hạn cho phép mỗi lần import.',
                ['rows' => ['Tối đa ' . self::MAX_ROWS . ' vận đơn trong một lần import.']],
            );
        }
        $defaultSender = is_array($payload['default_sender'] ?? null) ? $payload['default_sender'] : [];
        $defaultCreationMode = is_string($payload['creation_mode'] ?? null) ? $payload['creation_mode'] : 'driver_pickup';
        $dryRun = filter_var($payload['dry_run'] ?? $payload['validate_only'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $validRows = [];
        $rowErrors = [];
        foreach ($rawRows as $index => $rawRow) {
            $rowIndex = $index + 1;
            if (is_array($rawRow) and isset($rawRow['row_index'])) {
                $parsedIndex = filter_var($rawRow['row_index'], FILTER_VALIDATE_INT);
                if (($parsedIndex !== false) and ($parsedIndex >= 1)) {
                    $rowIndex = $parsedIndex;
                }
            }
            if (!is_array($rawRow)) {
                $rowErrors[] = [
                    'row_index' => $rowIndex,
                    'errors' => ['row' => ['Dữ liệu dòng không đúng định dạng đối tượng JSON.']],
                ];
                continue;
            }
            $normalized = $this->normalizeRow($rawRow, $defaultSender, $payload, $defaultCreationMode);
            try {
                $dto = $this->shipmentValidator->validate($normalized);
                $validRows[] = [
                    'row_index' => $rowIndex,
                    'dto' => $dto,
                ];
            } catch (ApiException $exception) {
                $details = $exception->details;
                /** @var array<string, list<string>> $fieldErrors */
                $fieldErrors = $details !== []
                    ? $details
                    : ['row' => [$exception->getMessage()]];
                $rowErrors[] = [
                    'row_index' => $rowIndex,
                    'errors' => $fieldErrors,
                ];
            }
        }
        return [
            'valid_rows' => $validRows,
            'row_errors' => $rowErrors,
            'total_rows' => $totalRows,
            'dry_run' => $dryRun,
        ];
    }
    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $defaultSender
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function normalizeRow(
        array $row,
        array $defaultSender,
        array $payload,
        string $defaultCreationMode,
    ): array {
        $senderFields = [
            'sender_name',
            'sender_phone',
            'sender_address',
            'sender_province_id',
            'sender_district_id',
            'sender_ward_id',
        ];
        foreach ($senderFields as $field) {
            if (!isset($row[$field]) or ($row[$field] === '') or ($row[$field] === null)) {
                if (isset($defaultSender[$field]) and ($defaultSender[$field] !== '')) {
                    $row[$field] = $defaultSender[$field];
                } elseif (isset($payload[$field]) and ($payload[$field] !== '')) {
                    $row[$field] = $payload[$field];
                }
            }
        }
        if ((!isset($row['service_type_id']) or ($row['service_type_id'] === '') or ($row['service_type_id'] === null))
            and isset($row['service_type_code']) and is_string($row['service_type_code']) and (trim($row['service_type_code']) !== '')
        ) {
            $resolvedServiceId = $this->lookupRepository->findServiceTypeIdByCode(trim($row['service_type_code']));
            if ($resolvedServiceId !== null) {
                $row['service_type_id'] = $resolvedServiceId;
            }
        }
        if ((!isset($row['cargo_category_id']) or ($row['cargo_category_id'] === '') or ($row['cargo_category_id'] === null))
            and isset($row['cargo_category_code']) and is_string($row['cargo_category_code']) and (trim($row['cargo_category_code']) !== '')
        ) {
            $resolvedCargoId = $this->lookupRepository->findCargoCategoryIdByCode(trim($row['cargo_category_code']));
            if ($resolvedCargoId !== null) {
                $row['cargo_category_id'] = $resolvedCargoId;
            }
        }
        if (!isset($row['destination_branch_id']) or ($row['destination_branch_id'] === '') or ($row['destination_branch_id'] === null)) {
            $recipientProvinceId = filter_var($row['recipient_province_id'] ?? null, FILTER_VALIDATE_INT);
            if (($recipientProvinceId !== false) and ($recipientProvinceId > 0)) {
                $resolvedBranchId = $this->lookupRepository->findDefaultBranchIdByProvince($recipientProvinceId);
                if ($resolvedBranchId !== null) {
                    $row['destination_branch_id'] = $resolvedBranchId;
                }
            }
        }
        if (!isset($row['cod_amount']) or ($row['cod_amount'] === '') or ($row['cod_amount'] === null)) {
            $row['cod_amount'] = '0.00';
        }
        if (!isset($row['declared_value']) or ($row['declared_value'] === '') or ($row['declared_value'] === null)) {
            $row['declared_value'] = '0.00';
        }
        if (!isset($row['creation_mode']) or ($row['creation_mode'] === '') or ($row['creation_mode'] === null)) {
            $row['creation_mode'] = $defaultCreationMode;
        }
        if (!isset($row['vas_ids']) or ($row['vas_ids'] === null) or ($row['vas_ids'] === '')) {
            $row['vas_ids'] = [];
        }
        if (!isset($row['surcharge_ids']) or ($row['surcharge_ids'] === null) or ($row['surcharge_ids'] === '')) {
            $row['surcharge_ids'] = [];
        }
        if (!isset($row['parcels']) and (isset($row['actual_weight_gram']) or isset($row['weight_gram']))) {
            $row['parcels'] = [[
                'actual_weight_gram' => $row['actual_weight_gram'] ?? $row['weight_gram'],
                'length_cm' => $row['length_cm'] ?? '10.00',
                'width_cm' => $row['width_cm'] ?? '10.00',
                'height_cm' => $row['height_cm'] ?? '10.00',
                'description' => $row['description'] ?? $row['parcel_description'] ?? null,
            ]];
        }
        return $row;
    }
}