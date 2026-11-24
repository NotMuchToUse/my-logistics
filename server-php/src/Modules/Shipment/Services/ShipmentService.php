<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Services;

use App\Core\ApiException;
use App\Core\Crypto;
use App\Core\Database;
use App\Core\ScopeGuard;
use App\Core\UlidGenerator;
use App\Modules\Shipment\DTOs\CreateShipmentDto;
use App\Modules\Shipment\DTOs\ShipmentFilterDto;
use App\Modules\Shipment\Repositories\ShipmentRepository;
use App\Modules\Shipment\Repositories\TrackingRangeRepository;
use PDO;

final class ShipmentService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly ShipmentRepository $shipmentRepository,
        private readonly TrackingRangeRepository $trackingRangeRepository,
        private readonly ShipmentPricingService $pricingService,
    ) {
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function create(
        CreateShipmentDto $shipment,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        $originBranchId = $this->activeBranchId($scopeContext);
        ScopeGuard::assertBranchAccess($scopeContext, $originBranchId);

        return Database::transaction(function () use (
            $shipment,
            $originBranchId,
            $actorId,
            $ipAddress,
            $userAgent,
        ): array {
            return $this->createShipmentInTransaction(
                $shipment,
                $originBranchId,
                null,
                $actorId,
                $ipAddress,
                $userAgent,
            );
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginate(ShipmentFilterDto $filters, array $scopeContext): array
    {
        return $this->shipmentRepository->paginate($filters, $scopeContext);
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function detail(string $identifier, array $scopeContext): array
    {
        $shipment = $this->shipmentRepository->findByPublicIdOrTrackingCode($identifier);
        if ($shipment === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn.');
        }

        $this->assertShipmentScope($shipment, $scopeContext);
        $shipmentId = (int) $shipment['id'];
        $shipment['sender_phone'] = Crypto::decrypt((string) $shipment['sender_phone_encrypted']);
        $shipment['recipient_phone'] = Crypto::decrypt((string) $shipment['recipient_phone_encrypted']);
        unset(
            $shipment['id'],
            $shipment['parent_shipment_id'],
            $shipment['pickup_request_id'],
            $shipment['customer_id'],
            $shipment['sender_phone_encrypted'],
            $shipment['sender_phone_hash'],
            $shipment['recipient_phone_encrypted'],
            $shipment['recipient_phone_hash'],
        );
        $shipment['shipment_parcels'] = $this->shipmentRepository->findParcels($shipmentId);
        $shipment['shipment_vas'] = $this->shipmentRepository->findVasSnapshots($shipmentId);
        $shipment['shipment_surcharges'] = $this->shipmentRepository->findSurchargeSnapshots($shipmentId);
        $shipment['shipment_status_history'] = $this->shipmentRepository->findStatusHistory($shipmentId);
        $shipment['cod_transactions'] = $this->shipmentRepository->findCodTransactions($shipmentId);
        $shipment['print_logs'] = $this->shipmentRepository->findPrintLogs($shipmentId);
        $shipment['is_priority'] = (bool) $shipment['is_priority'];
        $shipment['version'] = (int) $shipment['version'];

        return $shipment;
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array{public_id: string, is_priority: bool, version: int}
     */
    public function updatePriority(
        string $identifier,
        int $expectedVersion,
        bool $isPriority,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use (
            $identifier,
            $expectedVersion,
            $isPriority,
            $scopeContext,
            $actorId,
            $ipAddress,
            $userAgent,
        ): array {
            $shipment = $this->findLockedShipment($identifier);
            $this->assertShipmentScope($shipment, $scopeContext);
            if ((int) $shipment['version'] !== $expectedVersion) {
                throw new ApiException('409_VERSION_CONFLICT', 'Vận đơn đã được cập nhật, vui lòng tải lại dữ liệu.');
            }

            $this->shipmentRepository->updatePriority(
                (int) $shipment['id'],
                $expectedVersion,
                $isPriority,
                $actorId,
            );
            $newVersion = $expectedVersion + 1;
            $this->shipmentRepository->createAuditLog(
                $actorId,
                $this->activeBranchId($scopeContext),
                'UPDATE_SHIPMENT_PRIORITY',
                (int) $shipment['id'],
                ['is_priority' => (int) $shipment['is_priority'], 'version' => $expectedVersion],
                ['is_priority' => $isPriority ? 1 : 0, 'version' => $newVersion],
                $ipAddress,
                $userAgent,
            );

            return [
                'public_id' => (string) $shipment['public_id'],
                'is_priority' => $isPriority,
                'version' => $newVersion,
            ];
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array{public_id: string, status: string, version: int}
     */
    public function cancel(
        string $identifier,
        int $expectedVersion,
        ?string $reason,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        return Database::transaction(function () use (
            $identifier,
            $expectedVersion,
            $reason,
            $scopeContext,
            $actorId,
            $ipAddress,
            $userAgent,
        ): array {
            $shipment = $this->findLockedShipment($identifier);
            $this->assertShipmentScope($shipment, $scopeContext);
            if ((int) $shipment['version'] !== $expectedVersion) {
                throw new ApiException('409_VERSION_CONFLICT', 'Vận đơn đã được cập nhật, vui lòng tải lại dữ liệu.');
            }
            if (!in_array($shipment['status'], ['draft', 'pending_pickup'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Chỉ được hủy vận đơn ở trạng thái nháp hoặc chờ lấy hàng.',
                    ['current_status' => (string) $shipment['status']],
                );
            }

            $this->shipmentRepository->cancelShipment(
                (int) $shipment['id'],
                $expectedVersion,
                $reason,
                $actorId,
            );
            $this->shipmentRepository->cancelPendingCodTransactions((int) $shipment['id']);
            $branchId = $this->activeBranchId($scopeContext);
            $this->shipmentRepository->createStatusHistory(
                (int) $shipment['id'],
                (string) $shipment['status'],
                'cancelled',
                $branchId,
                $actorId,
                $reason === null || trim($reason) === '' ? 'Vận đơn đã được hủy.' : trim($reason),
            );
            $newVersion = $expectedVersion + 1;
            $this->shipmentRepository->createAuditLog(
                $actorId,
                $branchId,
                'CANCEL_SHIPMENT',
                (int) $shipment['id'],
                ['status' => (string) $shipment['status'], 'version' => $expectedVersion],
                ['status' => 'cancelled', 'version' => $newVersion, 'cancel_reason' => $reason],
                $ipAddress,
                $userAgent,
            );

            return [
                'public_id' => (string) $shipment['public_id'],
                'status' => 'cancelled',
                'version' => $newVersion,
            ];
        });
    }

    /**
     * @param array<string, mixed> $recipient
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function forward(
        string $identifier,
        array $recipient,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        $originBranchId = $this->activeBranchId($scopeContext);
        ScopeGuard::assertBranchAccess($scopeContext, $originBranchId);

        return Database::transaction(function () use (
            $identifier,
            $recipient,
            $scopeContext,
            $originBranchId,
            $actorId,
            $ipAddress,
            $userAgent,
        ): array {
            $parent = $this->findLockedShipment($identifier);
            $this->assertShipmentScope($parent, $scopeContext);
            if (!in_array($parent['status'], ['delivery_failed', 'pending_return'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Chỉ được chuyển tiếp vận đơn giao thất bại hoặc chờ chuyển hoàn.',
                    ['current_status' => (string) $parent['status']],
                );
            }
            $this->shipmentRepository->assertCodTransactionsForwardable((int) $parent['id']);

            $parcels = $this->shipmentRepository->findParcels((int) $parent['id']);
            if ($parcels === []) {
                throw new ApiException('500_INTERNAL_ERROR', 'Vận đơn nguồn không có thông tin kiện hàng.');
            }
            $vasIds = array_map(
                static fn (array $vas): int => (int) $vas['vas_id'],
                $this->shipmentRepository->findVasSnapshots((int) $parent['id']),
            );
            $surchargeIds = array_map(
                static fn (array $surcharge): int => (int) $surcharge['surcharge_id'],
                $this->shipmentRepository->findSurchargeSnapshots((int) $parent['id']),
            );
            $forwardShipment = new CreateShipmentDto(
                (string) $parent['sender_name'],
                Crypto::decrypt((string) $parent['sender_phone_encrypted']),
                (string) $parent['sender_address'],
                (int) $parent['sender_province_id'],
                (int) $parent['sender_district_id'],
                (int) $parent['sender_ward_id'],
                (string) $recipient['recipient_name'],
                (string) $recipient['recipient_phone'],
                (string) $recipient['recipient_address'],
                (int) $recipient['recipient_province_id'],
                (int) $recipient['recipient_district_id'],
                (int) $recipient['recipient_ward_id'],
                (int) $recipient['destination_branch_id'],
                (int) $parent['service_type_id'],
                (int) $parent['cargo_category_id'],
                (string) $parent['payment_method'],
                (string) $parent['cod_amount'],
                (string) $parent['declared_value'],
                'driver_pickup',
                array_map(
                    static fn (array $parcel): array => [
                        'actual_weight_gram' => (int) $parcel['actual_weight_gram'],
                        'length_cm' => (string) $parcel['length_cm'],
                        'width_cm' => (string) $parcel['width_cm'],
                        'height_cm' => (string) $parcel['height_cm'],
                        'description' => $parcel['description'] === null ? null : (string) $parcel['description'],
                    ],
                    $parcels,
                ),
                $vasIds,
                $surchargeIds,
            );

            $newShipment = $this->createShipmentInTransaction(
                $forwardShipment,
                (int) $parent['origin_branch_id'],
                (int) $parent['id'],
                $actorId,
                $ipAddress,
                $userAgent,
            );
            $this->shipmentRepository->cancelPendingCodTransactions((int) $parent['id']);
            $this->shipmentRepository->createAuditLog(
                $actorId,
                $originBranchId,
                'FORWARD_SHIPMENT',
                (int) $parent['id'],
                ['status' => (string) $parent['status']],
                ['child_public_id' => $newShipment['public_id']],
                $ipAddress,
                $userAgent,
            );

            return $newShipment;
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array{document_type: string, print_count: int, printed_at: string}
     */
    public function recordPrint(
        string $identifier,
        string $documentType,
        int $printCount,
        array $scopeContext,
        int $actorId,
        string $ipAddress,
    ): array {
        return Database::transaction(function () use (
            $identifier,
            $documentType,
            $printCount,
            $scopeContext,
            $actorId,
            $ipAddress,
        ): array {
            $shipment = $this->shipmentRepository->findByPublicIdOrTrackingCode($identifier);
            if ($shipment === null) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn.');
            }
            $this->assertShipmentScope($shipment, $scopeContext);
            $branchId = $this->activeBranchId($scopeContext);
            $this->shipmentRepository->createPrintLog(
                $actorId,
                $branchId,
                $documentType,
                (int) $shipment['id'],
                $printCount,
                $ipAddress,
            );

            return [
                'document_type' => $documentType,
                'print_count' => $printCount,
                'printed_at' => date('Y-m-d H:i:s'),
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function createShipmentInTransaction(
        CreateShipmentDto $shipment,
        int $originBranchId,
        ?int $parentShipmentId,
        int $actorId,
        string $ipAddress,
        ?string $userAgent,
    ): array {
        $trackingCode = $this->trackingRangeRepository->allocateNext($originBranchId);
        $publicId = UlidGenerator::generate();
        $createdAt = date('Y-m-d H:i:s');
        $pricing = $this->pricingService->calculate(
            $shipment,
            $originBranchId,
            $trackingCode,
            substr($createdAt, 0, 10),
        );
        $status = $shipment->creationMode === 'counter_dropoff' ? 'in_warehouse' : 'pending_pickup';
        $isCounterFreightPaid = $shipment->creationMode === 'counter_dropoff'
            && $shipment->paymentMethod === 'ngttn';
        $shipmentId = $this->shipmentRepository->createShipment([
            ':public_id' => $publicId,
            ':tracking_code' => $trackingCode,
            ':shipment_type' => $parentShipmentId === null ? 'normal' : 'forward_shipment',
            ':parent_shipment_id' => $parentShipmentId,
            ':pickup_request_id' => null,
            ':customer_id' => null,
            ':origin_branch_id' => $originBranchId,
            ':destination_branch_id' => $shipment->destinationBranchId,
            ':current_branch_id' => $originBranchId,
            ':current_warehouse_id' => null,
            ':assigned_driver_id' => null,
            ':service_type_id' => $shipment->serviceTypeId,
            ':cargo_category_id' => $shipment->cargoCategoryId,
            ':sender_name' => $shipment->senderName,
            ':sender_phone_encrypted' => Crypto::encrypt($shipment->senderPhone),
            ':sender_phone_hash' => Crypto::hashPhone($shipment->senderPhone),
            ':sender_phone_masked' => Crypto::maskPhone($shipment->senderPhone),
            ':sender_province_id' => $shipment->senderProvinceId,
            ':sender_district_id' => $shipment->senderDistrictId,
            ':sender_ward_id' => $shipment->senderWardId,
            ':sender_address' => $shipment->senderAddress,
            ':recipient_name' => $shipment->recipientName,
            ':recipient_phone_encrypted' => Crypto::encrypt($shipment->recipientPhone),
            ':recipient_phone_hash' => Crypto::hashPhone($shipment->recipientPhone),
            ':recipient_phone_masked' => Crypto::maskPhone($shipment->recipientPhone),
            ':recipient_province_id' => $shipment->recipientProvinceId,
            ':recipient_district_id' => $shipment->recipientDistrictId,
            ':recipient_ward_id' => $shipment->recipientWardId,
            ':recipient_address' => $shipment->recipientAddress,
            ':parcel_count' => $pricing['parcel_count'],
            ':total_actual_weight_gram' => $pricing['total_actual_weight_gram'],
            ':total_volumetric_weight_gram' => $pricing['total_volumetric_weight_gram'],
            ':chargeable_weight_gram' => $pricing['chargeable_weight_gram'],
            ':declared_value' => $shipment->declaredValue,
            ':payment_method' => $shipment->paymentMethod,
            ':is_counter_freight_paid' => $isCounterFreightPaid ? 1 : 0,
            ':base_freight_amount' => $pricing['base_freight_amount'],
            ':surcharge_amount' => $pricing['surcharge_amount'],
            ':vas_amount' => $pricing['vas_amount'],
            ':vat_amount' => $pricing['vat_amount'],
            ':total_freight_amount' => $pricing['total_freight_amount'],
            ':cod_amount' => $shipment->codAmount,
            ':is_priority' => 0,
            ':status' => $status,
            ':version' => 1,
            ':created_by' => $actorId,
            ':updated_by' => $actorId,
        ]);
        $this->shipmentRepository->createParcels($shipmentId, $pricing['parcels']);
        $this->shipmentRepository->createVasSnapshots($shipmentId, $pricing['vas_snapshots']);
        $this->shipmentRepository->createSurchargeSnapshots($shipmentId, $pricing['surcharge_snapshots']);
        $this->shipmentRepository->createCodTransactions(
            $shipmentId,
            $originBranchId,
            $this->codTransactions($shipment, $pricing['total_freight_amount']),
        );
        $this->shipmentRepository->createStatusHistory(
            $shipmentId,
            null,
            $status,
            $originBranchId,
            $actorId,
            $status === 'in_warehouse'
                ? 'Vận đơn được tiếp nhận tại quầy.'
                : 'Vận đơn được tạo và đang chờ lấy hàng.',
        );
        $this->shipmentRepository->createAuditLog(
            $actorId,
            $originBranchId,
            $parentShipmentId === null ? 'CREATE_SHIPMENT' : 'CREATE_FORWARD_SHIPMENT',
            $shipmentId,
            [],
            ['public_id' => $publicId, 'tracking_code' => $trackingCode, 'status' => $status],
            $ipAddress,
            $userAgent,
        );

        return [
            'public_id' => $publicId,
            'tracking_code' => $trackingCode,
            'status' => $status,
            'sender_phone_masked' => Crypto::maskPhone($shipment->senderPhone),
            'recipient_phone_masked' => Crypto::maskPhone($shipment->recipientPhone),
            'cod_amount' => $shipment->codAmount,
            'total_freight_amount' => $pricing['total_freight_amount'],
            'version' => 1,
            'created_at' => $createdAt,
        ];
    }

    /**
     * @return list<array{public_id: string, transaction_type: string, expected_amount: string}>
     */
    private function codTransactions(CreateShipmentDto $shipment, string $totalFreightAmount): array
    {
        $transactions = [];
        if (bccomp($shipment->codAmount, '0.00', 2) > 0) {
            $transactions[] = [
                'public_id' => UlidGenerator::generate(),
                'transaction_type' => 'cod_recipient',
                'expected_amount' => $shipment->codAmount,
            ];
        }
        if ($shipment->paymentMethod === 'nntn') {
            $transactions[] = [
                'public_id' => UlidGenerator::generate(),
                'transaction_type' => 'freight_nntn_recipient',
                'expected_amount' => $totalFreightAmount,
            ];
        }

        return $transactions;
    }

    private function findLockedShipment(string $identifier): array
    {
        $shipment = $this->shipmentRepository->findForUpdate($identifier);
        if ($shipment === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy vận đơn.');
        }

        return $shipment;
    }

    /**
     * @param array<string, mixed> $shipment
     * @param array<string, mixed> $scopeContext
     */
    private function assertShipmentScope(array $shipment, array $scopeContext): void
    {
        $branchId = $shipment['current_branch_id'] === null
            ? (int) $shipment['origin_branch_id']
            : (int) $shipment['current_branch_id'];
        ScopeGuard::assertBranchAccess($scopeContext, $branchId);
    }

    /**
     * @param array<string, mixed> $scopeContext
     */
    private function activeBranchId(array $scopeContext): int
    {
        $branchId = filter_var($scopeContext['active_branch_id'] ?? null, FILTER_VALIDATE_INT);
        if ($branchId === false || $branchId < 1) {
            throw new ApiException('403_BRANCH_SCOPE', 'Thiếu chi nhánh đang làm việc hợp lệ.');
        }

        return $branchId;
    }
}
