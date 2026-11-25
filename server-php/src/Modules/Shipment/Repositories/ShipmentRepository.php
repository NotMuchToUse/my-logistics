<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Repositories;

use App\Core\ApiException;
use App\Core\BaseRepository;
use App\Core\Crypto;
use App\Core\ScopeGuard;
use App\Modules\Shipment\DTOs\ShipmentFilterDto;
use PDO;

final class ShipmentRepository extends BaseRepository
{
    /**
     * @param array<string, mixed> $shipment
     */
    public function createShipment(array $shipment): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO shipments
                (public_id, tracking_code, shipment_type, parent_shipment_id, pickup_request_id, customer_id,
                 origin_branch_id, destination_branch_id, current_branch_id, current_warehouse_id,
                 assigned_driver_id, service_type_id, cargo_category_id,
                 sender_name, sender_phone_encrypted, sender_phone_hash, sender_phone_masked,
                 sender_province_id, sender_district_id, sender_ward_id, sender_address,
                 recipient_name, recipient_phone_encrypted, recipient_phone_hash, recipient_phone_masked,
                 recipient_province_id, recipient_district_id, recipient_ward_id, recipient_address,
                 parcel_count, total_actual_weight_gram, total_volumetric_weight_gram, chargeable_weight_gram,
                 declared_value, payment_method, is_counter_freight_paid,
                 base_freight_amount, surcharge_amount, vas_amount, vat_amount, total_freight_amount,
                 cod_amount, is_priority, status, version, created_by, updated_by)
             VALUES
                (:public_id, :tracking_code, :shipment_type, :parent_shipment_id, :pickup_request_id, :customer_id,
                 :origin_branch_id, :destination_branch_id, :current_branch_id, :current_warehouse_id,
                 :assigned_driver_id, :service_type_id, :cargo_category_id,
                 :sender_name, :sender_phone_encrypted, :sender_phone_hash, :sender_phone_masked,
                 :sender_province_id, :sender_district_id, :sender_ward_id, :sender_address,
                 :recipient_name, :recipient_phone_encrypted, :recipient_phone_hash, :recipient_phone_masked,
                 :recipient_province_id, :recipient_district_id, :recipient_ward_id, :recipient_address,
                 :parcel_count, :total_actual_weight_gram, :total_volumetric_weight_gram, :chargeable_weight_gram,
                 :declared_value, :payment_method, :is_counter_freight_paid,
                 :base_freight_amount, :surcharge_amount, :vas_amount, :vat_amount, :total_freight_amount,
                 :cod_amount, :is_priority, :status, :version, :created_by, :updated_by)',
        );
        $statement->execute($shipment);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @param list<array{
     *     parcel_index: int,
     *     parcel_barcode: string,
     *     length_cm: string,
     *     width_cm: string,
     *     height_cm: string,
     *     actual_weight_gram: int,
     *     volumetric_weight_gram: int,
     *     chargeable_weight_gram: int,
     *     description: string|null
     * }> $parcels
     */
    public function createParcels(int $shipmentId, array $parcels): void
    {
        if ($parcels === []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Vận đơn phải có ít nhất một kiện hàng.');
        }

        $valueGroups = [];
        $parameters = [];
        foreach ($parcels as $index => $parcel) {
            $names = [];
            foreach ($parcel as $column => $value) {
                $parameter = ':parcel_' . $index . '_' . $column;
                $names[] = $parameter;
                $parameters[$parameter] = $value;
            }
            $valueGroups[] = '( :shipment_id_' . $index . ', ' . implode(', ', $names) . ', NOW())';
            $parameters[':shipment_id_' . $index] = $shipmentId;
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO shipment_parcels
                (shipment_id, parcel_index, parcel_barcode, length_cm, width_cm, height_cm,
                 actual_weight_gram, volumetric_weight_gram, chargeable_weight_gram, description, created_at)
             VALUES ' . implode(', ', $valueGroups),
        );
        $statement->execute($parameters);
    }

    /**
     * @param list<array{vas_id: int, vas_code_snapshot: string, vas_name_snapshot: string, fee_amount: string}> $snapshots
     */
    public function createVasSnapshots(int $shipmentId, array $snapshots): void
    {
        if ($snapshots === []) {
            return;
        }

        $valueGroups = [];
        $parameters = [];
        foreach ($snapshots as $index => $snapshot) {
            $valueGroups[] = '(:shipment_id_' . $index . ', :vas_id_' . $index . ', :vas_code_' . $index .
                ', :vas_name_' . $index . ', :vas_fee_' . $index . ', NOW())';
            $parameters[':shipment_id_' . $index] = $shipmentId;
            $parameters[':vas_id_' . $index] = $snapshot['vas_id'];
            $parameters[':vas_code_' . $index] = $snapshot['vas_code_snapshot'];
            $parameters[':vas_name_' . $index] = $snapshot['vas_name_snapshot'];
            $parameters[':vas_fee_' . $index] = $snapshot['fee_amount'];
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO shipment_vas
                (shipment_id, vas_id, vas_code_snapshot, vas_name_snapshot, fee_amount, created_at)
             VALUES ' . implode(', ', $valueGroups),
        );
        $statement->execute($parameters);
    }

    /**
     * @param list<array{surcharge_id: int, surcharge_code_snapshot: string, surcharge_name_snapshot: string, fee_amount: string}> $snapshots
     */
    public function createSurchargeSnapshots(int $shipmentId, array $snapshots): void
    {
        if ($snapshots === []) {
            return;
        }

        $valueGroups = [];
        $parameters = [];
        foreach ($snapshots as $index => $snapshot) {
            $valueGroups[] = '(:shipment_id_' . $index . ', :surcharge_id_' . $index . ', :surcharge_code_' . $index .
                ', :surcharge_name_' . $index . ', :surcharge_fee_' . $index . ', NOW())';
            $parameters[':shipment_id_' . $index] = $shipmentId;
            $parameters[':surcharge_id_' . $index] = $snapshot['surcharge_id'];
            $parameters[':surcharge_code_' . $index] = $snapshot['surcharge_code_snapshot'];
            $parameters[':surcharge_name_' . $index] = $snapshot['surcharge_name_snapshot'];
            $parameters[':surcharge_fee_' . $index] = $snapshot['fee_amount'];
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO shipment_surcharges
                (shipment_id, surcharge_id, surcharge_code_snapshot, surcharge_name_snapshot, fee_amount, created_at)
             VALUES ' . implode(', ', $valueGroups),
        );
        $statement->execute($parameters);
    }

    /**
     * @param list<array{public_id: string, transaction_type: string, expected_amount: string}> $transactions
     */
    public function createCodTransactions(int $shipmentId, int $branchId, array $transactions): void
    {
        if ($transactions === []) {
            return;
        }

        $valueGroups = [];
        $parameters = [];
        foreach ($transactions as $index => $transaction) {
            $valueGroups[] = '(:public_id_' . $index . ', :shipment_id_' . $index . ', :branch_id_' . $index .
                ', :transaction_type_' . $index . ', :expected_amount_' . $index . ", 'pending', 1, NOW(), NOW())";
            $parameters[':public_id_' . $index] = $transaction['public_id'];
            $parameters[':shipment_id_' . $index] = $shipmentId;
            $parameters[':branch_id_' . $index] = $branchId;
            $parameters[':transaction_type_' . $index] = $transaction['transaction_type'];
            $parameters[':expected_amount_' . $index] = $transaction['expected_amount'];
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO cod_transactions
                (public_id, shipment_id, branch_id, transaction_type, expected_amount, status, version, created_at, updated_at)
             VALUES ' . implode(', ', $valueGroups),
        );
        $statement->execute($parameters);
    }

    public function createStatusHistory(
        int $shipmentId,
        ?string $fromStatus,
        string $toStatus,
        ?int $branchId,
        ?int $actorId,
        string $description,
        bool $isPublicVisible = true,
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO shipment_status_history
                (shipment_id, from_status, to_status, branch_id, actor_id, description, is_public_visible, occurred_at, created_at)
             VALUES
                (:shipment_id, :from_status, :to_status, :branch_id, :actor_id, :description, :is_public_visible, NOW(), NOW())',
        );
        $statement->execute([
            ':shipment_id' => $shipmentId,
            ':from_status' => $fromStatus,
            ':to_status' => $toStatus,
            ':branch_id' => $branchId,
            ':actor_id' => $actorId,
            ':description' => $description,
            ':is_public_visible' => $isPublicVisible ? 1 : 0,
        ]);
    }

    /**
     * @param array<string, mixed> $oldValues
     * @param array<string, mixed> $newValues
     */
    public function createAuditLog(
        ?int $userId,
        ?int $branchId,
        string $action,
        int $recordId,
        array $oldValues,
        array $newValues,
        string $ipAddress,
        ?string $userAgent,
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO audit_logs
                (user_id, branch_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
             VALUES
                (:user_id, :branch_id, :action, :table_name, :record_id, :old_values, :new_values, :ip_address, :user_agent, NOW())',
        );
        $statement->execute([
            ':user_id' => $userId,
            ':branch_id' => $branchId,
            ':action' => $action,
            ':table_name' => 'shipments',
            ':record_id' => $recordId,
            ':old_values' => $oldValues === [] ? null : json_encode($oldValues, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            ':new_values' => $newValues === [] ? null : json_encode($newValues, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            ':ip_address' => $ipAddress,
            ':user_agent' => $userAgent,
        ]);
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginate(ShipmentFilterDto $filters, array $scopeContext): array
    {
        $parameters = [];
        $conditions = ['s.deleted_at IS NULL'];
        $conditions[] = ScopeGuard::buildBranchWhereClause($scopeContext, 's.current_branch_id', $parameters);

        if ($filters->status !== null) {
            $conditions[] = 's.status = :status';
            $parameters[':status'] = $filters->status;
        }
        if ($filters->trackingCode !== null) {
            $conditions[] = 's.tracking_code = :tracking_code';
            $parameters[':tracking_code'] = $filters->trackingCode;
        }
        if ($filters->phone !== null) {
            $phoneHash = Crypto::hashPhone($filters->phone);
            $conditions[] = '(s.sender_phone_hash = :sender_phone_hash OR s.recipient_phone_hash = :recipient_phone_hash)';
            $parameters[':sender_phone_hash'] = $phoneHash;
            $parameters[':recipient_phone_hash'] = $phoneHash;
        }
        if ($filters->serviceTypeId !== null) {
            $conditions[] = 's.service_type_id = :service_type_id';
            $parameters[':service_type_id'] = $filters->serviceTypeId;
        }
        if ($filters->isPriority !== null) {
            $conditions[] = 's.is_priority = :is_priority';
            $parameters[':is_priority'] = $filters->isPriority ? 1 : 0;
        }
        if ($filters->fromDate !== null) {
            $conditions[] = 's.created_at >= :from_date';
            $parameters[':from_date'] = $filters->fromDate . ' 00:00:00';
        }
        if ($filters->toDate !== null) {
            $conditions[] = 's.created_at < DATE_ADD(:to_date, INTERVAL 1 DAY)';
            $parameters[':to_date'] = $filters->toDate . ' 00:00:00';
        }

        $where = implode(' AND ', $conditions);
        $countStatement = $this->pdo->prepare('SELECT COUNT(*) FROM shipments s WHERE ' . $where);
        $countStatement->execute($parameters);
        $total = (int) $countStatement->fetchColumn();
        if ($total === 0) {
            return ['items' => [], 'total' => 0];
        }

        $orderBy = $this->buildOrderBy(
            $filters->sortBy,
            $filters->sortDirection,
            [
                'created_at' => 's.created_at',
                'tracking_code' => 's.tracking_code',
                'cod_amount' => 's.cod_amount',
                'total_freight_amount' => 's.total_freight_amount',
            ],
            'created_at',
        );
        $statement = $this->pdo->prepare(
            'SELECT s.id AS shipment_internal_id, s.public_id, s.tracking_code, s.status,
                    s.sender_name, s.sender_phone_masked, s.recipient_name, s.recipient_phone_masked,
                    s.parcel_count, s.chargeable_weight_gram, s.cod_amount, s.total_freight_amount,
                    s.is_priority, s.version, s.created_at,
                    origin_branch.name AS origin_branch_name,
                    destination_branch.name AS destination_branch_name,
                    service_type.name AS service_type_name,
                    driver.full_name AS assigned_driver_name
             FROM shipments s
             INNER JOIN branches origin_branch ON origin_branch.id = s.origin_branch_id
             INNER JOIN branches destination_branch ON destination_branch.id = s.destination_branch_id
             INNER JOIN service_types service_type ON service_type.id = s.service_type_id
             LEFT JOIN users driver ON driver.id = s.assigned_driver_id
             WHERE ' . $where . '
             ORDER BY ' . $orderBy . '
             LIMIT :limit OFFSET :offset',
        );
        foreach ($parameters as $name => $value) {
            $statement->bindValue($name, $value);
        }
        $statement->bindValue(':limit', min(100, max(1, $filters->perPage)), PDO::PARAM_INT);
        $statement->bindValue(':offset', max(0, ($filters->page - 1) * min(100, max(1, $filters->perPage))), PDO::PARAM_INT);
        $statement->execute();
        $items = $statement->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$item) {
            unset($item['shipment_internal_id']);
            $item['parcel_count'] = (int) $item['parcel_count'];
            $item['chargeable_weight_gram'] = (int) $item['chargeable_weight_gram'];
            $item['is_priority'] = (bool) $item['is_priority'];
            $item['version'] = (int) $item['version'];
        }
        unset($item);

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByPublicIdOrTrackingCode(string $identifier): ?array
    {
        return $this->findByIdentifier($identifier, false);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findForUpdate(string $identifier): ?array
    {
        if (!$this->pdo->inTransaction()) {
            throw new ApiException('500_INTERNAL_ERROR', 'Khóa vận đơn cần được thực hiện trong transaction.');
        }

        return $this->findByIdentifier($identifier, true);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findByIdentifier(string $identifier, bool $forUpdate): ?array
    {
        $isPublicId = preg_match('/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i', $identifier) === 1;
        $column = $isPublicId ? 'public_id' : 'tracking_code';
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, tracking_code, shipment_type, parent_shipment_id, pickup_request_id, customer_id,
                    origin_branch_id, destination_branch_id, current_branch_id, current_warehouse_id,
                    assigned_driver_id, service_type_id, cargo_category_id,
                    sender_name, sender_phone_encrypted, sender_phone_hash, sender_phone_masked,
                    sender_province_id, sender_district_id, sender_ward_id, sender_address,
                    recipient_name, recipient_phone_encrypted, recipient_phone_hash, recipient_phone_masked,
                    recipient_province_id, recipient_district_id, recipient_ward_id, recipient_address,
                    parcel_count, total_actual_weight_gram, total_volumetric_weight_gram, chargeable_weight_gram,
                    declared_value, payment_method, is_counter_freight_paid,
                    base_freight_amount, surcharge_amount, vas_amount, vat_amount, total_freight_amount,
                    cod_amount, is_priority, status, version, note, created_at, updated_at, deleted_at
             FROM shipments
             WHERE ' . $column . ' = :identifier AND deleted_at IS NULL
             LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : ''),
        );
        $statement->execute([':identifier' => $identifier]);
        $shipment = $statement->fetch(PDO::FETCH_ASSOC);

        return $shipment === false ? null : $shipment;
    }

    public function assertCodTransactionsForwardable(int $shipmentId): void
    {
        $statement = $this->pdo->prepare(
            "SELECT COUNT(*)
             FROM cod_transactions
             WHERE shipment_id = :shipment_id
               AND status NOT IN ('pending', 'cancelled')",
        );
        $statement->execute([':shipment_id' => $shipmentId]);

        if ((int) $statement->fetchColumn() > 0) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Không thể chuyển tiếp vận đơn đã phát sinh thu hoặc quyết toán COD.',
                ['cod_transactions' => ['Các giao dịch COD phải còn ở trạng thái pending.']],
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findParcels(int $shipmentId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT parcel_index, parcel_barcode, length_cm, width_cm, height_cm,
                    actual_weight_gram, volumetric_weight_gram, chargeable_weight_gram, description
             FROM shipment_parcels
             WHERE shipment_id = :shipment_id
             ORDER BY parcel_index ASC',
        );
        $statement->execute([':shipment_id' => $shipmentId]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findVasSnapshots(int $shipmentId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT vas_id, vas_code_snapshot, vas_name_snapshot, fee_amount
             FROM shipment_vas
             WHERE shipment_id = :shipment_id
             ORDER BY id ASC',
        );
        $statement->execute([':shipment_id' => $shipmentId]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findSurchargeSnapshots(int $shipmentId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT surcharge_id, surcharge_code_snapshot, surcharge_name_snapshot, fee_amount
             FROM shipment_surcharges
             WHERE shipment_id = :shipment_id
             ORDER BY id ASC',
        );
        $statement->execute([':shipment_id' => $shipmentId]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findStatusHistory(int $shipmentId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT from_status, to_status, branch_id, warehouse_id, description,
                    evidence_image_url, latitude, longitude, is_public_visible, occurred_at
             FROM shipment_status_history
             WHERE shipment_id = :shipment_id
             ORDER BY occurred_at ASC, id ASC',
        );
        $statement->execute([':shipment_id' => $shipmentId]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findCodTransactions(int $shipmentId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT public_id, transaction_type, expected_amount, collected_amount, status, version, created_at
             FROM cod_transactions
             WHERE shipment_id = :shipment_id
             ORDER BY id ASC',
        );
        $statement->execute([':shipment_id' => $shipmentId]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findPrintLogs(int $shipmentId): array
    {
        $statement = $this->pdo->prepare(
            "SELECT document_type, print_count, ip_address, printed_at
             FROM print_logs
             WHERE reference_table = 'shipments' AND reference_id = :reference_id
             ORDER BY printed_at DESC",
        );
        $statement->execute([':reference_id' => $shipmentId]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function updatePriority(int $shipmentId, int $version, bool $isPriority, ?int $userId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE shipments
             SET is_priority = :is_priority,
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id AND version = :version AND deleted_at IS NULL',
        );
        $statement->execute([
            ':is_priority' => $isPriority ? 1 : 0,
            ':updated_by' => $userId,
            ':id' => $shipmentId,
            ':version' => $version,
        ]);
        $this->assertOptimisticLock($statement);
    }

    public function cancelShipment(int $shipmentId, int $version, ?string $reason, ?int $userId): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE shipments
             SET status = 'cancelled',
                 cancelled_at = NOW(),
                 cancel_reason = :cancel_reason,
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id
               AND version = :version
               AND status IN ('draft', 'pending_pickup')
               AND deleted_at IS NULL",
        );
        $statement->execute([
            ':cancel_reason' => $reason,
            ':updated_by' => $userId,
            ':id' => $shipmentId,
            ':version' => $version,
        ]);
        $this->assertOptimisticLock($statement);
    }

    public function cancelPendingCodTransactions(int $shipmentId): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE cod_transactions
             SET status = 'cancelled', version = version + 1, updated_at = NOW()
             WHERE shipment_id = :shipment_id AND status = 'pending'",
        );
        $statement->execute([':shipment_id' => $shipmentId]);
    }

    public function createPrintLog(
        int $userId,
        int $branchId,
        string $documentType,
        int $shipmentId,
        int $printCount,
        string $ipAddress,
    ): void {
        $statement = $this->pdo->prepare(
            "INSERT INTO print_logs
                (user_id, branch_id, document_type, reference_table, reference_id, print_count, ip_address, printed_at)
             VALUES
                (:user_id, :branch_id, :document_type, 'shipments', :reference_id, :print_count, :ip_address, NOW())",
        );
        $statement->execute([
            ':user_id' => $userId,
            ':branch_id' => $branchId,
            ':document_type' => $documentType,
            ':reference_id' => $shipmentId,
            ':print_count' => $printCount,
            ':ip_address' => $ipAddress,
        ]);
    }
}
