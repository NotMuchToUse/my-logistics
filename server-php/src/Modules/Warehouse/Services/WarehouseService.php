<?php

declare(strict_types=1);

namespace App\Modules\Warehouse\Services;

use App\Core\ApiException;
use App\Core\Database;
use App\Modules\Warehouse\Repositories\WarehouseRepository;

final class WarehouseService
{
    private const BLOCKED_SHIPMENT_STATUSES = ['delivered', 'returned', 'cancelled'];
    private const PACKABLE_SHIPMENT_STATUSES = ['in_warehouse', 'picked_up', 'pending_return'];

    public function __construct(private readonly WarehouseRepository $repository)
    {
    }

    /**
     * @param array<string, mixed> $query
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function checkRouting(array $query, array $scopeContext): array
    {
        $originWarehouseId = $query['origin_warehouse_id'];
        $destinationBranchId = $query['destination_branch_id'];
        $nextHopWarehouseId = $query['next_hop_warehouse_id'];
        $shipment = null;

        if ($query['tracking_code'] !== null) {
            $shipment = $this->repository->findShipmentByTrackingCode((string) $query['tracking_code'], false);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$query['tracking_code']}.");
            }
            if ($destinationBranchId === null) {
                $destinationBranchId = (int) $shipment['destination_branch_id'];
            }
            if ($originWarehouseId === null) {
                if ($shipment['current_warehouse_id'] !== null) {
                    $originWarehouseId = (int) $shipment['current_warehouse_id'];
                } elseif (!empty($scopeContext['allowed_warehouse_ids'])) {
                    $originWarehouseId = (int) $scopeContext['allowed_warehouse_ids'][0];
                } elseif ($shipment['current_branch_id'] !== null) {
                    $primaryWh = $this->repository->findPrimaryWarehouseByBranchId((int) $shipment['current_branch_id']);
                    if ($primaryWh !== null) {
                        $originWarehouseId = (int) $primaryWh['id'];
                    }
                }
            }
        }

        if ($originWarehouseId === null || $destinationBranchId === null) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Không xác định được kho hiện tại hoặc chi nhánh đích để kiểm tra định tuyến.',
            );
        }

        $result = $this->evaluateRoute($originWarehouseId, $destinationBranchId, $nextHopWarehouseId);
        if ($shipment !== null) {
            $result['shipment'] = [
                'public_id' => $shipment['public_id'],
                'tracking_code' => $shipment['tracking_code'],
                'status' => $shipment['status'],
                'origin_branch_id' => (int) $shipment['origin_branch_id'],
                'destination_branch_id' => (int) $shipment['destination_branch_id'],
                'current_warehouse_id' => $shipment['current_warehouse_id'] !== null ? (int) $shipment['current_warehouse_id'] : null,
            ];
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $query
     * @return list<array<string, mixed>>
     */
    public function listRoutingRules(array $query): array
    {
        $originWarehouseId = isset($query['origin_warehouse_id']) && is_numeric($query['origin_warehouse_id'])
            ? (int) $query['origin_warehouse_id']
            : null;
        $destinationBranchId = isset($query['destination_branch_id']) && is_numeric($query['destination_branch_id'])
            ? (int) $query['destination_branch_id']
            : null;

        return $this->repository->listRoutingRules($originWarehouseId, $destinationBranchId);
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function listReceipts(array $filters, array $scopeContext): array
    {
        $allowedWarehouseIds = $this->resolveAllowedWarehouseIds($scopeContext);
        if ($filters['warehouse_id'] !== null) {
            $this->assertWarehouseInScope((int) $filters['warehouse_id'], $scopeContext);
        }

        return $this->repository->paginateReceipts($filters, $allowedWarehouseIds);
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createInboundReceipt(
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        $warehouse = $this->assertWarehouseInScope((int) $payload['warehouse_id'], $scopeContext);

        if ($payload['target_warehouse_id'] !== null) {
            $targetWh = $this->repository->findWarehouseById((int) $payload['target_warehouse_id']);
            if ($targetWh === null || (int) $targetWh['is_active'] !== 1) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy kho nguồn/đích hợp lệ.');
            }
        }

        return Database::transaction(function () use ($payload, $warehouse, $userId, $ipAddress, $userAgent): array {
            $publicId = $this->generateUlid();
            $receiptCode = $this->generateCode('WHIN');

            $receiptId = $this->repository->insertReceipt([
                'public_id' => $publicId,
                'receipt_code' => $receiptCode,
                'receipt_type' => 'inbound',
                'warehouse_id' => (int) $warehouse['id'],
                'target_warehouse_id' => $payload['target_warehouse_id'],
                'driver_id' => $payload['driver_id'],
                'vehicle_id' => $payload['vehicle_id'],
                'status' => 'draft',
                'note' => $payload['note'],
                'created_by' => $userId,
            ]);

            $scanResults = [];
            if ($payload['items'] !== []) {
                $scanResults = $this->performReceiptScan(
                    $receiptId,
                    $receiptCode,
                    $warehouse,
                    $payload['items'],
                    $userId,
                );
                $this->repository->recalculateReceiptTotals($receiptId, $userId);
            }

            if ($payload['auto_confirm']) {
                if ($scanResults === []) {
                    throw new ApiException(
                        '422_VALIDATION_ERROR',
                        'Không thể chốt tự động phiếu nhập kho khi chưa có vận đơn nào được quét.',
                    );
                }
                $this->repository->confirmReceipt($receiptId, $userId, null);
            }

            $receipt = $this->repository->findReceiptByPublicId($publicId, false);
            $items = $this->repository->listReceiptItems($receiptId);

            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'create_inbound_receipt',
                'warehouse_receipts',
                $receiptId,
                null,
                [
                    'receipt_code' => $receiptCode,
                    'warehouse_id' => (int) $warehouse['id'],
                    'status' => $receipt['status'] ?? 'draft',
                    'scanned_count' => count($scanResults),
                ],
                $ipAddress,
                $userAgent,
            );

            $wrongRouteCount = count(array_filter(
                $items,
                static fn (array $item): bool => (int) ($item['is_wrong_route'] ?? 0) === 1,
            ));

            return [
                ...$this->formatReceipt($receipt ?? []),
                'wrong_route_count' => $wrongRouteCount,
                'items' => $items,
                'scan_summary' => $scanResults,
            ];
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function showReceipt(string $publicId, array $scopeContext): array
    {
        $receipt = $this->repository->findReceiptByPublicId($publicId, false);
        if ($receipt === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu nhập kho.');
        }

        $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);
        $items = $this->repository->listReceiptItems((int) $receipt['id']);
        $wrongRouteCount = count(array_filter(
            $items,
            static fn (array $item): bool => (int) ($item['is_wrong_route'] ?? 0) === 1,
        ));

        return [
            ...$this->formatReceipt($receipt),
            'wrong_route_count' => $wrongRouteCount,
            'items' => $items,
        ];
    }

    /**
     * @param list<array{tracking_code: string, inbound_source_type: string}> $scanItems
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function scanInboundReceipt(
        string $publicId,
        array $scanItems,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $scanItems, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu nhập kho.');
            }
            if ((string) $receipt['receipt_type'] !== 'inbound') {
                throw new ApiException('422_VALIDATION_ERROR', 'Chỉ hỗ trợ quét nhập kho trên phiếu loại inbound.');
            }
            if (!in_array((string) $receipt['status'], ['draft', 'unlocked'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Phiếu nhập kho đang ở trạng thái '{$receipt['status']}', không thể quét thêm vận đơn.",
                );
            }

            $warehouse = $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);
            $receiptId = (int) $receipt['id'];

            $scanResults = $this->performReceiptScan(
                $receiptId,
                (string) $receipt['receipt_code'],
                $warehouse,
                $scanItems,
                $userId,
            );
            $this->repository->recalculateReceiptTotals($receiptId, $userId);

            $updatedReceipt = $this->repository->findReceiptByPublicId($publicId, false);
            $items = $this->repository->listReceiptItems($receiptId);
            $wrongRouteCount = count(array_filter(
                $items,
                static fn (array $item): bool => (int) ($item['is_wrong_route'] ?? 0) === 1,
            ));

            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'scan_inbound_receipt',
                'warehouse_receipts',
                $receiptId,
                ['total_shipments' => (int) $receipt['total_shipments']],
                ['total_shipments' => (int) ($updatedReceipt['total_shipments'] ?? 0), 'scanned_codes' => array_column($scanResults, 'tracking_code')],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatReceipt($updatedReceipt ?? []),
                'wrong_route_count' => $wrongRouteCount,
                'scanned_items' => $scanResults,
                'items' => $items,
            ];
        });
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function confirmInboundReceipt(
        string $publicId,
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $payload, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu nhập kho.');
            }

            $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);

            if ($payload['version'] !== null && (int) $receipt['version'] !== (int) $payload['version']) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Phiếu nhập kho đã được cập nhật bởi người dùng khác. Vui lòng tải lại dữ liệu mới nhất.',
                );
            }

            if (!in_array((string) $receipt['status'], ['draft', 'unlocked'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Không thể chốt phiếu nhập kho ở trạng thái '{$receipt['status']}'.",
                );
            }

            if ((int) $receipt['total_shipments'] < 1 && (int) $receipt['total_bags'] < 1) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Phiếu nhập kho chưa có vận đơn hoặc túi hàng nào để chốt.',
                );
            }

            $receiptId = (int) $receipt['id'];
            $this->repository->confirmReceipt($receiptId, $userId, $payload['note']);
            $updated = $this->repository->findReceiptByPublicId($publicId, false);
            $items = $this->repository->listReceiptItems($receiptId);

            $this->repository->insertAuditLog(
                $userId,
                (int) $receipt['branch_id'],
                'confirm_inbound_receipt',
                'warehouse_receipts',
                $receiptId,
                ['status' => $receipt['status'], 'version' => (int) $receipt['version']],
                ['status' => 'confirmed', 'version' => (int) ($updated['version'] ?? 0)],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatReceipt($updated ?? []),
                'items' => $items,
            ];
        });
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function listBags(array $filters, array $scopeContext): array
    {
        $allowedWarehouseIds = $this->resolveAllowedWarehouseIds($scopeContext);
        if ($filters['origin_warehouse_id'] !== null) {
            $this->assertWarehouseInScope((int) $filters['origin_warehouse_id'], $scopeContext);
        }

        return $this->repository->paginateBags($filters, $allowedWarehouseIds);
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createBag(
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        $originWarehouse = $this->assertWarehouseInScope((int) $payload['origin_warehouse_id'], $scopeContext);
        $destWarehouse = $this->repository->findWarehouseById((int) $payload['destination_warehouse_id']);
        if ($destWarehouse === null || (int) $destWarehouse['is_active'] !== 1) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy kho đích nhận túi hàng.');
        }

        return Database::transaction(function () use ($payload, $originWarehouse, $destWarehouse, $userId, $ipAddress, $userAgent): array {
            $publicId = $this->generateUlid();
            $bagCode = $this->generateCode('BAG');
            $sealNumber = $payload['seal_number'] ?? $this->generateCode('SEAL');

            $bagId = $this->repository->insertBag([
                'public_id' => $publicId,
                'bag_code' => $bagCode,
                'seal_number' => $sealNumber,
                'origin_warehouse_id' => (int) $originWarehouse['id'],
                'destination_warehouse_id' => (int) $destWarehouse['id'],
                'created_by' => $userId,
            ]);

            $packedSummary = [];
            if ($payload['tracking_codes'] !== []) {
                $packedSummary = $this->performBagPack(
                    $bagId,
                    $bagCode,
                    $originWarehouse,
                    $destWarehouse,
                    $payload['tracking_codes'],
                    (bool) $payload['strict_routing'],
                    $userId,
                );
                $this->repository->recalculateBagTotals($bagId, $userId);
            }

            $bag = $this->repository->findBagByPublicId($publicId, false);
            $items = $this->repository->listBagItems($bagId, true);

            $this->repository->insertAuditLog(
                $userId,
                (int) $originWarehouse['branch_id'],
                'create_manifest_bag',
                'manifest_bags',
                $bagId,
                null,
                [
                    'bag_code' => $bagCode,
                    'seal_number' => $sealNumber,
                    'origin_warehouse_id' => (int) $originWarehouse['id'],
                    'destination_warehouse_id' => (int) $destWarehouse['id'],
                    'shipment_count' => (int) ($bag['shipment_count'] ?? 0),
                ],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatBag($bag ?? []),
                'packed_summary' => $packedSummary,
                'items' => $items,
            ];
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function showBag(string $publicId, array $scopeContext): array
    {
        $bag = $this->repository->findBagByPublicId($publicId, false);
        if ($bag === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy túi hàng.');
        }

        $this->assertBagAccessible($bag, $scopeContext);
        $items = $this->repository->listBagItems((int) $bag['id'], false);

        return [
            ...$this->formatBag($bag),
            'items' => $items,
        ];
    }

    /**
     * @param list<string> $trackingCodes
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function addItemsToBag(
        string $publicId,
        array $trackingCodes,
        bool $strictRouting,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $trackingCodes, $strictRouting, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $bag = $this->repository->findBagByPublicId($publicId, true);
            if ($bag === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy túi hàng.');
            }
            if ((string) $bag['status'] !== 'open') {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Túi hàng đang ở trạng thái '{$bag['status']}', không thể đóng thêm vận đơn.",
                );
            }

            $originWarehouse = $this->assertWarehouseInScope((int) $bag['origin_warehouse_id'], $scopeContext);
            $destWarehouse = $this->repository->findWarehouseById((int) $bag['destination_warehouse_id']);
            if ($destWarehouse === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy kho đích của túi hàng.');
            }

            $bagId = (int) $bag['id'];
            $packedSummary = $this->performBagPack(
                $bagId,
                (string) $bag['bag_code'],
                $originWarehouse,
                $destWarehouse,
                $trackingCodes,
                $strictRouting,
                $userId,
            );
            $this->repository->recalculateBagTotals($bagId, $userId);

            $updatedBag = $this->repository->findBagByPublicId($publicId, false);
            $items = $this->repository->listBagItems($bagId, true);

            $this->repository->insertAuditLog(
                $userId,
                (int) $originWarehouse['branch_id'],
                'pack_manifest_bag_items',
                'manifest_bags',
                $bagId,
                ['shipment_count' => (int) $bag['shipment_count']],
                ['shipment_count' => (int) ($updatedBag['shipment_count'] ?? 0), 'tracking_codes' => $trackingCodes],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatBag($updatedBag ?? []),
                'packed_summary' => $packedSummary,
                'items' => $items,
            ];
        });
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function sealBag(
        string $publicId,
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $payload, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $bag = $this->repository->findBagByPublicId($publicId, true);
            if ($bag === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy túi hàng.');
            }

            $originWarehouse = $this->assertWarehouseInScope((int) $bag['origin_warehouse_id'], $scopeContext);

            if ($payload['version'] !== null && (int) $bag['version'] !== (int) $payload['version']) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Túi hàng đã được cập nhật bởi người dùng khác. Vui lòng tải lại dữ liệu mới nhất.',
                );
            }

            if ((string) $bag['status'] !== 'open') {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Chỉ có thể niêm phong Seal túi hàng ở trạng thái 'open' (hiện tại: '{$bag['status']}').",
                );
            }

            if ((int) $bag['shipment_count'] < 1) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Không thể niêm phong Seal túi hàng rỗng (0 vận đơn).',
                );
            }

            $bagId = (int) $bag['id'];
            $this->repository->sealBag($bagId, $payload['seal_number'], $userId);
            $updatedBag = $this->repository->findBagByPublicId($publicId, false);
            $items = $this->repository->listBagItems($bagId, true);

            $this->repository->insertAuditLog(
                $userId,
                (int) $originWarehouse['branch_id'],
                'seal_manifest_bag',
                'manifest_bags',
                $bagId,
                ['status' => 'open', 'seal_number' => $bag['seal_number'], 'version' => (int) $bag['version']],
                ['status' => 'sealed', 'seal_number' => $updatedBag['seal_number'] ?? $bag['seal_number'], 'version' => (int) ($updatedBag['version'] ?? 0)],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatBag($updatedBag ?? []),
                'items' => $items,
            ];
        });
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function openBag(
        string $publicId,
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $payload, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $bag = $this->repository->findBagByPublicId($publicId, true);
            if ($bag === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy túi hàng.');
            }

            if ($payload['version'] !== null && (int) $bag['version'] !== (int) $payload['version']) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Túi hàng đã được cập nhật bởi người dùng khác. Vui lòng tải lại dữ liệu mới nhất.',
                );
            }

            if (!in_array((string) $bag['status'], ['sealed', 'in_transit'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Chỉ có thể mở niêm phong túi hàng ở trạng thái 'sealed' hoặc 'in_transit' (hiện tại: '{$bag['status']}').",
                );
            }

            if ($payload['seal_number'] !== null && strtoupper((string) $bag['seal_number']) !== $payload['seal_number']) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Mã Seal đối chiếu không khớp (hệ thống: {$bag['seal_number']}, nhập vào: {$payload['seal_number']}).",
                );
            }

            $receivingWarehouseId = $payload['warehouse_id'] ?? (int) $bag['destination_warehouse_id'];
            $receivingWarehouse = $this->assertWarehouseInScope($receivingWarehouseId, $scopeContext);

            $bagId = (int) $bag['id'];
            $packedItems = $this->repository->listBagItems($bagId, true);

            $this->repository->markBagItemsUnpacked($bagId, $userId);
            $this->repository->markBagOpened($bagId, $userId);

            $unpackedShipments = [];
            foreach ($packedItems as $item) {
                $shipmentId = (int) $item['shipment_id'];
                $trackingCode = (string) $item['tracking_code'];
                $shipment = $this->repository->findShipmentByTrackingCode($trackingCode, true);
                if ($shipment === null) {
                    continue;
                }

                $fromStatus = (string) $shipment['status'];
                if (!in_array($fromStatus, self::BLOCKED_SHIPMENT_STATUSES, true)) {
                    $this->repository->updateShipmentWarehouseLocation(
                        $shipmentId,
                        (int) $receivingWarehouse['branch_id'],
                        (int) $receivingWarehouse['id'],
                        'in_warehouse',
                        $userId,
                    );

                    $this->repository->insertShipmentStatusHistory(
                        $shipmentId,
                        $fromStatus,
                        'in_warehouse',
                        (int) $receivingWarehouse['branch_id'],
                        (int) $receivingWarehouse['id'],
                        $userId,
                        "Mở túi Seal {$bag['bag_code']} (Seal: {$bag['seal_number']}) nhập vào kho {$receivingWarehouse['name']}",
                    );
                }

                $routing = $this->evaluateRoute(
                    (int) $receivingWarehouse['id'],
                    (int) $shipment['destination_branch_id'],
                    null,
                );

                $unpackedShipments[] = [
                    'tracking_code' => $trackingCode,
                    'previous_status' => $fromStatus,
                    'status' => 'in_warehouse',
                    'current_warehouse_id' => (int) $receivingWarehouse['id'],
                    'is_wrong_route' => $routing['is_wrong_route'],
                    'routing_warning' => $routing['warning'],
                ];
            }

            $updatedBag = $this->repository->findBagByPublicId($publicId, false);
            $items = $this->repository->listBagItems($bagId, false);

            $this->repository->insertAuditLog(
                $userId,
                (int) $receivingWarehouse['branch_id'],
                'open_manifest_bag',
                'manifest_bags',
                $bagId,
                ['status' => $bag['status'], 'version' => (int) $bag['version']],
                [
                    'status' => 'opened',
                    'receiving_warehouse_id' => (int) $receivingWarehouse['id'],
                    'unpacked_count' => count($unpackedShipments),
                    'version' => (int) ($updatedBag['version'] ?? 0),
                ],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatBag($updatedBag ?? []),
                'receiving_warehouse' => [
                    'id' => (int) $receivingWarehouse['id'],
                    'code' => $receivingWarehouse['code'],
                    'name' => $receivingWarehouse['name'],
                    'branch_id' => (int) $receivingWarehouse['branch_id'],
                ],
                'unpacked_shipments' => $unpackedShipments,
                'items' => $items,
            ];
        });
    }

    /**
     * @param array<string, mixed> $warehouse
     * @param list<array{tracking_code: string, inbound_source_type: string}> $scanItems
     * @return list<array<string, mixed>>
     */
    private function performReceiptScan(
        int $receiptId,
        string $receiptCode,
        array $warehouse,
        array $scanItems,
        int $userId,
    ): array {
        $warehouseId = (int) $warehouse['id'];
        $branchId = (int) $warehouse['branch_id'];
        $results = [];

        foreach ($scanItems as $item) {
            $trackingCode = $item['tracking_code'];
            $sourceType = $item['inbound_source_type'];

            $shipment = $this->repository->findShipmentByTrackingCode($trackingCode, true);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$trackingCode}.");
            }

            $shipmentId = (int) $shipment['id'];
            $fromStatus = (string) $shipment['status'];
            if (in_array($fromStatus, self::BLOCKED_SHIPMENT_STATUSES, true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} đang ở trạng thái kết thúc '{$fromStatus}', không thể quét nhập kho.",
                );
            }

            if ($this->repository->hasActiveShipmentInReceipt($receiptId, $shipmentId)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} đã tồn tại trong phiếu nhập kho {$receiptCode}.",
                );
            }

            $routing = $this->evaluateRoute($warehouseId, (int) $shipment['destination_branch_id'], null);
            $isWrongRoute = (bool) $routing['is_wrong_route'];

            $this->repository->insertReceiptItem(
                $receiptId,
                $shipmentId,
                $sourceType,
                $isWrongRoute,
                $userId,
            );

            $this->repository->updateShipmentWarehouseLocation(
                $shipmentId,
                $branchId,
                $warehouseId,
                'in_warehouse',
                $userId,
            );

            $desc = "Nhập kho {$warehouse['name']} ({$receiptCode})";
            if ($isWrongRoute && $routing['warning'] !== null) {
                $desc .= " [CẢNH BÁO SAI TUYẾN: {$routing['warning']}]";
            }

            $this->repository->insertShipmentStatusHistory(
                $shipmentId,
                $fromStatus,
                'in_warehouse',
                $branchId,
                $warehouseId,
                $userId,
                $desc,
            );

            $results[] = [
                'shipment_public_id' => $shipment['public_id'],
                'tracking_code' => $trackingCode,
                'inbound_source_type' => $sourceType,
                'previous_status' => $fromStatus,
                'status' => 'in_warehouse',
                'current_branch_id' => $branchId,
                'current_warehouse_id' => $warehouseId,
                'is_wrong_route' => $isWrongRoute,
                'routing_warning' => $routing['warning'],
                'expected_next_hop' => $routing['expected_next_hop'],
            ];
        }

        return $results;
    }

    /**
     * @param array<string, mixed> $originWarehouse
     * @param array<string, mixed> $destWarehouse
     * @param list<string> $trackingCodes
     * @return list<array<string, mixed>>
     */
    private function performBagPack(
        int $bagId,
        string $bagCode,
        array $originWarehouse,
        array $destWarehouse,
        array $trackingCodes,
        bool $strictRouting,
        int $userId,
    ): array {
        $originWhId = (int) $originWarehouse['id'];
        $originBranchId = (int) $originWarehouse['branch_id'];
        $destWhId = (int) $destWarehouse['id'];
        $results = [];

        foreach ($trackingCodes as $trackingCode) {
            $shipment = $this->repository->findShipmentByTrackingCode($trackingCode, true);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$trackingCode}.");
            }

            $shipmentId = (int) $shipment['id'];
            $fromStatus = (string) $shipment['status'];
            if (!in_array($fromStatus, self::PACKABLE_SHIPMENT_STATUSES, true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} đang ở trạng thái '{$fromStatus}', cần ở trạng thái in_warehouse/picked_up/pending_return trước khi đóng túi.",
                );
            }

            if ($shipment['current_warehouse_id'] !== null && (int) $shipment['current_warehouse_id'] !== $originWhId) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} hiện đang nằm ở kho ID {$shipment['current_warehouse_id']}, không thuộc kho đóng túi {$originWarehouse['code']}.",
                );
            }

            if ($this->repository->hasActiveShipmentInBag($bagId, $shipmentId)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} đã được quét vào túi {$bagCode}.",
                );
            }

            $routing = $this->evaluateRoute($originWhId, (int) $shipment['destination_branch_id'], $destWhId);
            $isWrongRoute = (bool) $routing['is_wrong_route'];
            if ($strictRouting && $isWrongRoute) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} sai tuyến đóng túi: {$routing['warning']}",
                );
            }

            $this->repository->insertBagItem($bagId, $shipmentId, $userId);
            $this->repository->updateShipmentWarehouseLocation(
                $shipmentId,
                $originBranchId,
                $originWhId,
                'bagged',
                $userId,
            );

            $desc = "Đóng vào túi hàng {$bagCode} hướng tới kho {$destWarehouse['name']}";
            if ($isWrongRoute && $routing['warning'] !== null) {
                $desc .= " [CẢNH BÁO SAI TUYẾN: {$routing['warning']}]";
            }

            $this->repository->insertShipmentStatusHistory(
                $shipmentId,
                $fromStatus,
                'bagged',
                $originBranchId,
                $originWhId,
                $userId,
                $desc,
            );

            $results[] = [
                'shipment_public_id' => $shipment['public_id'],
                'tracking_code' => $trackingCode,
                'previous_status' => $fromStatus,
                'status' => 'bagged',
                'is_wrong_route' => $isWrongRoute,
                'routing_warning' => $routing['warning'],
                'expected_next_hop' => $routing['expected_next_hop'],
            ];
        }

        return $results;
    }

    /**
     * @return array<string, mixed>
     */
    private function evaluateRoute(
        int $originWarehouseId,
        int $destinationBranchId,
        ?int $proposedNextHopWarehouseId,
    ): array {
        $originWarehouse = $this->repository->findWarehouseById($originWarehouseId);
        if ($originWarehouse === null) {
            throw new ApiException('404_NOT_FOUND', "Không tìm thấy kho ID {$originWarehouseId}.");
        }

        $destinationBranch = $this->repository->findBranchById($destinationBranchId);
        if ($destinationBranch === null) {
            throw new ApiException('404_NOT_FOUND', "Không tìm thấy chi nhánh đích ID {$destinationBranchId}.");
        }

        $rule = $this->repository->findRoutingRule($originWarehouseId, $destinationBranchId);
        $isAtDestinationBranch = ((int) $originWarehouse['branch_id'] === $destinationBranchId);

        $isWrongRoute = false;
        $warning = null;
        $expectedNextHop = null;

        if ($rule !== null) {
            $expectedWarehouseId = (int) $rule['next_hop_warehouse_id'];
            $expectedNextHop = [
                'warehouse_id' => $expectedWarehouseId,
                'warehouse_code' => $rule['next_hop_warehouse_code'],
                'warehouse_name' => $rule['next_hop_warehouse_name'],
                'transport_mode' => $rule['transport_mode'],
                'estimated_transit_hours' => (int) $rule['estimated_transit_hours'],
            ];

            if ($proposedNextHopWarehouseId !== null && $proposedNextHopWarehouseId !== $expectedWarehouseId) {
                $isWrongRoute = true;
                $warning = "Sai kho trung chuyển tiếp theo: theo định tuyến từ {$originWarehouse['code']} đi chi nhánh {$destinationBranch['code']} phải chuyển tới kho {$rule['next_hop_warehouse_code']} ({$rule['next_hop_warehouse_name']}), không phải kho ID {$proposedNextHopWarehouseId}.";
            }
        } elseif ($isAtDestinationBranch) {
            if ($proposedNextHopWarehouseId !== null && $proposedNextHopWarehouseId !== $originWarehouseId) {
                $isWrongRoute = true;
                $warning = "Kiện hàng đã nằm tại kho thuộc chi nhánh đích {$destinationBranch['code']}, không cần đóng túi chuyển tuyến sang kho ID {$proposedNextHopWarehouseId}.";
            }
        } else {
            $isWrongRoute = true;
            $warning = "Chưa có quy tắc định tuyến (branch_routing_rules) hợp lệ từ kho {$originWarehouse['code']} tới chi nhánh đích {$destinationBranch['code']}.";
        }

        return [
            'is_wrong_route' => $isWrongRoute,
            'is_at_destination_branch' => $isAtDestinationBranch,
            'warning' => $warning,
            'origin_warehouse' => [
                'id' => (int) $originWarehouse['id'],
                'code' => $originWarehouse['code'],
                'name' => $originWarehouse['name'],
                'branch_id' => (int) $originWarehouse['branch_id'],
            ],
            'destination_branch' => [
                'id' => (int) $destinationBranch['id'],
                'code' => $destinationBranch['code'],
                'name' => $destinationBranch['name'],
            ],
            'proposed_next_hop_warehouse_id' => $proposedNextHopWarehouseId,
            'expected_next_hop' => $expectedNextHop,
        ];
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<int, int>|null
     */
    private function resolveAllowedWarehouseIds(array $scopeContext): ?array
    {
        if (($scopeContext['scope_type'] ?? '') === 'hq_all' && ($scopeContext['active_branch_id'] ?? null) === null) {
            return null;
        }

        return array_map('intval', $scopeContext['allowed_warehouse_ids'] ?? []);
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    private function assertWarehouseInScope(int $warehouseId, array $scopeContext): array
    {
        $warehouse = $this->repository->findWarehouseById($warehouseId);
        if ($warehouse === null || (int) $warehouse['is_active'] !== 1) {
            throw new ApiException('404_NOT_FOUND', "Không tìm thấy kho hoạt động ID {$warehouseId}.");
        }

        $allowedWarehouseIds = $this->resolveAllowedWarehouseIds($scopeContext);
        if ($allowedWarehouseIds !== null && !in_array($warehouseId, $allowedWarehouseIds, true)) {
            throw new ApiException('403_BRANCH_SCOPE', 'Bạn không có quyền thao tác trên kho hàng này.');
        }

        return $warehouse;
    }

    /**
     * @param array<string, mixed> $bag
     * @param array<string, mixed> $scopeContext
     */
    private function assertBagAccessible(array $bag, array $scopeContext): void
    {
        $allowedWarehouseIds = $this->resolveAllowedWarehouseIds($scopeContext);
        if ($allowedWarehouseIds === null) {
            return;
        }

        $originId = (int) $bag['origin_warehouse_id'];
        $destId = (int) $bag['destination_warehouse_id'];
        if (!in_array($originId, $allowedWarehouseIds, true) && !in_array($destId, $allowedWarehouseIds, true)) {
            throw new ApiException('403_BRANCH_SCOPE', 'Bạn không có quyền xem túi hàng này.');
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatReceipt(array $row): array
    {
        return [
            'public_id' => $row['public_id'] ?? null,
            'receipt_code' => $row['receipt_code'] ?? null,
            'receipt_type' => $row['receipt_type'] ?? 'inbound',
            'warehouse_id' => isset($row['warehouse_id']) ? (int) $row['warehouse_id'] : null,
            'warehouse_code' => $row['warehouse_code'] ?? null,
            'warehouse_name' => $row['warehouse_name'] ?? null,
            'branch_id' => isset($row['branch_id']) ? (int) $row['branch_id'] : null,
            'branch_name' => $row['branch_name'] ?? null,
            'target_warehouse_id' => isset($row['target_warehouse_id']) && $row['target_warehouse_id'] !== null ? (int) $row['target_warehouse_id'] : null,
            'total_shipments' => (int) ($row['total_shipments'] ?? 0),
            'total_bags' => (int) ($row['total_bags'] ?? 0),
            'total_weight_gram' => (int) ($row['total_weight_gram'] ?? 0),
            'status' => $row['status'] ?? null,
            'note' => $row['note'] ?? null,
            'confirmed_at' => $row['confirmed_at'] ?? null,
            'confirmed_by_name' => $row['confirmed_by_name'] ?? null,
            'created_by_name' => $row['created_by_name'] ?? null,
            'version' => (int) ($row['version'] ?? 1),
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatBag(array $row): array
    {
        return [
            'public_id' => $row['public_id'] ?? null,
            'bag_code' => $row['bag_code'] ?? null,
            'seal_number' => $row['seal_number'] ?? null,
            'origin_warehouse_id' => isset($row['origin_warehouse_id']) ? (int) $row['origin_warehouse_id'] : null,
            'origin_warehouse_code' => $row['origin_warehouse_code'] ?? null,
            'origin_warehouse_name' => $row['origin_warehouse_name'] ?? null,
            'destination_warehouse_id' => isset($row['destination_warehouse_id']) ? (int) $row['destination_warehouse_id'] : null,
            'destination_warehouse_code' => $row['destination_warehouse_code'] ?? null,
            'destination_warehouse_name' => $row['destination_warehouse_name'] ?? null,
            'shipment_count' => (int) ($row['shipment_count'] ?? 0),
            'total_weight_gram' => (int) ($row['total_weight_gram'] ?? 0),
            'status' => $row['status'] ?? null,
            'sealed_at' => $row['sealed_at'] ?? null,
            'sealed_by_name' => $row['sealed_by_name'] ?? null,
            'opened_at' => $row['opened_at'] ?? null,
            'opened_by_name' => $row['opened_by_name'] ?? null,
            'version' => (int) ($row['version'] ?? 1),
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    private function generateCode(string $prefix): string
    {
        return $prefix . '-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    }

    private function generateUlid(): string
    {
        $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
        $timeMs = (int) floor(microtime(true) * 1000);
        $timeChars = '';
        for ($i = 9; $i >= 0; $i--) {
            $timeChars = $alphabet[$timeMs % 32] . $timeChars;
            $timeMs = intdiv($timeMs, 32);
        }

        $randBytes = random_bytes(10);
        $randChars = '';
        for ($i = 0; $i < 16; $i++) {
            $byte = ord($randBytes[$i % 10]);
            $randChars .= $alphabet[($byte + $i * 7) & 31];
        }

        return $timeChars . $randChars;
    }
}