<?php

declare(strict_types=1);

namespace App\Modules\IncidentCompensation\Repositories;

use App\Core\ApiException;
use App\Core\BaseRepository;
use App\Core\ScopeGuard;
use PDO;

final class ReturnAndApprovalRepository extends BaseRepository
{
    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginatePendingReturns(array $filters, array $scopeContext): array
    {
        $parameters = [];
        $includeFailed = filter_var($filters['include_failed'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $conditions = [
            's.deleted_at IS NULL',
            $includeFailed
                ? "s.status IN ('pending_return', 'delivery_failed')"
                : "s.status = 'pending_return'",
        ];
        $conditions[] = ScopeGuard::buildBranchWhereClause($scopeContext, 's.current_branch_id', $parameters);

        if (!empty($filters['tracking_code'])) {
            $conditions[] = 's.tracking_code = :tracking_code';
            $parameters[':tracking_code'] = $filters['tracking_code'];
        }

        $where = implode(' AND ', $conditions);
        $countStmt = $this->pdo->prepare('SELECT COUNT(*) FROM shipments s WHERE ' . $where);
        $countStmt->execute($parameters);
        $total = (int) $countStmt->fetchColumn();

        if ($total === 0) {
            return ['items' => [], 'total' => 0];
        }

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $offset = ($page - 1) * $perPage;

        $stmt = $this->pdo->prepare(
            "SELECT s.public_id, s.tracking_code, s.shipment_type, s.status,
                    s.sender_name, s.sender_phone_masked, s.sender_address,
                    s.recipient_name, s.recipient_phone_masked, s.recipient_address,
                    s.origin_branch_id, s.destination_branch_id, s.current_branch_id,
                    s.parcel_count, s.chargeable_weight_gram, s.cod_amount, s.total_freight_amount,
                    s.delivery_attempt_count, s.storage_deadline, s.version, s.updated_at,
                    ob.name AS origin_branch_name,
                    cb.name AS current_branch_name,
                    st.name AS service_type_name,
                    (SELECT child.tracking_code
                     FROM shipments child
                     WHERE child.parent_shipment_id = s.id
                       AND child.shipment_type = 'return_shipment'
                       AND child.status <> 'cancelled'
                       AND child.deleted_at IS NULL
                     ORDER BY child.id DESC LIMIT 1) AS return_tracking_code
             FROM shipments s
             INNER JOIN branches ob ON ob.id = s.origin_branch_id
             LEFT JOIN branches cb ON cb.id = s.current_branch_id
             INNER JOIN service_types st ON st.id = s.service_type_id
             WHERE {$where}
             ORDER BY s.storage_deadline ASC, s.updated_at ASC
             LIMIT :limit OFFSET :offset",
        );
        foreach ($parameters as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            $item['parcel_count'] = (int) $item['parcel_count'];
            $item['chargeable_weight_gram'] = (int) $item['chargeable_weight_gram'];
            $item['delivery_attempt_count'] = (int) $item['delivery_attempt_count'];
            $item['version'] = (int) $item['version'];
        }
        unset($item);

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findActiveReturnShipmentByParentId(int $parentShipmentId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT id, public_id, tracking_code, status
             FROM shipments
             WHERE parent_shipment_id = :parent_id
               AND shipment_type = 'return_shipment'
               AND status <> 'cancelled'
               AND deleted_at IS NULL
             LIMIT 1",
        );
        $stmt->execute([':parent_id' => $parentShipmentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @param array<string, mixed> $columns
     */
    public function updateShipmentState(int $shipmentId, int $expectedVersion, array $columns, ?int $actorId): void
    {
        $sets = [
            'version = version + 1',
            'updated_by = :updated_by',
            'updated_at = NOW()',
        ];
        $params = [
            ':id' => $shipmentId,
            ':version' => $expectedVersion,
            ':updated_by' => $actorId,
        ];

        foreach ($columns as $col => $val) {
            $sets[] = "{$col} = :{$col}";
            $params[':' . $col] = $val;
        }

        $stmt = $this->pdo->prepare(
            'UPDATE shipments SET ' . implode(', ', $sets) . ' WHERE id = :id AND version = :version AND deleted_at IS NULL',
        );
        $stmt->execute($params);
        $this->assertOptimisticLock($stmt);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findCodTransactionsForUpdate(int $shipmentId): array
    {
        if (!$this->pdo->inTransaction()) {
            throw new ApiException('500_INTERNAL_ERROR', 'Khóa giao dịch COD cần thực hiện trong transaction.');
        }

        $stmt = $this->pdo->prepare(
            'SELECT id, public_id, transaction_type, expected_amount, collected_amount, status, version
             FROM cod_transactions
             WHERE shipment_id = :shipment_id
             FOR UPDATE',
        );
        $stmt->execute([':shipment_id' => $shipmentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function cancelUnsettledCodTransactions(int $shipmentId): int
    {
        $stmt = $this->pdo->prepare(
            "UPDATE cod_transactions
             SET status = 'cancelled',
                 version = version + 1,
                 updated_at = NOW()
             WHERE shipment_id = :shipment_id
               AND status IN ('pending', 'driver_holding', 'collected_by_branch')",
        );
        $stmt->execute([':shipment_id' => $shipmentId]);

        return $stmt->rowCount();
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateApprovalRequests(array $filters, array $scopeContext): array
    {
        $parameters = [];
        $conditions = ['1 = 1'];
        $conditions[] = ScopeGuard::buildBranchWhereClause($scopeContext, 'ar.branch_id', $parameters);

        if (!empty($filters['status'])) {
            $conditions[] = 'ar.status = :status';
            $parameters[':status'] = $filters['status'];
        }
        if (!empty($filters['approval_type'])) {
            $conditions[] = 'ar.approval_type = :approval_type';
            $parameters[':approval_type'] = $filters['approval_type'];
        }
        if (!empty($filters['tracking_code'])) {
            $conditions[] = 's.tracking_code = :tracking_code';
            $parameters[':tracking_code'] = $filters['tracking_code'];
        }

        $where = implode(' AND ', $conditions);
        $countStmt = $this->pdo->prepare(
            'SELECT COUNT(*)
             FROM shipment_approval_requests ar
             INNER JOIN shipments s ON s.id = ar.shipment_id
             WHERE ' . $where,
        );
        $countStmt->execute($parameters);
        $total = (int) $countStmt->fetchColumn();

        if ($total === 0) {
            return ['items' => [], 'total' => 0];
        }

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $offset = ($page - 1) * $perPage;

        $stmt = $this->pdo->prepare(
            'SELECT ar.public_id, ar.request_code, ar.branch_id, ar.approval_type,
                    ar.reason, ar.evidence_urls, ar.status, ar.requested_by,
                    ar.reviewed_by, ar.reviewed_at, ar.review_note, ar.version,
                    ar.created_at, ar.updated_at,
                    s.public_id AS shipment_public_id, s.tracking_code, s.status AS shipment_status,
                    s.cod_amount, s.total_freight_amount, s.delivered_at,
                    b.name AS branch_name,
                    req_u.full_name AS requested_by_name,
                    rev_u.full_name AS reviewed_by_name
             FROM shipment_approval_requests ar
             INNER JOIN shipments s ON s.id = ar.shipment_id
             INNER JOIN branches b ON b.id = ar.branch_id
             LEFT JOIN users req_u ON req_u.id = ar.requested_by
             LEFT JOIN users rev_u ON rev_u.id = ar.reviewed_by
             WHERE ' . $where . '
             ORDER BY FIELD(ar.status, \'pending\', \'approved\', \'rejected\'), ar.created_at DESC
             LIMIT :limit OFFSET :offset',
        );
        foreach ($parameters as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            $item['branch_id'] = (int) $item['branch_id'];
            $item['requested_by'] = (int) $item['requested_by'];
            $item['reviewed_by'] = $item['reviewed_by'] === null ? null : (int) $item['reviewed_by'];
            $item['version'] = (int) $item['version'];
            $item['evidence_urls'] = $this->decodeJsonArray($item['evidence_urls']);
        }
        unset($item);

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findApprovalByIdentifier(string $identifier, bool $forUpdate = false): ?array
    {
        if ($forUpdate and !$this->pdo->inTransaction()) {
            throw new ApiException('500_INTERNAL_ERROR', 'Khóa yêu cầu phê duyệt cần thực hiện trong transaction.');
        }

        $isPublicId = preg_match('/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i', $identifier) === 1;
        $column = $isPublicId ? 'ar.public_id' : 'ar.request_code';

        $stmt = $this->pdo->prepare(
            'SELECT ar.*,
                    s.public_id AS shipment_public_id, s.tracking_code, s.status AS shipment_status,
                    s.cod_amount, s.total_freight_amount, s.delivered_at, s.version AS shipment_version,
                    b.name AS branch_name,
                    req_u.full_name AS requested_by_name,
                    rev_u.full_name AS reviewed_by_name
             FROM shipment_approval_requests ar
             INNER JOIN shipments s ON s.id = ar.shipment_id
             INNER JOIN branches b ON b.id = ar.branch_id
             LEFT JOIN users req_u ON req_u.id = ar.requested_by
             LEFT JOIN users rev_u ON rev_u.id = ar.reviewed_by
             WHERE ' . $column . ' = :identifier
             LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : ''),
        );
        $stmt->execute([':identifier' => $identifier]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            return null;
        }

        $row['evidence_urls'] = $this->decodeJsonArray($row['evidence_urls']);
        return $row;
    }

    public function hasPendingApproval(int $shipmentId, string $approvalType): bool
    {
        $stmt = $this->pdo->prepare(
            "SELECT 1
             FROM shipment_approval_requests
             WHERE shipment_id = :shipment_id
               AND approval_type = :approval_type
               AND status = 'pending'
             LIMIT 1",
        );
        $stmt->execute([
            ':shipment_id' => $shipmentId,
            ':approval_type' => $approvalType,
        ]);

        return $stmt->fetchColumn() !== false;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function createApprovalRequest(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO shipment_approval_requests
                (public_id, request_code, shipment_id, branch_id, approval_type,
                 reason, evidence_urls, status, requested_by, version, created_at, updated_at)
             VALUES
                (:public_id, :request_code, :shipment_id, :branch_id, :approval_type,
                 :reason, :evidence_urls, :status, :requested_by, 1, NOW(), NOW())',
        );
        $stmt->execute([
            ':public_id' => $data['public_id'],
            ':request_code' => $data['request_code'],
            ':shipment_id' => $data['shipment_id'],
            ':branch_id' => $data['branch_id'],
            ':approval_type' => $data['approval_type'],
            ':reason' => $data['reason'],
            ':evidence_urls' => $data['evidence_urls'] === [] ? null : json_encode($data['evidence_urls'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':status' => 'pending',
            ':requested_by' => $data['requested_by'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function reviewApprovalRequest(
        int $id,
        int $expectedVersion,
        string $status,
        int $reviewedBy,
        ?string $reviewNote,
    ): void {
        $stmt = $this->pdo->prepare(
            "UPDATE shipment_approval_requests
             SET status = :status,
                 reviewed_by = :reviewed_by,
                 reviewed_at = NOW(),
                 review_note = :review_note,
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = :id
               AND version = :version
               AND status = 'pending'",
        );
        $stmt->execute([
            ':status' => $status,
            ':reviewed_by' => $reviewedBy,
            ':review_note' => $reviewNote,
            ':id' => $id,
            ':version' => $expectedVersion,
        ]);
        $this->assertOptimisticLock($stmt);
    }

    /**
     * @return list<string>
     */
    private function decodeJsonArray(mixed $raw): array
    {
        if (!is_string($raw) or (trim($raw) === '')) {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : [];
    }
}