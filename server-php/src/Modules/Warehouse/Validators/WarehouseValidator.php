<?php

declare(strict_types=1);

namespace App\Modules\Warehouse\Validators;

use App\Core\ApiException;

final class WarehouseValidator
{
    private const INBOUND_SOURCES = ['new_pickup', 'linehaul_in', 'redelivery', 'counter_created'];
    private const RECEIPT_STATUSES = ['draft', 'confirmed', 'unlocked', 'handed_over', 'cancelled'];
    private const BAG_STATUSES = ['open', 'sealed', 'in_transit', 'opened', 'cancelled'];

    /**
     * @param array<string, mixed> $query
     * @return array{page: int, per_page: int, status: ?string, warehouse_id: ?int, receipt_code: ?string}
     */
    public function validateReceiptListQuery(array $query): array
    {
        $errors = [];
        $page = $this->positiveInt($query['page'] ?? 1, 'page', $errors) ?? 1;
        $perPage = $this->positiveInt($query['per_page'] ?? 20, 'per_page', $errors) ?? 20;
        if ($perPage > 100) {
            $perPage = 100;
        }

        $status = isset($query['status']) && trim((string) $query['status']) !== ''
            ? trim((string) $query['status'])
            : null;
        if ($status !== null && !in_array($status, self::RECEIPT_STATUSES, true)) {
            $errors['status'][] = 'Trạng thái phiếu kho không hợp lệ.';
        }

        $warehouseId = isset($query['warehouse_id']) && trim((string) $query['warehouse_id']) !== ''
            ? $this->positiveInt($query['warehouse_id'], 'warehouse_id', $errors)
            : null;

        $receiptCode = isset($query['receipt_code']) && trim((string) $query['receipt_code']) !== ''
            ? strtoupper(trim((string) $query['receipt_code']))
            : null;

        $this->throwIfErrors($errors);

        return [
            'page' => $page,
            'per_page' => $perPage,
            'status' => $status,
            'warehouse_id' => $warehouseId,
            'receipt_code' => $receiptCode,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array{
     *     warehouse_id: int,
     *     target_warehouse_id: ?int,
     *     driver_id: ?int,
     *     vehicle_id: ?int,
     *     note: ?string,
     *     auto_confirm: bool,
     *     items: list<array{tracking_code: string, inbound_source_type: string}>
     * }
     */
    public function validateCreateReceipt(array $body): array
    {
        $errors = [];
        $warehouseId = $this->positiveInt($body['warehouse_id'] ?? null, 'warehouse_id', $errors, true);
        $targetWarehouseId = isset($body['target_warehouse_id']) && $body['target_warehouse_id'] !== ''
            ? $this->positiveInt($body['target_warehouse_id'], 'target_warehouse_id', $errors)
            : null;
        $driverId = isset($body['driver_id']) && $body['driver_id'] !== ''
            ? $this->positiveInt($body['driver_id'], 'driver_id', $errors)
            : null;
        $vehicleId = isset($body['vehicle_id']) && $body['vehicle_id'] !== ''
            ? $this->positiveInt($body['vehicle_id'], 'vehicle_id', $errors)
            : null;

        $note = isset($body['note']) && trim((string) $body['note']) !== ''
            ? mb_substr(trim((string) $body['note']), 0, 500)
            : null;

        $autoConfirm = filter_var($body['auto_confirm'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $defaultSource = $this->validateInboundSource($body['inbound_source_type'] ?? 'linehaul_in', 'inbound_source_type', $errors);
        $items = $this->extractScanItems($body, $defaultSource, $errors);

        $this->throwIfErrors($errors);

        return [
            'warehouse_id' => (int) $warehouseId,
            'target_warehouse_id' => $targetWarehouseId,
            'driver_id' => $driverId,
            'vehicle_id' => $vehicleId,
            'note' => $note,
            'auto_confirm' => $autoConfirm,
            'items' => $items,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return list<array{tracking_code: string, inbound_source_type: string}>
     */
    public function validateScanReceiptItems(array $body): array
    {
        $errors = [];
        $defaultSource = $this->validateInboundSource($body['inbound_source_type'] ?? 'linehaul_in', 'inbound_source_type', $errors);
        $items = $this->extractScanItems($body, $defaultSource, $errors);

        if ($items === []) {
            $errors['tracking_codes'][] = 'Vui lòng cung cấp ít nhất 1 mã vận đơn (tracking_code hoặc tracking_codes) để quét nhập kho.';
        }

        $this->throwIfErrors($errors);

        return $items;
    }

    /**
     * @param array<string, mixed> $body
     * @return array{version: ?int, note: ?string}
     */
    public function validateConfirmReceipt(array $body): array
    {
        $errors = [];
        $version = isset($body['version']) && $body['version'] !== ''
            ? $this->positiveInt($body['version'], 'version', $errors)
            : null;
        $note = isset($body['note']) && trim((string) $body['note']) !== ''
            ? mb_substr(trim((string) $body['note']), 0, 500)
            : null;

        $this->throwIfErrors($errors);

        return [
            'version' => $version,
            'note' => $note,
        ];
    }

    /**
     * @param array<string, mixed> $query
     * @return array{page: int, per_page: int, status: ?string, origin_warehouse_id: ?int, destination_warehouse_id: ?int, bag_code: ?string, seal_number: ?string}
     */
    public function validateBagListQuery(array $query): array
    {
        $errors = [];
        $page = $this->positiveInt($query['page'] ?? 1, 'page', $errors) ?? 1;
        $perPage = $this->positiveInt($query['per_page'] ?? 20, 'per_page', $errors) ?? 20;
        if ($perPage > 100) {
            $perPage = 100;
        }

        $status = isset($query['status']) && trim((string) $query['status']) !== ''
            ? trim((string) $query['status'])
            : null;
        if ($status !== null && !in_array($status, self::BAG_STATUSES, true)) {
            $errors['status'][] = 'Trạng thái túi hàng không hợp lệ.';
        }

        $originWarehouseId = isset($query['origin_warehouse_id']) && trim((string) $query['origin_warehouse_id']) !== ''
            ? $this->positiveInt($query['origin_warehouse_id'], 'origin_warehouse_id', $errors)
            : null;
        $destinationWarehouseId = isset($query['destination_warehouse_id']) && trim((string) $query['destination_warehouse_id']) !== ''
            ? $this->positiveInt($query['destination_warehouse_id'], 'destination_warehouse_id', $errors)
            : null;
        $bagCode = isset($query['bag_code']) && trim((string) $query['bag_code']) !== ''
            ? strtoupper(trim((string) $query['bag_code']))
            : null;
        $sealNumber = isset($query['seal_number']) && trim((string) $query['seal_number']) !== ''
            ? strtoupper(trim((string) $query['seal_number']))
            : null;

        $this->throwIfErrors($errors);

        return [
            'page' => $page,
            'per_page' => $perPage,
            'status' => $status,
            'origin_warehouse_id' => $originWarehouseId,
            'destination_warehouse_id' => $destinationWarehouseId,
            'bag_code' => $bagCode,
            'seal_number' => $sealNumber,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array{
     *     origin_warehouse_id: int,
     *     destination_warehouse_id: int,
     *     seal_number: ?string,
     *     strict_routing: bool,
     *     tracking_codes: list<string>
     * }
     */
    public function validateCreateBag(array $body): array
    {
        $errors = [];
        $originWarehouseId = $this->positiveInt($body['origin_warehouse_id'] ?? null, 'origin_warehouse_id', $errors, true);
        $destinationWarehouseId = $this->positiveInt($body['destination_warehouse_id'] ?? null, 'destination_warehouse_id', $errors, true);

        if ($originWarehouseId !== null && $destinationWarehouseId !== null && $originWarehouseId === $destinationWarehouseId) {
            $errors['destination_warehouse_id'][] = 'Kho nhận túi phải khác kho đóng túi.';
        }

        $sealNumber = isset($body['seal_number']) && trim((string) $body['seal_number']) !== ''
            ? strtoupper(mb_substr(trim((string) $body['seal_number']), 0, 40))
            : null;

        $strictRouting = filter_var($body['strict_routing'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $trackingCodes = $this->extractTrackingCodes($body, $errors);

        $this->throwIfErrors($errors);

        return [
            'origin_warehouse_id' => (int) $originWarehouseId,
            'destination_warehouse_id' => (int) $destinationWarehouseId,
            'seal_number' => $sealNumber,
            'strict_routing' => $strictRouting,
            'tracking_codes' => $trackingCodes,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array{tracking_codes: list<string>, strict_routing: bool}
     */
    public function validateBagScanItems(array $body): array
    {
        $errors = [];
        $trackingCodes = $this->extractTrackingCodes($body, $errors);
        if ($trackingCodes === []) {
            $errors['tracking_codes'][] = 'Vui lòng cung cấp ít nhất 1 mã vận đơn (tracking_code hoặc tracking_codes) để đóng vào túi.';
        }

        $strictRouting = filter_var($body['strict_routing'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $this->throwIfErrors($errors);

        return [
            'tracking_codes' => $trackingCodes,
            'strict_routing' => $strictRouting,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array{seal_number: ?string, version: ?int}
     */
    public function validateSealBag(array $body): array
    {
        $errors = [];
        $sealNumber = isset($body['seal_number']) && trim((string) $body['seal_number']) !== ''
            ? strtoupper(mb_substr(trim((string) $body['seal_number']), 0, 40))
            : null;
        $version = isset($body['version']) && $body['version'] !== ''
            ? $this->positiveInt($body['version'], 'version', $errors)
            : null;

        $this->throwIfErrors($errors);

        return [
            'seal_number' => $sealNumber,
            'version' => $version,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array{warehouse_id: ?int, seal_number: ?string, version: ?int}
     */
    public function validateOpenBag(array $body): array
    {
        $errors = [];
        $warehouseId = isset($body['warehouse_id']) && $body['warehouse_id'] !== ''
            ? $this->positiveInt($body['warehouse_id'], 'warehouse_id', $errors)
            : null;
        $sealNumber = isset($body['seal_number']) && trim((string) $body['seal_number']) !== ''
            ? strtoupper(mb_substr(trim((string) $body['seal_number']), 0, 40))
            : null;
        $version = isset($body['version']) && $body['version'] !== ''
            ? $this->positiveInt($body['version'], 'version', $errors)
            : null;

        $this->throwIfErrors($errors);

        return [
            'warehouse_id' => $warehouseId,
            'seal_number' => $sealNumber,
            'version' => $version,
        ];
    }

    /**
     * @param array<string, mixed> $query
     * @return array{
     *     origin_warehouse_id: ?int,
     *     destination_branch_id: ?int,
     *     next_hop_warehouse_id: ?int,
     *     tracking_code: ?string
     * }
     */
    public function validateRoutingCheckQuery(array $query): array
    {
        $errors = [];
        $originWarehouseId = isset($query['origin_warehouse_id']) && trim((string) $query['origin_warehouse_id']) !== ''
            ? $this->positiveInt($query['origin_warehouse_id'], 'origin_warehouse_id', $errors)
            : (isset($query['warehouse_id']) && trim((string) $query['warehouse_id']) !== ''
                ? $this->positiveInt($query['warehouse_id'], 'warehouse_id', $errors)
                : null);

        $destinationBranchId = isset($query['destination_branch_id']) && trim((string) $query['destination_branch_id']) !== ''
            ? $this->positiveInt($query['destination_branch_id'], 'destination_branch_id', $errors)
            : null;

        $nextHopWarehouseId = isset($query['next_hop_warehouse_id']) && trim((string) $query['next_hop_warehouse_id']) !== ''
            ? $this->positiveInt($query['next_hop_warehouse_id'], 'next_hop_warehouse_id', $errors)
            : (isset($query['target_warehouse_id']) && trim((string) $query['target_warehouse_id']) !== ''
                ? $this->positiveInt($query['target_warehouse_id'], 'target_warehouse_id', $errors)
                : null);

        $trackingCode = isset($query['tracking_code']) && trim((string) $query['tracking_code']) !== ''
            ? strtoupper(trim((string) $query['tracking_code']))
            : null;

        if ($trackingCode === null && ($originWarehouseId === null || $destinationBranchId === null)) {
            $errors['routing'][] = 'Cần truyền tracking_code hoặc cặp tham số origin_warehouse_id và destination_branch_id.';
        }

        $this->throwIfErrors($errors);

        return [
            'origin_warehouse_id' => $originWarehouseId,
            'destination_branch_id' => $destinationBranchId,
            'next_hop_warehouse_id' => $nextHopWarehouseId,
            'tracking_code' => $trackingCode,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @param array<string, list<string>> $errors
     * @return list<array{tracking_code: string, inbound_source_type: string}>
     */
    private function extractScanItems(array $body, string $defaultSource, array &$errors): array
    {
        $items = [];
        $seen = [];

        if (isset($body['items']) && is_array($body['items'])) {
            foreach ($body['items'] as $idx => $item) {
                if (!is_array($item)) {
                    $errors["items.{$idx}"][] = 'Phần tử danh sách quét không hợp lệ.';
                    continue;
                }
                $code = strtoupper(trim((string) ($item['tracking_code'] ?? '')));
                if ($code === '') {
                    $errors["items.{$idx}.tracking_code"][] = 'Mã vận đơn không được để trống.';
                    continue;
                }
                $src = $this->validateInboundSource($item['inbound_source_type'] ?? $defaultSource, "items.{$idx}.inbound_source_type", $errors);
                if (!isset($seen[$code])) {
                    $seen[$code] = true;
                    $items[] = [
                        'tracking_code' => $code,
                        'inbound_source_type' => $src,
                    ];
                }
            }
        }

        foreach ($this->extractTrackingCodes($body, $errors) as $code) {
            if (!isset($seen[$code])) {
                $seen[$code] = true;
                $items[] = [
                    'tracking_code' => $code,
                    'inbound_source_type' => $defaultSource,
                ];
            }
        }

        return $items;
    }

    /**
     * @param array<string, mixed> $body
     * @param array<string, list<string>> $errors
     * @return list<string>
     */
    private function extractTrackingCodes(array $body, array &$errors): array
    {
        $codes = [];
        $seen = [];

        if (isset($body['tracking_code']) && trim((string) $body['tracking_code']) !== '') {
            $code = strtoupper(trim((string) $body['tracking_code']));
            $seen[$code] = true;
            $codes[] = $code;
        }

        if (isset($body['tracking_codes'])) {
            if (!is_array($body['tracking_codes'])) {
                $errors['tracking_codes'][] = 'tracking_codes phải là một mảng chuỗi mã vận đơn.';
            } else {
                foreach ($body['tracking_codes'] as $idx => $raw) {
                    $code = strtoupper(trim((string) $raw));
                    if ($code === '') {
                        $errors["tracking_codes.{$idx}"][] = 'Mã vận đơn không được để trống.';
                        continue;
                    }
                    if (!isset($seen[$code])) {
                        $seen[$code] = true;
                        $codes[] = $code;
                    }
                }
            }
        }

        return $codes;
    }

    /**
     * @param array<string, list<string>> $errors
     */
    private function validateInboundSource(mixed $value, string $field, array &$errors): string
    {
        $source = trim((string) $value);
        if (!in_array($source, self::INBOUND_SOURCES, true)) {
            $errors[$field][] = 'Nguồn nhập kho phải thuộc: ' . implode(', ', self::INBOUND_SOURCES) . '.';
            return 'linehaul_in';
        }

        return $source;
    }

    /**
     * @param array<string, list<string>> $errors
     */
    private function positiveInt(mixed $value, string $field, array &$errors, bool $required = false): ?int
    {
        if ($value === null || $value === '') {
            if ($required) {
                $errors[$field][] = "Trường {$field} là bắt buộc.";
            }
            return null;
        }

        $int = filter_var($value, FILTER_VALIDATE_INT);
        if ($int === false || $int < 1) {
            $errors[$field][] = "Trường {$field} phải là số nguyên dương.";
            return null;
        }

        return (int) $int;
    }

    /**
     * @param array<string, list<string>> $errors
     */
    private function throwIfErrors(array $errors): void
    {
        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu đầu vào không hợp lệ.', $errors);
        }
    }
}