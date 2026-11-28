<?php

declare(strict_types=1);

namespace App\Modules\IncidentCompensation\Services;

use App\Core\ApiException;
use App\Core\Crypto;
use App\Core\Database;
use App\Core\ScopeGuard;
use App\Core\UlidGenerator;
use App\Modules\IncidentCompensation\Repositories\ReturnAndApprovalRepository;
use App\Modules\IncidentCompensation\Repositories\ShipmentIncidentRepository;
use App\Modules\Shipment\DTOs\CreateShipmentDto;
use App\Modules\Shipment\Repositories\ShipmentRepository;
use App\Modules\Shipment\Repositories\TrackingRangeRepository;
use App\Modules\Shipment\Services\ShipmentPricingService;

final class IncidentCompensationService
{
    public function __construct(
        private readonly ShipmentIncidentRepository $incidentRepository,
        private readonly ReturnAndApprovalRepository $returnApprovalRepository,
        private readonly ShipmentRepository $shipmentRepository,
        private readonly TrackingRangeRepository $trackingRangeRepository,
        private readonly ShipmentPricingService $pricingService,
    ) {
    }

    // =========================================================================
    // 1. CRUD SỰ CỐ VẬN ĐƠN (shipment_incidents)
    // =========================================================================

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function listIncidents(array $filters, array $scopeContext): array
    {
        return $this->incidentRepository->paginate($filters, $scopeContext);
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function getIncident(string $identifier, array $scopeContext): array
    {
        $incident = $this->incidentRepository->findByIdentifier($identifier);
        if ($incident === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy báo cáo sự cố vận đơn.');
        }

        ScopeGuard::assertBranchAccess($scopeContext, (int) $incident['branch_id']);
        return $this->formatIncident($incident);
    }

    /**
     * @param array<string, mixed> $input
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createIncident(
        array $input,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        $branchId = $this->activeBranchId($scopeContext);
        ScopeGuard::assertBranchAccess($scopeContext, $branchId);

        if ($input['responsible_user_id'] !== null) {
            $this->incidentRepository->assertUserExists((int) $input['responsible_user_id']);
        }

        return Database::transaction(function () use ($input, $scopeContext, $branchId, $actorId, $ipAddress, $userAgent): array {
            $shipment = $this->shipmentRepository->findForUpdate((string) $input['shipment_identifier']);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn tương ứng.');
            }

            $shipmentBranchId = $shipment['current_branch_id'] === null
                ? (int) $shipment['origin_branch_id']
                : (int) $shipment['current_branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $shipmentBranchId);

            if (in_array((string) $shipment['status'], ['cancelled', 'returned'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Không thể tạo sự cố cho vận đơn đã hủy hoặc đã chuyển hoàn hoàn tất.',
                    ['shipment_status' => [(string) $shipment['status']]],
                );
            }

            $publicId = UlidGenerator::generate();
            $incidentCode = 'INC-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $shipmentId = (int) $shipment['id'];

            $incidentId = $this->incidentRepository->create([
                'public_id' => $publicId,
                'incident_code' => $incidentCode,
                'shipment_id' => $shipmentId,
                'branch_id' => $branchId,
                'incident_type' => $input['incident_type'],
                'severity' => $input['severity'],
                'description' => $input['description'],
                'evidence_urls' => $input['evidence_urls'],
                'responsible_user_id' => $input['responsible_user_id'],
                'reported_by' => $actorId,
            ]);

            $previousStatus = (string) $shipment['status'];
            if ($input['mark_shipment_incident'] and !in_array($previousStatus, ['delivered', 'incident'], true)) {
                $this->returnApprovalRepository->updateShipmentState(
                    $shipmentId,
                    (int) $shipment['version'],
                    ['status' => 'incident'],
                    $actorId,
                );
                $this->shipmentRepository->createStatusHistory(
                    $shipmentId,
                    $previousStatus,
                    'incident',
                    $branchId,
                    $actorId,
                    "Phát sinh sự cố ({$incidentCode}): {$input['description']}",
                    false,
                );
            }

            $this->incidentRepository->createAuditLog(
                $actorId,
                $branchId,
                'CREATE_SHIPMENT_INCIDENT',
                'shipment_incidents',
                $incidentId,
                [],
                [
                    'public_id' => $publicId,
                    'incident_code' => $incidentCode,
                    'shipment_id' => $shipmentId,
                    'incident_type' => $input['incident_type'],
                    'severity' => $input['severity'],
                ],
                $ipAddress,
                $userAgent,
            );

            $created = $this->incidentRepository->findByIdentifier($publicId);
            return $this->formatIncident($created ?? []);
        });
    }

    /**
     * @param array<string, mixed> $validated
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function updateIncident(
        string $identifier,
        array $validated,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        $updates = $validated['updates'];
        $restoreShipmentStatus = $validated['restore_shipment_status'];

        if (isset($updates['responsible_user_id']) and ($updates['responsible_user_id'] !== null)) {
            $this->incidentRepository->assertUserExists((int) $updates['responsible_user_id']);
        }

        return Database::transaction(function () use ($identifier, $updates, $restoreShipmentStatus, $scopeContext, $actorId, $ipAddress, $userAgent): array {
            $incident = $this->incidentRepository->findByIdentifier($identifier, true);
            if ($incident === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy báo cáo sự cố vận đơn.');
            }

            $branchId = (int) $incident['branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            $oldStatus = (string) $incident['status'];
            $newStatus = (string) ($updates['status'] ?? $oldStatus);
            $markResolved = in_array($newStatus, ['resolved', 'closed'], true) and !in_array($oldStatus, ['resolved', 'closed'], true);

            $this->incidentRepository->update((int) $incident['id'], $updates, $actorId, $markResolved);

            // Nếu đóng/giải quyết sự cố và không còn sự cố mở nào khác -> khôi phục trạng thái vận đơn
            if (in_array($newStatus, ['resolved', 'closed'], true) and ($restoreShipmentStatus !== null)) {
                $shipmentId = (int) $incident['shipment_id'];
                $openCount = $this->incidentRepository->countOpenIncidentsForShipment($shipmentId, (int) $incident['id']);
                if ($openCount === 0) {
                    $shipment = $this->shipmentRepository->findForUpdate((string) $incident['shipment_public_id']);
                    if (($shipment !== null) and ($shipment['status'] === 'incident')) {
                        $this->returnApprovalRepository->updateShipmentState(
                            $shipmentId,
                            (int) $shipment['version'],
                            ['status' => $restoreShipmentStatus],
                            $actorId,
                        );
                        $this->shipmentRepository->createStatusHistory(
                            $shipmentId,
                            'incident',
                            $restoreShipmentStatus,
                            $branchId,
                            $actorId,
                            "Sự cố {$incident['incident_code']} đã được xử lý, cập nhật lại trạng thái vận đơn.",
                            false,
                        );
                    }
                }
            }

            $this->incidentRepository->createAuditLog(
                $actorId,
                $branchId,
                'UPDATE_SHIPMENT_INCIDENT',
                'shipment_incidents',
                (int) $incident['id'],
                ['status' => $oldStatus, 'severity' => $incident['severity']],
                $updates,
                $ipAddress,
                $userAgent,
            );

            $updated = $this->incidentRepository->findByIdentifier((string) $incident['public_id']);
            return $this->formatIncident($updated ?? []);
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array{public_id: string, deleted: bool}
     */
    public function deleteIncident(
        string $identifier,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($identifier, $scopeContext, $actorId, $ipAddress, $userAgent): array {
            $incident = $this->incidentRepository->findByIdentifier($identifier, true);
            if ($incident === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy báo cáo sự cố vận đơn.');
            }

            $branchId = (int) $incident['branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            if ((string) $incident['status'] !== 'reported') {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Chỉ được xóa báo cáo sự cố đang ở trạng thái mới ghi nhận (reported).',
                    ['status' => [(string) $incident['status']]],
                );
            }

            $incidentId = (int) $incident['id'];
            $shipmentId = (int) $incident['shipment_id'];
            $publicId = (string) $incident['public_id'];

            $this->incidentRepository->delete($incidentId);

            // Nếu vận đơn đang ở trạng thái incident và không còn sự cố nào khác thì đưa về in_warehouse
            $openCount = $this->incidentRepository->countOpenIncidentsForShipment($shipmentId);
            if ($openCount === 0) {
                $shipment = $this->shipmentRepository->findForUpdate((string) $incident['shipment_public_id']);
                if (($shipment !== null) and ($shipment['status'] === 'incident')) {
                    $this->returnApprovalRepository->updateShipmentState(
                        $shipmentId,
                        (int) $shipment['version'],
                        ['status' => 'in_warehouse'],
                        $actorId,
                    );
                    $this->shipmentRepository->createStatusHistory(
                        $shipmentId,
                        'incident',
                        'in_warehouse',
                        $branchId,
                        $actorId,
                        "Hủy báo cáo sự cố {$incident['incident_code']}, hoàn tác vận đơn về kho.",
                        false,
                    );
                }
            }

            $this->incidentRepository->createAuditLog(
                $actorId,
                $branchId,
                'DELETE_SHIPMENT_INCIDENT',
                'shipment_incidents',
                $incidentId,
                ['incident_code' => $incident['incident_code'], 'status' => $incident['status']],
                [],
                $ipAddress,
                $userAgent,
            );

            return [
                'public_id' => $publicId,
                'deleted' => true,
            ];
        });
    }

    // =========================================================================
    // 2. ĐIỀU PHỐI DANH SÁCH CHỜ CHUYỂN HOÀN (pending_return)
    // =========================================================================

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function listPendingReturns(array $filters, array $scopeContext): array
    {
        return $this->returnApprovalRepository->paginatePendingReturns($filters, $scopeContext);
    }

    /**
     * Điều phối vận đơn pending_return: duyệt giao lại (redeliver) hoặc sinh vận đơn chuyển hoàn (return_shipment).
     *
     * @param array<string, mixed> $validated
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function processReturnDisposition(
        string $shipmentIdentifier,
        array $validated,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        $branchId = $this->activeBranchId($scopeContext);
        ScopeGuard::assertBranchAccess($scopeContext, $branchId);

        if ($validated['assigned_driver_id'] !== null) {
            $this->incidentRepository->assertUserExists((int) $validated['assigned_driver_id']);
        }

        return Database::transaction(function () use ($shipmentIdentifier, $validated, $scopeContext, $branchId, $actorId, $ipAddress, $userAgent): array {
            $shipment = $this->shipmentRepository->findForUpdate($shipmentIdentifier);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn.');
            }

            $shipmentBranchId = $shipment['current_branch_id'] === null
                ? (int) $shipment['origin_branch_id']
                : (int) $shipment['current_branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $shipmentBranchId);

            if ((int) $shipment['version'] !== (int) $validated['version']) {
                throw new ApiException('409_VERSION_CONFLICT', 'Vận đơn vừa được cập nhật bởi thao tác khác, vui lòng tải lại dữ liệu.');
            }

            $currentStatus = (string) $shipment['status'];
            if (!in_array($currentStatus, ['pending_return', 'delivery_failed'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Chỉ được điều phối chuyển hoàn/giao lại với vận đơn đang ở trạng thái pending_return hoặc delivery_failed.',
                    ['current_status' => [$currentStatus]],
                );
            }

            $shipmentId = (int) $shipment['id'];
            $action = (string) $validated['action'];
            $note = $validated['note'];

            if ($action === 'redeliver') {
                $nextStatus = $validated['assigned_driver_id'] !== null ? 'out_for_delivery' : 'in_warehouse';
                $updateColumns = [
                    'status' => $nextStatus,
                    'storage_deadline' => null,
                ];
                if ($validated['assigned_driver_id'] !== null) {
                    $updateColumns['assigned_driver_id'] = $validated['assigned_driver_id'];
                }

                $this->returnApprovalRepository->updateShipmentState(
                    $shipmentId,
                    (int) $shipment['version'],
                    $updateColumns,
                    $actorId,
                );

                $historyDesc = $note !== null
                    ? "Điều phối duyệt giao lại: {$note}"
                    : 'Điều phối viên duyệt giao lại vận đơn cho người nhận.';

                $this->shipmentRepository->createStatusHistory(
                    $shipmentId,
                    $currentStatus,
                    $nextStatus,
                    $branchId,
                    $actorId,
                    $historyDesc,
                );

                $this->shipmentRepository->createAuditLog(
                    $actorId,
                    $branchId,
                    'APPROVE_REDELIVERY',
                    $shipmentId,
                    ['status' => $currentStatus, 'version' => (int) $shipment['version']],
                    ['status' => $nextStatus, 'assigned_driver_id' => $validated['assigned_driver_id'], 'note' => $note],
                    $ipAddress,
                    $userAgent,
                );

                return [
                    'action' => 'redeliver',
                    'shipment' => [
                        'public_id' => (string) $shipment['public_id'],
                        'tracking_code' => (string) $shipment['tracking_code'],
                        'status' => $nextStatus,
                        'version' => (int) $shipment['version'] + 1,
                    ],
                ];
            }

            // Hành động: create_return_shipment -> Sinh vận đơn chuyển hoàn return_shipment
            $existingReturn = $this->returnApprovalRepository->findActiveReturnShipmentByParentId($shipmentId);
            if ($existingReturn !== null) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Vận đơn này đã có vận đơn chuyển hoàn đang hoạt động.',
                    ['return_tracking_code' => [(string) $existingReturn['tracking_code']]],
                );
            }

            $parcels = $this->shipmentRepository->findParcels($shipmentId);
            if ($parcels === []) {
                throw new ApiException('500_INTERNAL_ERROR', 'Vận đơn gốc không có dữ liệu kiện hàng.');
            }

            // Hủy các giao dịch COD còn pending của vận đơn gốc & chuyển trạng thái gốc sang returning
            $this->shipmentRepository->cancelPendingCodTransactions($shipmentId);
            $this->returnApprovalRepository->updateShipmentState(
                $shipmentId,
                (int) $shipment['version'],
                [
                    'status' => 'returning',
                    'storage_deadline' => null,
                ],
                $actorId,
            );

            $returnOriginBranchId = $shipment['current_branch_id'] !== null
                ? (int) $shipment['current_branch_id']
                : $branchId;
            $returnDestBranchId = (int) $shipment['origin_branch_id'];
            $returnTrackingCode = $this->trackingRangeRepository->allocateNext($returnOriginBranchId);
            $returnPublicId = UlidGenerator::generate();
            $createdAt = date('Y-m-d H:i:s');

            // Đảo chiều Người gửi <-> Người nhận để hoàn hàng về shop/người gửi ban đầu
            $senderPhonePlain = Crypto::decrypt((string) $shipment['sender_phone_encrypted']);
            $recipientPhonePlain = Crypto::decrypt((string) $shipment['recipient_phone_encrypted']);

            $returnDto = new CreateShipmentDto(
                (string) $shipment['recipient_name'],
                $recipientPhonePlain,
                (string) $shipment['recipient_address'],
                (int) $shipment['recipient_province_id'],
                (int) $shipment['recipient_district_id'],
                (int) $shipment['recipient_ward_id'],
                (string) $shipment['sender_name'],
                $senderPhonePlain,
                (string) $shipment['sender_address'],
                (int) $shipment['sender_province_id'],
                (int) $shipment['sender_district_id'],
                (int) $shipment['sender_ward_id'],
                $returnDestBranchId,
                (int) $shipment['service_type_id'],
                (int) $shipment['cargo_category_id'],
                'ngtts',
                '0.00',
                (string) $shipment['declared_value'],
                'counter_dropoff',
                array_map(
                    static fn (array $p): array => [
                        'actual_weight_gram' => (int) $p['actual_weight_gram'],
                        'length_cm' => (string) $p['length_cm'],
                        'width_cm' => (string) $p['width_cm'],
                        'height_cm' => (string) $p['height_cm'],
                        'description' => $p['description'] === null ? null : (string) $p['description'],
                    ],
                    $parcels,
                ),
                [],
                [],
            );

            $pricing = $this->pricingService->calculate(
                $returnDto,
                $returnOriginBranchId,
                $returnTrackingCode,
                substr($createdAt, 0, 10),
            );

            $chargeReturnFreight = (bool) $validated['charge_return_freight'];
            $baseFreight = $chargeReturnFreight ? $pricing['base_freight_amount'] : '0.00';
            $surchargeAmt = $chargeReturnFreight ? $pricing['surcharge_amount'] : '0.00';
            $vatAmt = $chargeReturnFreight ? $pricing['vat_amount'] : '0.00';
            $totalFreight = $chargeReturnFreight ? $pricing['total_freight_amount'] : '0.00';

            $returnShipmentId = $this->shipmentRepository->createShipment([
                ':public_id' => $returnPublicId,
                ':tracking_code' => $returnTrackingCode,
                ':shipment_type' => 'return_shipment',
                ':parent_shipment_id' => $shipmentId,
                ':pickup_request_id' => null,
                ':customer_id' => $shipment['customer_id'],
                ':origin_branch_id' => $returnOriginBranchId,
                ':destination_branch_id' => $returnDestBranchId,
                ':current_branch_id' => $returnOriginBranchId,
                ':current_warehouse_id' => null,
                ':assigned_driver_id' => null,
                ':service_type_id' => (int) $shipment['service_type_id'],
                ':cargo_category_id' => (int) $shipment['cargo_category_id'],
                ':sender_name' => $returnDto->senderName,
                ':sender_phone_encrypted' => Crypto::encrypt($returnDto->senderPhone),
                ':sender_phone_hash' => Crypto::hashPhone($returnDto->senderPhone),
                ':sender_phone_masked' => Crypto::maskPhone($returnDto->senderPhone),
                ':sender_province_id' => $returnDto->senderProvinceId,
                ':sender_district_id' => $returnDto->senderDistrictId,
                ':sender_ward_id' => $returnDto->senderWardId,
                ':sender_address' => $returnDto->senderAddress,
                ':recipient_name' => $returnDto->recipientName,
                ':recipient_phone_encrypted' => Crypto::encrypt($returnDto->recipientPhone),
                ':recipient_phone_hash' => Crypto::hashPhone($returnDto->recipientPhone),
                ':recipient_phone_masked' => Crypto::maskPhone($returnDto->recipientPhone),
                ':recipient_province_id' => $returnDto->recipientProvinceId,
                ':recipient_district_id' => $returnDto->recipientDistrictId,
                ':recipient_ward_id' => $returnDto->recipientWardId,
                ':recipient_address' => $returnDto->recipientAddress,
                ':parcel_count' => $pricing['parcel_count'],
                ':total_actual_weight_gram' => $pricing['total_actual_weight_gram'],
                ':total_volumetric_weight_gram' => $pricing['total_volumetric_weight_gram'],
                ':chargeable_weight_gram' => $pricing['chargeable_weight_gram'],
                ':declared_value' => $returnDto->declaredValue,
                ':payment_method' => 'ngtts',
                ':is_counter_freight_paid' => 0,
                ':base_freight_amount' => $baseFreight,
                ':surcharge_amount' => $surchargeAmt,
                ':vas_amount' => '0.00',
                ':vat_amount' => $vatAmt,
                ':total_freight_amount' => $totalFreight,
                ':cod_amount' => '0.00',
                ':is_priority' => (int) $shipment['is_priority'],
                ':status' => 'in_warehouse',
                ':version' => 1,
                ':created_by' => $actorId,
                ':updated_by' => $actorId,
            ]);

            $this->shipmentRepository->createParcels($returnShipmentId, $pricing['parcels']);

            $parentDesc = $note !== null
                ? "Khởi tạo vận đơn chuyển hoàn {$returnTrackingCode}: {$note}"
                : "Khởi tạo vận đơn chuyển hoàn {$returnTrackingCode} về người gửi.";

            $this->shipmentRepository->createStatusHistory(
                $shipmentId,
                $currentStatus,
                'returning',
                $branchId,
                $actorId,
                $parentDesc,
            );

            $this->shipmentRepository->createStatusHistory(
                $returnShipmentId,
                null,
                'in_warehouse',
                $returnOriginBranchId,
                $actorId,
                "Vận đơn chuyển hoàn được tạo từ vận đơn gốc {$shipment['tracking_code']}.",
            );

            $this->shipmentRepository->createAuditLog(
                $actorId,
                $branchId,
                'CREATE_RETURN_SHIPMENT',
                $shipmentId,
                ['status' => $currentStatus],
                [
                    'status' => 'returning',
                    'return_shipment_public_id' => $returnPublicId,
                    'return_tracking_code' => $returnTrackingCode,
                ],
                $ipAddress,
                $userAgent,
            );

            return [
                'action' => 'create_return_shipment',
                'parent_shipment' => [
                    'public_id' => (string) $shipment['public_id'],
                    'tracking_code' => (string) $shipment['tracking_code'],
                    'status' => 'returning',
                    'version' => (int) $shipment['version'] + 1,
                ],
                'return_shipment' => [
                    'public_id' => $returnPublicId,
                    'tracking_code' => $returnTrackingCode,
                    'shipment_type' => 'return_shipment',
                    'status' => 'in_warehouse',
                    'recipient_name' => $returnDto->recipientName,
                    'recipient_phone_masked' => Crypto::maskPhone($returnDto->recipientPhone),
                    'total_freight_amount' => $totalFreight,
                    'cod_amount' => '0.00',
                    'created_at' => $createdAt,
                ],
            ];
        });
    }

    // =========================================================================
    // 3. LUỒNG PHÊ DUYỆT YÊU CẦU (shipment_approval_requests)
    // =========================================================================

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function listApprovalRequests(array $filters, array $scopeContext): array
    {
        return $this->returnApprovalRepository->paginateApprovalRequests($filters, $scopeContext);
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function getApprovalRequest(string $identifier, array $scopeContext): array
    {
        $request = $this->returnApprovalRepository->findApprovalByIdentifier($identifier);
        if ($request === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy yêu cầu phê duyệt vận đơn.');
        }

        ScopeGuard::assertBranchAccess($scopeContext, (int) $request['branch_id']);
        $formatted = $this->formatApproval($request);
        $formatted['cod_transactions'] = $this->shipmentRepository->findCodTransactions((int) $request['shipment_id']);

        return $formatted;
    }

    /**
     * @param array<string, mixed> $input
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createApprovalRequest(
        array $input,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        $branchId = $this->activeBranchId($scopeContext);
        ScopeGuard::assertBranchAccess($scopeContext, $branchId);

        return Database::transaction(function () use ($input, $scopeContext, $branchId, $actorId, $ipAddress, $userAgent): array {
            $shipment = $this->shipmentRepository->findForUpdate((string) $input['shipment_identifier']);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn.');
            }

            $shipmentBranchId = $shipment['current_branch_id'] === null
                ? (int) $shipment['origin_branch_id']
                : (int) $shipment['current_branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $shipmentBranchId);

            $shipmentId = (int) $shipment['id'];
            $approvalType = (string) $input['approval_type'];
            $shipmentStatus = (string) $shipment['status'];

            if (($approvalType === 'cancel_delivered_shipment') and ($shipmentStatus !== 'delivered')) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Chỉ được gửi yêu cầu Hủy giao thành công đối với vận đơn đang ở trạng thái delivered.',
                    ['shipment_status' => [$shipmentStatus]],
                );
            }

            if (in_array($approvalType, ['approve_return', 'extra_redelivery'], true) and !in_array($shipmentStatus, ['delivery_failed', 'pending_return'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Trạng thái vận đơn hiện tại không phù hợp với loại yêu cầu phê duyệt này.',
                    ['shipment_status' => [$shipmentStatus]],
                );
            }

            if ($approvalType === 'cancel_delivered_shipment') {
                $codList = $this->returnApprovalRepository->findCodTransactionsForUpdate($shipmentId);
                foreach ($codList as $cod) {
                    if (in_array((string) $cod['status'], ['remitted_to_hq', 'settled_to_customer'], true)) {
                        throw new ApiException(
                            '422_VALIDATION_ERROR',
                            'Không thể tạo yêu cầu hủy giao thành công vì giao dịch COD của vận đơn đã khóa sổ hoặc đối soát với khách hàng.',
                            ['cod_transactions' => [(string) $cod['status']]],
                        );
                    }
                }
            }

            if ($this->returnApprovalRepository->hasPendingApproval($shipmentId, $approvalType)) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Vận đơn này đang có một yêu cầu phê duyệt cùng loại ở trạng thái chờ duyệt (pending).',
                );
            }

            $publicId = UlidGenerator::generate();
            $requestCode = 'APR-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));

            $approvalId = $this->returnApprovalRepository->createApprovalRequest([
                'public_id' => $publicId,
                'request_code' => $requestCode,
                'shipment_id' => $shipmentId,
                'branch_id' => $branchId,
                'approval_type' => $approvalType,
                'reason' => $input['reason'],
                'evidence_urls' => $input['evidence_urls'],
                'requested_by' => $actorId,
            ]);

            $this->incidentRepository->createAuditLog(
                $actorId,
                $branchId,
                'CREATE_SHIPMENT_APPROVAL_REQUEST',
                'shipment_approval_requests',
                $approvalId,
                [],
                [
                    'public_id' => $publicId,
                    'request_code' => $requestCode,
                    'shipment_id' => $shipmentId,
                    'approval_type' => $approvalType,
                    'reason' => $input['reason'],
                ],
                $ipAddress,
                $userAgent,
            );

            $created = $this->returnApprovalRepository->findApprovalByIdentifier($publicId);
            return $this->formatApproval($created ?? []);
        });
    }

    /**
     * Quản lý chi nhánh phê duyệt hoặc từ chối shipment_approval_requests.
     * Khi duyệt cancel_delivered_shipment: tự động hoàn tác trạng thái vận đơn và hủy cod_transactions chưa khóa sổ.
     *
     * @param array<string, mixed> $validated
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function reviewApprovalRequest(
        string $identifier,
        array $validated,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use ($identifier, $validated, $scopeContext, $actorId, $ipAddress, $userAgent): array {
            $approval = $this->returnApprovalRepository->findApprovalByIdentifier($identifier, true);
            if ($approval === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy yêu cầu phê duyệt vận đơn.');
            }

            $branchId = (int) $approval['branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            if ((string) $approval['status'] !== 'pending') {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Yêu cầu phê duyệt này đã được xử lý trước đó.',
                    ['status' => [(string) $approval['status']]],
                );
            }

            if ((int) $approval['version'] !== (int) $validated['version']) {
                throw new ApiException('409_VERSION_CONFLICT', 'Yêu cầu phê duyệt vừa được cập nhật, vui lòng tải lại dữ liệu.');
            }

            $approvalId = (int) $approval['id'];
            $shipmentId = (int) $approval['shipment_id'];
            $decision = (string) $validated['decision'];
            $reviewNote = $validated['review_note'];
            $approvalType = (string) $approval['approval_type'];

            $this->returnApprovalRepository->reviewApprovalRequest(
                $approvalId,
                (int) $approval['version'],
                $decision,
                $actorId,
                $reviewNote,
            );

            $cancelledCodCount = 0;
            $shipmentResult = null;

            if ($decision === 'approved') {
                $shipment = $this->shipmentRepository->findForUpdate((string) $approval['shipment_public_id']);
                if ($shipment === null) {
                    throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn gắn với yêu cầu phê duyệt.');
                }

                if ($approvalType === 'cancel_delivered_shipment') {
                    if ((string) $shipment['status'] !== 'delivered') {
                        throw new ApiException(
                            '422_VALIDATION_ERROR',
                            'Vận đơn không còn ở trạng thái delivered nên không thể thực thi hủy giao thành công.',
                            ['current_status' => [(string) $shipment['status']]],
                        );
                    }

                    // Khóa và kiểm tra toàn bộ cod_transactions của vận đơn
                    $codList = $this->returnApprovalRepository->findCodTransactionsForUpdate($shipmentId);
                    foreach ($codList as $cod) {
                        if (in_array((string) $cod['status'], ['remitted_to_hq', 'settled_to_customer'], true)) {
                            throw new ApiException(
                                '422_VALIDATION_ERROR',
                                'Không thể phê duyệt hủy giao thành công vì giao dịch COD đã khóa sổ/quyết toán.',
                                ['cod_transactions' => [(string) $cod['status']]],
                            );
                        }
                    }

                    // Hủy tất cả cod_transactions chưa khóa sổ (pending, driver_holding, collected_by_branch)
                    $cancelledCodCount = $this->returnApprovalRepository->cancelUnsettledCodTransactions($shipmentId);

                    // Hoàn tác trạng thái vận đơn từ delivered -> delivery_failed (hoặc in_warehouse)
                    $revertStatus = (string) $validated['revert_to_status'];
                    $this->returnApprovalRepository->updateShipmentState(
                        $shipmentId,
                        (int) $shipment['version'],
                        [
                            'status' => $revertStatus,
                            'delivered_at' => null,
                            'actual_recipient_name' => null,
                        ],
                        $actorId,
                    );

                    $desc = $reviewNote !== null
                        ? "Quản lý chi nhánh phê duyệt Hủy giao thành công ({$approval['request_code']}): {$reviewNote}"
                        : "Quản lý chi nhánh phê duyệt Hủy giao thành công ({$approval['request_code']}), hoàn tác trạng thái vận đơn.";

                    $this->shipmentRepository->createStatusHistory(
                        $shipmentId,
                        'delivered',
                        $revertStatus,
                        $branchId,
                        $actorId,
                        $desc,
                    );

                    $this->shipmentRepository->createAuditLog(
                        $actorId,
                        $branchId,
                        'CANCEL_DELIVERED_SHIPMENT_APPROVED',
                        $shipmentId,
                        ['status' => 'delivered', 'delivered_at' => ($shipment['delivered_at'] ?? $approval['delivered_at'] ?? null)],
                        [
                            'status' => $revertStatus,
                            'delivered_at' => null,
                            'cancelled_cod_transactions' => $cancelledCodCount,
                            'approval_request_code' => $approval['request_code'],
                        ],
                        $ipAddress,
                        $userAgent,
                    );

                    $shipmentResult = [
                        'public_id' => (string) $shipment['public_id'],
                        'tracking_code' => (string) $shipment['tracking_code'],
                        'previous_status' => 'delivered',
                        'status' => $revertStatus,
                        'cancelled_cod_transactions' => $cancelledCodCount,
                    ];
                } elseif (in_array($approvalType, ['approve_return', 'extra_redelivery'], true)) {
                    $targetStatus = $approvalType === 'approve_return' ? 'pending_return' : 'in_warehouse';
                    $prevStatus = (string) $shipment['status'];
                    $this->returnApprovalRepository->updateShipmentState(
                        $shipmentId,
                        (int) $shipment['version'],
                        ['status' => $targetStatus],
                        $actorId,
                    );
                    $this->shipmentRepository->createStatusHistory(
                        $shipmentId,
                        $prevStatus,
                        $targetStatus,
                        $branchId,
                        $actorId,
                        "Phê duyệt yêu cầu {$approval['request_code']}: chuyển trạng thái sang {$targetStatus}.",
                    );
                    $shipmentResult = [
                        'public_id' => (string) $shipment['public_id'],
                        'tracking_code' => (string) $shipment['tracking_code'],
                        'previous_status' => $prevStatus,
                        'status' => $targetStatus,
                    ];
                }
            }

            $this->incidentRepository->createAuditLog(
                $actorId,
                $branchId,
                $decision === 'approved' ? 'APPROVE_SHIPMENT_REQUEST' : 'REJECT_SHIPMENT_REQUEST',
                'shipment_approval_requests',
                $approvalId,
                ['status' => 'pending', 'version' => (int) $approval['version']],
                [
                    'status' => $decision,
                    'review_note' => $reviewNote,
                    'cancelled_cod_transactions' => $cancelledCodCount,
                ],
                $ipAddress,
                $userAgent,
            );

            $reviewed = $this->returnApprovalRepository->findApprovalByIdentifier((string) $approval['public_id']);
            $response = $this->formatApproval($reviewed ?? []);
            if ($shipmentResult !== null) {
                $response['shipment_effect'] = $shipmentResult;
            }

            return $response;
        });
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatIncident(array $row): array
    {
        unset($row['id'], $row['shipment_id']);
        $row['branch_id'] = (int) ($row['branch_id'] ?? 0);
        $row['reported_by'] = (int) ($row['reported_by'] ?? 0);
        $row['responsible_user_id'] = isset($row['responsible_user_id']) ? (int) $row['responsible_user_id'] : null;
        $row['resolved_by'] = isset($row['resolved_by']) ? (int) $row['resolved_by'] : null;
        return $row;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatApproval(array $row): array
    {
        unset($row['id'], $row['shipment_id'], $row['shipment_version']);
        $row['branch_id'] = (int) ($row['branch_id'] ?? 0);
        $row['requested_by'] = (int) ($row['requested_by'] ?? 0);
        $row['reviewed_by'] = isset($row['reviewed_by']) ? (int) $row['reviewed_by'] : null;
        $row['version'] = (int) ($row['version'] ?? 1);
        return $row;
    }

    /**
     * @param array<string, mixed> $scopeContext
     */
    private function activeBranchId(array $scopeContext): int
    {
        $branchId = filter_var($scopeContext['active_branch_id'] ?? null, FILTER_VALIDATE_INT);
        if (($branchId === false) or ($branchId < 1)) {
            throw new ApiException('403_BRANCH_SCOPE', 'Thiếu chi nhánh đang làm việc hợp lệ.');
        }

        return $branchId;
    }
}
