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
    private const DELIVERY_ELIGIBLE_STATUSES = ['in_warehouse', 'delivery_failed'];

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

        $result = $this->repository->paginateReceipts($filters, $allowedWarehouseIds);
        $items = array_map(fn (array $row): array => $this->formatReceipt($row), $result['items']);

        return [
            'items' => $items,
            'total' => $result['total'],
        ];
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
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu kho.');
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
     * @param array{unlock_reason: string, version: int} $payload
     * @param array<string, mixed> $scopeContext
     * @param array<string, mixed> $auth
     * @return array<string, mixed>
     */
    public function unlockReceipt(
        string $publicId,
        array $payload,
        array $scopeContext,
        array $auth,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        $isPureHq = ($scopeContext['scope_type'] ?? '') === 'hq_all'
            && ($scopeContext['active_branch_id'] ?? null) === null;
        $roles = is_array($auth['roles'] ?? null) ? $auth['roles'] : [];

        if ($isPureHq || !in_array('branch_manager', $roles, true)) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Chỉ Trưởng chi nhánh đang thao tác trong phạm vi chi nhánh mới có quyền mở khóa phiếu xuất.',
            );
        }

        $userId = (int) ($auth['user_id'] ?? 0);

        return Database::transaction(function () use ($publicId, $payload, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu kho.');
            }

            $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);

            if (!in_array((string) $receipt['receipt_type'], ['outbound_linehaul', 'outbound_delivery'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Chỉ hỗ trợ mở khóa cho phiếu xuất kho trung chuyển hoặc xuất kho giao hàng.',
                );
            }

            if ((int) $receipt['version'] !== $payload['version']) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Phiếu kho đã được cập nhật bởi người dùng khác. Vui lòng tải lại dữ liệu mới nhất.',
                );
            }

            if ((string) $receipt['status'] !== 'confirmed') {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Chỉ có thể mở khóa phiếu ở trạng thái 'confirmed' (hiện tại: '{$receipt['status']}').",
                );
            }

            if ($receipt['handed_over_at'] !== null) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Phiếu xuất kho đã bàn giao thực tế, không thể mở khóa.',
                );
            }

            $receiptId = (int) $receipt['id'];
            $this->repository->unlockReceipt($receiptId, $userId, $payload['unlock_reason']);

            $updated = $this->repository->findReceiptByPublicId($publicId, false);
            $items = $this->repository->listReceiptItems($receiptId);

            $this->repository->insertAuditLog(
                $userId,
                (int) $receipt['branch_id'],
                'unlock_warehouse_receipt',
                'warehouse_receipts',
                $receiptId,
                ['status' => 'confirmed', 'version' => (int) $receipt['version']],
                [
                    'status' => 'unlocked',
                    'unlock_reason' => $payload['unlock_reason'],
                    'version' => (int) ($updated['version'] ?? 0),
                ],
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
     * @param array{warehouse_id: ?int} $query
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function getOutboundDeliveryBootstrap(array $query, array $scopeContext): array
    {
        if ($query['warehouse_id'] !== null) {
            $warehouse = $this->assertWarehouseInScope((int) $query['warehouse_id'], $scopeContext);
        } else {
            $allowedIds = $this->resolveAllowedWarehouseIds($scopeContext);
            $warehouse = $this->repository->findFirstWarehouseInScope($allowedIds);
            if ($warehouse === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy kho hàng thuộc phạm vi làm việc của bạn.');
            }
        }

        $warehouseId = (int) $warehouse['id'];
        $branchId = (int) $warehouse['branch_id'];

        $driversRaw = $this->repository->listDriversByBranch($branchId);
        $drivers = array_map(static fn (array $d): array => [
            'id' => (int) $d['id'],
            'public_id' => $d['public_id'],
            'employee_code' => $d['employee_code'] ?? '',
            'full_name' => $d['full_name'],
            'phone_masked' => $d['phone_masked'],
            'branch_id' => (int) $d['branch_id'],
            'vehicle_plate' => $d['vehicle_plate'] ?? null,
            'active_delivery_count' => (int) ($d['active_delivery_count'] ?? 0),
            'is_active' => (int) ($d['is_active'] ?? 1) === 1,
        ], $driversRaw);

        $availableRaw = $this->repository->listAvailableDeliveryShipments($warehouseId);
        $availableShipments = array_map(static fn (array $s): array => [
            'shipment_id' => (int) $s['shipment_id'],
            'shipment_public_id' => $s['shipment_public_id'],
            'tracking_code' => $s['tracking_code'],
            'status' => $s['status'],
            'current_branch_id' => (int) $s['current_branch_id'],
            'current_warehouse_id' => (int) $s['current_warehouse_id'],
            'destination_branch_id' => (int) $s['destination_branch_id'],
            'recipient_name' => $s['recipient_name'],
            'recipient_phone_masked' => $s['recipient_phone_masked'],
            'recipient_address' => $s['recipient_address'],
            'chargeable_weight_gram' => (int) $s['chargeable_weight_gram'],
            'parcel_count' => (int) $s['parcel_count'],
            'cod_amount' => (float) $s['cod_amount'],
        ], $availableRaw);

        $activeDraftRow = $this->repository->findActiveDeliveryDraftByWarehouse($warehouseId);
        $activeDraft = $activeDraftRow !== null
            ? $this->buildOutboundDeliveryReceiptPayload($activeDraftRow, true)
            : null;

        $recentRows = $this->repository->listRecentConfirmedDeliveryReceipts($warehouseId, 10);
        $recentConfirmed = array_map(
            fn (array $row): array => $this->buildOutboundDeliveryReceiptPayload($row, false),
            $recentRows,
        );

        return [
            'warehouse' => [
                'id' => $warehouseId,
                'code' => $warehouse['code'],
                'name' => $warehouse['name'],
                'branch_id' => $branchId,
                'branch_name' => $warehouse['branch_name'],
            ],
            'drivers' => $drivers,
            'available_shipments' => $availableShipments,
            'active_draft' => $activeDraft,
            'recent_confirmed' => $recentConfirmed,
        ];
    }

    /**
     * @param array{warehouse_id: int, driver_id: int, vehicle_id: ?int, note: ?string, tracking_codes: list<string>} $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createOutboundDelivery(
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        $warehouse = $this->assertWarehouseInScope($payload['warehouse_id'], $scopeContext);
        $branchId = (int) $warehouse['branch_id'];

        $driver = $this->repository->findDriverInBranch($payload['driver_id'], $branchId);
        if ($driver === null) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Tài xế được chọn không tồn tại, đã khóa hoặc không thuộc chi nhánh của kho xuất.',
            );
        }

        return Database::transaction(function () use ($payload, $warehouse, $driver, $userId, $ipAddress, $userAgent): array {
            $publicId = $this->generateUlid();
            $receiptCode = $this->generateCode('WHOD');

            $receiptId = $this->repository->insertReceipt([
                'public_id' => $publicId,
                'receipt_code' => $receiptCode,
                'receipt_type' => 'outbound_delivery',
                'warehouse_id' => (int) $warehouse['id'],
                'target_warehouse_id' => null,
                'driver_id' => (int) $driver['id'],
                'vehicle_id' => $payload['vehicle_id'],
                'status' => 'draft',
                'note' => $payload['note'],
                'created_by' => $userId,
            ]);

            if ($payload['tracking_codes'] !== []) {
                $this->performOutboundDeliveryScan($receiptId, $receiptCode, $warehouse, $payload['tracking_codes'], $userId);
                $this->repository->recalculateReceiptTotals($receiptId, $userId);
            }

            $receiptRow = $this->repository->findReceiptByPublicId($publicId, false);
            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'create_outbound_delivery',
                'warehouse_receipts',
                $receiptId,
                null,
                [
                    'receipt_code' => $receiptCode,
                    'warehouse_id' => (int) $warehouse['id'],
                    'driver_id' => (int) $driver['id'],
                ],
                $ipAddress,
                $userAgent,
            );

            return $this->buildOutboundDeliveryReceiptPayload($receiptRow ?? [], true);
        });
    }

    /**
     * @param list<string> $trackingCodes
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function scanOutboundDelivery(
        string $publicId,
        array $trackingCodes,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $trackingCodes, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null || (string) $receipt['receipt_type'] !== 'outbound_delivery') {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu xuất kho giao hàng.');
            }

            if (!in_array((string) $receipt['status'], ['draft', 'unlocked'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Phiếu xuất giao hàng đang ở trạng thái '{$receipt['status']}', không thể quét thêm vận đơn.",
                );
            }

            $warehouse = $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);
            $receiptId = (int) $receipt['id'];

            $this->performOutboundDeliveryScan(
                $receiptId,
                (string) $receipt['receipt_code'],
                $warehouse,
                $trackingCodes,
                $userId,
            );
            $this->repository->recalculateReceiptTotals($receiptId, $userId);
            $this->repository->bumpReceiptVersion($receiptId, $userId);

            $updated = $this->repository->findReceiptByPublicId($publicId, false);
            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'scan_outbound_delivery',
                'warehouse_receipts',
                $receiptId,
                ['total_shipments' => (int) $receipt['total_shipments']],
                ['total_shipments' => (int) ($updated['total_shipments'] ?? 0), 'tracking_codes' => $trackingCodes],
                $ipAddress,
                $userAgent,
            );

            return $this->buildOutboundDeliveryReceiptPayload($updated ?? [], true);
        });
    }

    /**
     * @param array{item_id: ?int, tracking_code: ?string, remove_reason: string, version: int} $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function removeOutboundDeliveryItem(
        string $publicId,
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $payload, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null || (string) $receipt['receipt_type'] !== 'outbound_delivery') {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu xuất kho giao hàng.');
            }

            $warehouse = $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);

            if ((int) $receipt['version'] !== $payload['version']) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Phiếu xuất giao hàng đã được cập nhật bởi người dùng khác. Vui lòng tải lại dữ liệu mới nhất.',
                );
            }

            if (!in_array((string) $receipt['status'], ['draft', 'unlocked'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Phiếu xuất giao hàng đang ở trạng thái '{$receipt['status']}', không thể gỡ vận đơn.",
                );
            }

            $receiptId = (int) $receipt['id'];
            $item = $this->repository->findActiveReceiptItem($receiptId, $payload['item_id'], $payload['tracking_code']);
            if ($item === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn cần gỡ trong phiếu xuất giao hàng.');
            }

            $this->repository->removeReceiptItem((int) $item['id'], $userId, $payload['remove_reason']);
            $this->repository->recalculateReceiptTotals($receiptId, $userId);
            $this->repository->bumpReceiptVersion($receiptId, $userId);

            $updated = $this->repository->findReceiptByPublicId($publicId, false);
            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'remove_outbound_delivery_item',
                'warehouse_receipts',
                $receiptId,
                ['removed_tracking_code' => $item['tracking_code'], 'version' => (int) $receipt['version']],
                [
                    'removed_tracking_code' => $item['tracking_code'],
                    'remove_reason' => $payload['remove_reason'],
                    'version' => (int) ($updated['version'] ?? 0),
                ],
                $ipAddress,
                $userAgent,
            );

            return $this->buildOutboundDeliveryReceiptPayload($updated ?? [], true);
        });
    }

    /**
     * @param array{version: ?int, note: ?string} $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function confirmOutboundDelivery(
        string $publicId,
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $payload, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null || (string) $receipt['receipt_type'] !== 'outbound_delivery') {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu xuất kho giao hàng.');
            }

            $warehouse = $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);

            if ($payload['version'] !== null && (int) $receipt['version'] !== (int) $payload['version']) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Phiếu xuất giao hàng đã được cập nhật bởi người dùng khác. Vui lòng tải lại dữ liệu mới nhất.',
                );
            }

            if (!in_array((string) $receipt['status'], ['draft', 'unlocked'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Không thể chốt phiếu xuất giao hàng ở trạng thái '{$receipt['status']}'.",
                );
            }

            $driverId = isset($receipt['driver_id']) && $receipt['driver_id'] !== null ? (int) $receipt['driver_id'] : 0;
            if ($driverId < 1) {
                throw new ApiException('422_VALIDATION_ERROR', 'Phiếu xuất giao hàng chưa gán tài xế giao hàng.');
            }

            $receiptId = (int) $receipt['id'];
            $activeItems = $this->repository->listReceiptItems($receiptId, false);
            if ($activeItems === []) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Phiếu xuất giao hàng chưa có vận đơn nào để chốt xuất kho.',
                );
            }

            $warehouseId = (int) $warehouse['id'];
            $branchId = (int) $warehouse['branch_id'];
            $driverName = (string) ($receipt['driver_name'] ?? "ID {$driverId}");

            foreach ($activeItems as $item) {
                $trackingCode = (string) ($item['tracking_code'] ?? '');
                $shipment = $this->repository->findShipmentByTrackingCode($trackingCode, true);
                if ($shipment === null) {
                    throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$trackingCode}.");
                }

                $fromStatus = (string) $shipment['status'];
                if (!in_array($fromStatus, self::DELIVERY_ELIGIBLE_STATUSES, true)) {
                    throw new ApiException(
                        '422_VALIDATION_ERROR',
                        "Vận đơn {$trackingCode} đã chuyển sang trạng thái '{$fromStatus}', không thể chốt xuất giao.",
                    );
                }

                if ((int) ($shipment['current_warehouse_id'] ?? 0) !== $warehouseId) {
                    throw new ApiException(
                        '422_VALIDATION_ERROR',
                        "Vận đơn {$trackingCode} không còn nằm tại kho {$warehouse['code']}.",
                    );
                }

                $this->repository->assignShipmentOutForDelivery(
                    (int) $shipment['id'],
                    $driverId,
                    $branchId,
                    $warehouseId,
                    $userId,
                );

                $this->repository->insertShipmentStatusHistory(
                    (int) $shipment['id'],
                    $fromStatus,
                    'out_for_delivery',
                    $branchId,
                    $warehouseId,
                    $userId,
                    "Xuất kho giao hàng ({$receipt['receipt_code']}) bàn giao cho tài xế {$driverName}",
                );
            }

            $this->repository->recalculateReceiptTotals($receiptId, $userId);
            $this->repository->confirmReceipt($receiptId, $userId, $payload['note']);

            $updated = $this->repository->findReceiptByPublicId($publicId, false);
            $this->repository->insertAuditLog(
                $userId,
                $branchId,
                'confirm_outbound_delivery',
                'warehouse_receipts',
                $receiptId,
                ['status' => $receipt['status'], 'version' => (int) $receipt['version']],
                [
                    'status' => 'confirmed',
                    'driver_id' => $driverId,
                    'total_shipments' => count($activeItems),
                    'version' => (int) ($updated['version'] ?? 0),
                ],
                $ipAddress,
                $userAgent,
            );

            return $this->buildOutboundDeliveryReceiptPayload($updated ?? [], true);
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function getOutboundLinehaulDataset(array $scopeContext): array
    {
        $allowedWhIds = $this->resolveAllowedWarehouseIds($scopeContext);
        $allowedBranchIds = $this->resolveAllowedBranchIds($scopeContext);

        $warehousesRaw = $this->repository->listActiveWarehouses($allowedWhIds);
        $warehouses = array_map(static fn (array $w): array => [
            'id' => (int) $w['id'],
            'code' => $w['code'],
            'name' => $w['name'],
        ], $warehousesRaw);

        $vehiclesRaw = $this->repository->listVehicles($allowedBranchIds);
        $vehicles = array_map(static fn (array $v): array => [
            'id' => (int) $v['id'],
            'plate_number' => $v['plate_number'],
            'vehicle_type' => $v['vehicle_type'],
            'max_payload_kg' => (string) $v['max_payload_kg'],
            'status' => $v['status'],
        ], $vehiclesRaw);

        $partnersRaw = $this->repository->listActivePartners();
        $partners = array_map(static fn (array $p): array => [
            'id' => (int) $p['id'],
            'code' => $p['code'],
            'name' => $p['name'],
            'partner_type' => $p['partner_type'],
            'is_active' => (int) $p['is_active'],
        ], $partnersRaw);

        $shipmentsRaw = $this->repository->listLinehaulShipmentFixtures($allowedWhIds);
        $shipments = array_map(static fn (array $s): array => [
            'tracking_code' => $s['tracking_code'],
            'status' => $s['status'],
            'current_warehouse_id' => (int) ($s['current_warehouse_id'] ?? 0),
            'destination_branch_id' => (int) $s['destination_branch_id'],
            'chargeable_weight_gram' => (int) $s['chargeable_weight_gram'],
        ], $shipmentsRaw);

        $bagsRaw = $this->repository->listSealedBagFixtures($allowedWhIds);
        $sealedBags = array_map(static fn (array $b): array => [
            'seal_number' => (string) ($b['seal_number'] ?? $b['bag_code']),
            'origin_warehouse_id' => (int) $b['origin_warehouse_id'],
            'destination_warehouse_id' => (int) $b['destination_warehouse_id'],
            'chargeable_weight_gram' => (int) $b['total_weight_gram'],
            'is_sealed' => in_array((string) $b['status'], ['sealed', 'in_transit'], true),
        ], $bagsRaw);

        $rulesRaw = $this->repository->listRoutingRules(null, null);
        $routingRules = array_map(static fn (array $r): array => [
            'origin_warehouse_id' => (int) $r['origin_warehouse_id'],
            'destination_branch_id' => (int) $r['destination_branch_id'],
            'next_hop_warehouse_id' => (int) $r['next_hop_warehouse_id'],
            'is_active' => (int) ($r['is_active'] ?? 1),
        ], $rulesRaw);

        return [
            'warehouses' => $warehouses,
            'vehicles' => $vehicles,
            'partners' => $partners,
            'shipments' => $shipments,
            'sealed_bags' => $sealedBags,
            'routing_rules' => $routingRules,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createOutboundLinehaul(
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        $warehouse = $this->assertWarehouseInScope((int) $payload['warehouse_id'], $scopeContext);

        $targetWarehouseId = $payload['target_warehouse_id'];
        if ($targetWarehouseId !== null) {
            $targetWh = $this->repository->findWarehouseById((int) $targetWarehouseId);
            if ($targetWh === null || (int) $targetWh['is_active'] !== 1) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy kho đích trung chuyển.');
            }
        }

        if ($payload['transport_mode'] === 'vehicle') {
            $vehicle = $this->repository->findVehicleById((int) $payload['vehicle_id']);
            if ($vehicle === null || (string) $vehicle['status'] === 'retired') {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phương tiện vận chuyển hợp lệ.');
            }
        } else {
            $partner = $this->repository->findPartnerById((int) $payload['partner_id']);
            if ($partner === null || (int) $partner['is_active'] !== 1) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy đối tác vận chuyển trung chuyển hợp lệ.');
            }
        }

        return Database::transaction(function () use ($payload, $warehouse, $userId, $ipAddress, $userAgent): array {
            $publicId = $this->generateUlid();
            $receiptCode = $this->generateCode('WHLH');

            $receiptId = $this->repository->insertReceipt([
                'public_id' => $publicId,
                'receipt_code' => $receiptCode,
                'receipt_type' => 'outbound_linehaul',
                'warehouse_id' => (int) $warehouse['id'],
                'target_warehouse_id' => $payload['target_warehouse_id'],
                'driver_id' => null,
                'vehicle_id' => $payload['transport_mode'] === 'vehicle' ? $payload['vehicle_id'] : null,
                'partner_id' => $payload['transport_mode'] === 'partner' ? $payload['partner_id'] : null,
                'status' => 'draft',
                'note' => $payload['note'],
                'created_by' => $userId,
            ]);

            if ($payload['items'] !== []) {
                $this->performOutboundLinehaulScan($receiptId, $receiptCode, $warehouse, $payload['items'], $userId);
                $this->repository->recalculateReceiptTotals($receiptId, $userId);
            }

            $receipt = $this->repository->findReceiptByPublicId($publicId, false);
            $items = $this->repository->listReceiptItems($receiptId);

            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'create_outbound_linehaul',
                'warehouse_receipts',
                $receiptId,
                null,
                [
                    'receipt_code' => $receiptCode,
                    'transport_mode' => $payload['transport_mode'],
                    'warehouse_id' => (int) $warehouse['id'],
                ],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatReceipt($receipt ?? []),
                'transport_mode' => $payload['transport_mode'],
                'items' => $items,
            ];
        });
    }

    /**
     * @param list<array{item_type: string, code: string}> $scanItems
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function scanOutboundLinehaul(
        string $publicId,
        array $scanItems,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $scanItems, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null || (string) $receipt['receipt_type'] !== 'outbound_linehaul') {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu xuất kho trung chuyển.');
            }

            if (!in_array((string) $receipt['status'], ['draft', 'unlocked'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Phiếu xuất trung chuyển đang ở trạng thái '{$receipt['status']}', không thể quét thêm.",
                );
            }

            $warehouse = $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);
            $receiptId = (int) $receipt['id'];

            $this->performOutboundLinehaulScan($receiptId, (string) $receipt['receipt_code'], $warehouse, $scanItems, $userId);
            $this->repository->recalculateReceiptTotals($receiptId, $userId);
            $this->repository->bumpReceiptVersion($receiptId, $userId);

            $updated = $this->repository->findReceiptByPublicId($publicId, false);
            $items = $this->repository->listReceiptItems($receiptId);

            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'scan_outbound_linehaul',
                'warehouse_receipts',
                $receiptId,
                ['version' => (int) $receipt['version']],
                ['version' => (int) ($updated['version'] ?? 0), 'scanned_count' => count($scanItems)],
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
     * @param array{version: ?int, note: ?string} $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function confirmOutboundLinehaul(
        string $publicId,
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($publicId, $payload, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $receipt = $this->repository->findReceiptByPublicId($publicId, true);
            if ($receipt === null || (string) $receipt['receipt_type'] !== 'outbound_linehaul') {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiếu xuất kho trung chuyển.');
            }

            $warehouse = $this->assertWarehouseInScope((int) $receipt['warehouse_id'], $scopeContext);

            if ($payload['version'] !== null && (int) $receipt['version'] !== (int) $payload['version']) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Phiếu xuất trung chuyển đã được cập nhật bởi người dùng khác.',
                );
            }

            if (!in_array((string) $receipt['status'], ['draft', 'unlocked'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Không thể chốt phiếu xuất trung chuyển ở trạng thái '{$receipt['status']}'.",
                );
            }

            $receiptId = (int) $receipt['id'];
            $activeItems = $this->repository->listReceiptItems($receiptId, false);
            if ($activeItems === []) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Phiếu xuất trung chuyển chưa có vận đơn hoặc túi Seal nào để chốt.',
                );
            }

            $warehouseId = (int) $warehouse['id'];
            $branchId = (int) $warehouse['branch_id'];

            foreach ($activeItems as $item) {
                if ($item['shipment_id'] !== null && !empty($item['tracking_code'])) {
                    $shipment = $this->repository->findShipmentByTrackingCode((string) $item['tracking_code'], true);
                    if ($shipment !== null) {
                        $fromStatus = (string) $shipment['status'];
                        $this->repository->updateShipmentWarehouseLocation(
                            (int) $shipment['id'],
                            $branchId,
                            null,
                            'in_transit',
                            $userId,
                        );
                        $this->repository->insertShipmentStatusHistory(
                            (int) $shipment['id'],
                            $fromStatus,
                            'in_transit',
                            $branchId,
                            $warehouseId,
                            $userId,
                            "Xuất kho trung chuyển ({$receipt['receipt_code']}) từ kho {$warehouse['code']}",
                        );
                    }
                } elseif ($item['bag_id'] !== null) {
                    $bagId = (int) $item['bag_id'];
                    $this->repository->markBagInTransit($bagId, $userId);
                    foreach ($this->repository->listBagItems($bagId, true) as $bagShipment) {
                        $sId = (int) $bagShipment['shipment_id'];
                        $fromStatus = (string) $bagShipment['shipment_status'];
                        $this->repository->updateShipmentWarehouseLocation(
                            $sId,
                            $branchId,
                            null,
                            'in_transit',
                            $userId,
                        );
                        $this->repository->insertShipmentStatusHistory(
                            $sId,
                            $fromStatus,
                            'in_transit',
                            $branchId,
                            $warehouseId,
                            $userId,
                            "Túi Seal {$item['bag_code']} xuất trung chuyển theo phiếu {$receipt['receipt_code']}",
                        );
                    }
                }
            }

            $this->repository->recalculateReceiptTotals($receiptId, $userId);
            $this->repository->confirmReceipt($receiptId, $userId, $payload['note']);
            $updated = $this->repository->findReceiptByPublicId($publicId, false);
            $items = $this->repository->listReceiptItems($receiptId);

            $this->repository->insertAuditLog(
                $userId,
                $branchId,
                'confirm_outbound_linehaul',
                'warehouse_receipts',
                $receiptId,
                ['status' => $receipt['status'], 'version' => (int) $receipt['version']],
                [
                    'status' => 'confirmed',
                    'total_shipments' => (int) ($updated['total_shipments'] ?? 0),
                    'total_bags' => (int) ($updated['total_bags'] ?? 0),
                    'version' => (int) ($updated['version'] ?? 0),
                ],
                $ipAddress,
                $userAgent,
            );

            return [
                ...$this->formatReceipt($updated ?? []),
                'confirmed_at' => $updated['confirmed_at'] ?? date('c'),
                'item_count' => count($items),
                'items' => $items,
            ];
        });
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function listStockAudits(array $filters, array $scopeContext): array
    {
        $allowedWhIds = $this->resolveAllowedWarehouseIds($scopeContext);
        if ($filters['warehouse_id'] !== null) {
            $this->assertWarehouseInScope((int) $filters['warehouse_id'], $scopeContext);
        }

        $res = $this->repository->paginateStockAudits($filters, $allowedWhIds);
        $items = array_map(fn (array $row): array => $this->formatStockAudit($row, []), $res['items']);

        return [
            'items' => $items,
            'total' => $res['total'],
        ];
    }

    /**
     * @param array{warehouse_id: int, note: ?string, tracking_codes: list<string>} $payload
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createStockAudit(
        array $payload,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        $warehouse = $this->assertWarehouseInScope($payload['warehouse_id'], $scopeContext);
        $warehouseId = (int) $warehouse['id'];
        $branchId = (int) $warehouse['branch_id'];

        return Database::transaction(function () use ($payload, $warehouseId, $branchId, $userId, $ipAddress, $userAgent): array {
            $auditCode = $this->generateCode('AUD');
            $expectedShipments = $this->repository->listExpectedWarehouseShipmentsForAudit($warehouseId);

            $auditId = $this->repository->insertStockAudit(
                $auditCode,
                $warehouseId,
                $userId,
                count($expectedShipments),
                $payload['note'],
            );

            $expectedMap = [];
            foreach ($expectedShipments as $exp) {
                $sId = (int) $exp['id'];
                $expectedMap[$sId] = true;
                $overdue = $this->isShipmentOverdue($exp);
                $this->repository->insertStockAuditItem(
                    $auditId,
                    $sId,
                    (string) $exp['status'],
                    $overdue ? 'overdue_storage' : 'missing',
                    $overdue,
                    null,
                    $overdue ? 'Quá hạn lưu kho chờ xử lý hoàn/nhắc.' : null,
                );
            }

            foreach ($payload['tracking_codes'] as $code) {
                $shipment = $this->repository->findShipmentByTrackingCode($code, false);
                if ($shipment === null) {
                    throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$code}.");
                }
                $sId = (int) $shipment['id'];
                $eval = $this->evaluateAuditScanResult($shipment, $warehouseId, $branchId);
                $existing = $this->repository->findStockAuditItemByShipment($auditId, $sId);
                if ($existing !== null) {
                    $this->repository->updateStockAuditItemScan(
                        (int) $existing['id'],
                        (string) $shipment['status'],
                        $eval['scan_result'],
                        $eval['propose_return'],
                        $eval['note'],
                    );
                } else {
                    $this->repository->insertStockAuditItem(
                        $auditId,
                        $sId,
                        (string) $shipment['status'],
                        $eval['scan_result'],
                        $eval['propose_return'],
                        'NOW()',
                        $eval['note'],
                    );
                }
            }

            $this->repository->recalculateStockAuditSummary($auditId);
            $auditRow = $this->repository->findStockAuditByIdentifier((string) $auditId, false);
            $auditItems = $this->repository->listStockAuditItems($auditId);

            $this->repository->insertAuditLog(
                $userId,
                $branchId,
                'create_stock_audit',
                'warehouse_stock_audits',
                $auditId,
                null,
                ['audit_code' => $auditCode, 'warehouse_id' => $warehouseId],
                $ipAddress,
                $userAgent,
            );

            return $this->formatStockAudit($auditRow ?? [], $auditItems);
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function showStockAudit(string $identifier, array $scopeContext): array
    {
        $audit = $this->repository->findStockAuditByIdentifier($identifier, false);
        if ($audit === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiên kiểm kê kho.');
        }

        $this->assertWarehouseInScope((int) $audit['warehouse_id'], $scopeContext);
        $items = $this->repository->listStockAuditItems((int) $audit['id']);

        return $this->formatStockAudit($audit, $items);
    }

    /**
     * @param list<string> $trackingCodes
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function scanStockAudit(
        string $identifier,
        array $trackingCodes,
        ?string $note,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($identifier, $trackingCodes, $note, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $audit = $this->repository->findStockAuditByIdentifier($identifier, true);
            if ($audit === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiên kiểm kê kho.');
            }

            if ((string) $audit['status'] !== 'in_progress') {
                throw new ApiException('422_VALIDATION_ERROR', 'Phiên kiểm kê đã hoàn tất, không thể quét thêm.');
            }

            $warehouse = $this->assertWarehouseInScope((int) $audit['warehouse_id'], $scopeContext);
            $warehouseId = (int) $warehouse['id'];
            $branchId = (int) $warehouse['branch_id'];
            $auditId = (int) $audit['id'];

            foreach ($trackingCodes as $code) {
                $shipment = $this->repository->findShipmentByTrackingCode($code, false);
                if ($shipment === null) {
                    throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$code}.");
                }

                $sId = (int) $shipment['id'];
                $eval = $this->evaluateAuditScanResult($shipment, $warehouseId, $branchId);
                $itemNote = $note ?? $eval['note'];

                $existing = $this->repository->findStockAuditItemByShipment($auditId, $sId);
                if ($existing !== null) {
                    $this->repository->updateStockAuditItemScan(
                        (int) $existing['id'],
                        (string) $shipment['status'],
                        $eval['scan_result'],
                        $eval['propose_return'],
                        $itemNote,
                    );
                } else {
                    $this->repository->insertStockAuditItem(
                        $auditId,
                        $sId,
                        (string) $shipment['status'],
                        $eval['scan_result'],
                        $eval['propose_return'],
                        'NOW()',
                        $itemNote,
                    );
                }
            }

            $this->repository->recalculateStockAuditSummary($auditId);
            $updated = $this->repository->findStockAuditByIdentifier((string) $auditId, false);
            $items = $this->repository->listStockAuditItems($auditId);

            $this->repository->insertAuditLog(
                $userId,
                $branchId,
                'scan_stock_audit',
                'warehouse_stock_audits',
                $auditId,
                null,
                ['tracking_codes' => $trackingCodes],
                $ipAddress,
                $userAgent,
            );

            return $this->formatStockAudit($updated ?? [], $items);
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function completeStockAudit(
        string $identifier,
        ?string $note,
        array $scopeContext,
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($identifier, $note, $scopeContext, $userId, $ipAddress, $userAgent): array {
            $audit = $this->repository->findStockAuditByIdentifier($identifier, true);
            if ($audit === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy phiên kiểm kê kho.');
            }

            $warehouse = $this->assertWarehouseInScope((int) $audit['warehouse_id'], $scopeContext);
            if ((string) $audit['status'] === 'completed') {
                throw new ApiException('422_VALIDATION_ERROR', 'Phiên kiểm kê này đã được chốt hoàn tất.');
            }

            $auditId = (int) $audit['id'];
            $this->repository->recalculateStockAuditSummary($auditId);
            $this->repository->completeStockAudit($auditId, $note);

            $updated = $this->repository->findStockAuditByIdentifier((string) $auditId, false);
            $items = $this->repository->listStockAuditItems($auditId);

            $this->repository->insertAuditLog(
                $userId,
                (int) $warehouse['branch_id'],
                'complete_stock_audit',
                'warehouse_stock_audits',
                $auditId,
                ['status' => $audit['status']],
                ['status' => 'completed'],
                $ipAddress,
                $userAgent,
            );

            return $this->formatStockAudit($updated ?? [], $items);
        });
    }

    /**
     * @param array<string, mixed> $shipment
     * @return array{scan_result: string, propose_return: bool, note: ?string}
     */
    private function evaluateAuditScanResult(array $shipment, int $warehouseId, int $branchId): array
    {
        $currentWhId = $shipment['current_warehouse_id'] !== null ? (int) $shipment['current_warehouse_id'] : null;
        $destBranchId = (int) $shipment['destination_branch_id'];

        if ($currentWhId !== $warehouseId) {
            return [
                'scan_result' => 'misrouted',
                'propose_return' => false,
                'note' => 'Kiện hàng quét được không thuộc tồn kho hiện tại của kho kiểm kê.',
            ];
        }

        if ($this->isShipmentOverdue($shipment)) {
            return [
                'scan_result' => 'overdue_storage',
                'propose_return' => true,
                'note' => 'Kiện hàng quá hạn lưu kho (storage_deadline), đề xuất hoàn/nhắc.',
            ];
        }

        $routing = $this->evaluateRoute($warehouseId, $destBranchId, null);
        if ((bool) $routing['is_wrong_route'] && $branchId !== $destBranchId) {
            return [
                'scan_result' => 'misrouted',
                'propose_return' => false,
                'note' => (string) ($routing['warning'] ?? 'Sai tuyến định tuyến'),
            ];
        }

        return [
            'scan_result' => 'matched',
            'propose_return' => false,
            'note' => null,
        ];
    }

    /**
     * @param array<string, mixed> $shipment
     */
    private function isShipmentOverdue(array $shipment): bool
    {
        if (!empty($shipment['storage_deadline'])) {
            $deadline = strtotime((string) $shipment['storage_deadline']);
            if ($deadline !== false && $deadline < time()) {
                return true;
            }
        }

        return (string) ($shipment['status'] ?? '') === 'pending_return';
    }

    /**
     * @param array<string, mixed> $row
     * @param list<array<string, mixed>> $items
     * @return array<string, mixed>
     */
    private function formatStockAudit(array $row, array $items): array
    {
        return [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'audit_code' => $row['audit_code'] ?? null,
            'warehouse_id' => isset($row['warehouse_id']) ? (int) $row['warehouse_id'] : null,
            'warehouse_code' => $row['warehouse_code'] ?? null,
            'warehouse_name' => $row['warehouse_name'] ?? null,
            'branch_id' => isset($row['branch_id']) ? (int) $row['branch_id'] : null,
            'branch_name' => $row['branch_name'] ?? null,
            'auditor_id' => isset($row['auditor_id']) ? (int) $row['auditor_id'] : null,
            'auditor_name' => $row['auditor_name'] ?? null,
            'total_expected_count' => (int) ($row['total_expected_count'] ?? 0),
            'total_scanned_count' => (int) ($row['total_scanned_count'] ?? 0),
            'missing_count' => (int) ($row['missing_count'] ?? 0),
            'overdue_return_count' => (int) ($row['overdue_return_count'] ?? 0),
            'status' => $row['status'] ?? 'in_progress',
            'completed_at' => $row['completed_at'] ?? null,
            'note' => $row['note'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'items' => $items,
        ];
    }

    /**
     * @param array<string, mixed> $warehouse
     * @param list<array{item_type: string, code: string}> $scanItems
     */
    private function performOutboundLinehaulScan(
        int $receiptId,
        string $receiptCode,
        array $warehouse,
        array $scanItems,
        int $userId,
    ): void {
        $warehouseId = (int) $warehouse['id'];
        $branchId = (int) $warehouse['branch_id'];

        foreach ($scanItems as $item) {
            $type = $item['item_type'];
            $code = $item['code'];

            if ($type === 'sealed_bag') {
                $bag = $this->repository->findBagBySealOrCode($code, true);
                if ($bag === null) {
                    throw new ApiException('404_NOT_FOUND', "Không tìm thấy túi hàng Seal {$code}.");
                }
                if (!in_array((string) $bag['status'], ['sealed', 'in_transit'], true)) {
                    throw new ApiException(
                        '422_VALIDATION_ERROR',
                        "Túi hàng {$code} chưa được niêm phong Seal (trạng thái hiện tại: '{$bag['status']}').",
                    );
                }
                if ((int) $bag['origin_warehouse_id'] !== $warehouseId) {
                    throw new ApiException(
                        '422_VALIDATION_ERROR',
                        "Túi hàng {$code} không xuất phát từ kho {$warehouse['code']}.",
                    );
                }
                $bagId = (int) $bag['id'];
                if ($this->repository->hasActiveBagInReceipt($receiptId, $bagId)) {
                    throw new ApiException('422_VALIDATION_ERROR', "Túi hàng {$code} đã có trong phiếu {$receiptCode}.");
                }
                $this->repository->insertReceiptItem($receiptId, null, null, false, $userId, $bagId);
            } else {
                $shipment = $this->repository->findShipmentByTrackingCode($code, true);
                if ($shipment === null) {
                    throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$code}.");
                }
                $shipmentId = (int) $shipment['id'];
                $status = (string) $shipment['status'];
                if (!in_array($status, self::PACKABLE_SHIPMENT_STATUSES, true)) {
                    throw new ApiException(
                        '422_VALIDATION_ERROR',
                        "Vận đơn {$code} đang ở trạng thái '{$status}', không thể xuất trung chuyển.",
                    );
                }
                if ($shipment['current_warehouse_id'] !== null && (int) $shipment['current_warehouse_id'] !== $warehouseId) {
                    throw new ApiException(
                        '422_VALIDATION_ERROR',
                        "Vận đơn {$code} không nằm tại kho {$warehouse['code']}.",
                    );
                }
                if ($this->repository->hasActiveShipmentInReceipt($receiptId, $shipmentId)) {
                    throw new ApiException('422_VALIDATION_ERROR', "Vận đơn {$code} đã có trong phiếu {$receiptCode}.");
                }

                $routing = $this->evaluateRoute($warehouseId, (int) $shipment['destination_branch_id'], null);
                $this->repository->insertReceiptItem(
                    $receiptId,
                    $shipmentId,
                    null,
                    (bool) $routing['is_wrong_route'],
                    $userId,
                    null,
                );
            }
        }
    }

    /**
     * @param array<string, mixed> $warehouse
     * @param list<string> $trackingCodes
     */
    private function performOutboundDeliveryScan(
        int $receiptId,
        string $receiptCode,
        array $warehouse,
        array $trackingCodes,
        int $userId,
    ): void {
        $warehouseId = (int) $warehouse['id'];
        $branchId = (int) $warehouse['branch_id'];

        foreach ($trackingCodes as $trackingCode) {
            $shipment = $this->repository->findShipmentByTrackingCode($trackingCode, true);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', "Không tìm thấy vận đơn {$trackingCode}.");
            }

            $shipmentId = (int) $shipment['id'];
            $status = (string) $shipment['status'];
            if (!in_array($status, self::DELIVERY_ELIGIBLE_STATUSES, true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} đang ở trạng thái '{$status}', chỉ nhận đơn ở trạng thái 'in_warehouse' hoặc 'delivery_failed'.",
                );
            }

            if ((int) ($shipment['current_warehouse_id'] ?? 0) !== $warehouseId) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} hiện không nằm tại kho {$warehouse['code']}.",
                );
            }

            if ($this->repository->hasActiveShipmentInReceipt($receiptId, $shipmentId)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} đã có trong phiếu xuất giao hàng {$receiptCode}.",
                );
            }

            if ($this->repository->hasActiveShipmentInOpenDeliveryReceipt($shipmentId)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    "Vận đơn {$trackingCode} đang nằm trong một phiếu xuất giao hàng nháp khác.",
                );
            }

            $isWrongRoute = ((int) $shipment['destination_branch_id'] !== $branchId);
            $this->repository->insertReceiptItem(
                $receiptId,
                $shipmentId,
                null,
                $isWrongRoute,
                $userId,
            );
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function buildOutboundDeliveryReceiptPayload(array $row, bool $includeRemoved): array
    {
        $receiptId = (int) ($row['id'] ?? 0);
        $rawItems = $receiptId > 0 ? $this->repository->listReceiptItems($receiptId, $includeRemoved) : [];
        $totalCod = $receiptId > 0 ? $this->repository->sumActiveReceiptCodAmount($receiptId) : 0.0;

        $items = array_map(static fn (array $item): array => [
            'id' => (int) $item['id'],
            'shipment_id' => (int) $item['shipment_id'],
            'shipment_public_id' => $item['shipment_public_id'],
            'tracking_code' => $item['tracking_code'],
            'shipment_status' => $item['shipment_status'],
            'recipient_name' => $item['recipient_name'] ?? '',
            'recipient_phone_masked' => $item['recipient_phone_masked'] ?? '',
            'recipient_address' => $item['recipient_address'] ?? '',
            'chargeable_weight_gram' => (int) ($item['chargeable_weight_gram'] ?? 0),
            'parcel_count' => (int) ($item['parcel_count'] ?? 1),
            'cod_amount' => (float) ($item['cod_amount'] ?? 0),
            'scanned_at' => $item['scanned_at'],
            'scanned_by_name' => $item['scanned_by_name'] ?? '',
            'removed_at' => $item['removed_at'] ?? null,
            'remove_reason' => $item['remove_reason'] ?? null,
            'removed_by_name' => $item['removed_by_name'] ?? null,
        ], $rawItems);

        return [
            'public_id' => $row['public_id'] ?? null,
            'receipt_code' => $row['receipt_code'] ?? null,
            'receipt_type' => 'outbound_delivery',
            'warehouse_id' => isset($row['warehouse_id']) ? (int) $row['warehouse_id'] : null,
            'warehouse_code' => $row['warehouse_code'] ?? null,
            'warehouse_name' => $row['warehouse_name'] ?? null,
            'branch_id' => isset($row['branch_id']) ? (int) $row['branch_id'] : null,
            'branch_name' => $row['branch_name'] ?? null,
            'driver_id' => isset($row['driver_id']) && $row['driver_id'] !== null ? (int) $row['driver_id'] : null,
            'driver_code' => $row['driver_code'] ?? '',
            'driver_name' => $row['driver_name'] ?? '',
            'driver_phone_masked' => $row['driver_phone_masked'] ?? '',
            'total_shipments' => (int) ($row['total_shipments'] ?? 0),
            'total_weight_gram' => (int) ($row['total_weight_gram'] ?? 0),
            'total_cod_amount' => $totalCod,
            'status' => $row['status'] ?? null,
            'note' => $row['note'] ?? null,
            'confirmed_at' => $row['confirmed_at'] ?? null,
            'confirmed_by_name' => $row['confirmed_by_name'] ?? null,
            'created_by_name' => $row['created_by_name'] ?? '',
            'version' => (int) ($row['version'] ?? 1),
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'items' => $items,
        ];
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
     * @return array<int, int>|null
     */
    private function resolveAllowedBranchIds(array $scopeContext): ?array
    {
        if (($scopeContext['scope_type'] ?? '') === 'hq_all' && ($scopeContext['active_branch_id'] ?? null) === null) {
            return null;
        }

        return array_map('intval', $scopeContext['allowed_branch_ids'] ?? []);
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
            'target_warehouse_code' => $row['target_warehouse_code'] ?? null,
            'target_warehouse_name' => $row['target_warehouse_name'] ?? null,
            'driver_id' => isset($row['driver_id']) && $row['driver_id'] !== null ? (int) $row['driver_id'] : null,
            'driver_name' => $row['driver_name'] ?? null,
            'vehicle_id' => isset($row['vehicle_id']) && $row['vehicle_id'] !== null ? (int) $row['vehicle_id'] : null,
            'partner_id' => isset($row['partner_id']) && $row['partner_id'] !== null ? (int) $row['partner_id'] : null,
            'total_shipments' => (int) ($row['total_shipments'] ?? 0),
            'total_bags' => (int) ($row['total_bags'] ?? 0),
            'total_weight_gram' => (int) ($row['total_weight_gram'] ?? 0),
            'status' => $row['status'] ?? null,
            'note' => $row['note'] ?? null,
            'confirmed_at' => $row['confirmed_at'] ?? null,
            'confirmed_by_name' => $row['confirmed_by_name'] ?? null,
            'unlocked_at' => $row['unlocked_at'] ?? null,
            'unlocked_by_name' => $row['unlocked_by_name'] ?? null,
            'unlock_reason' => $row['unlock_reason'] ?? null,
            'handed_over_at' => $row['handed_over_at'] ?? null,
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