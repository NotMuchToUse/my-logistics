<?php

declare(strict_types=1);

namespace App\Modules\IncidentCompensation\Repositories;

use App\Core\ApiException;
use App\Core\BaseRepository;
use App\Core\ScopeGuard;
use PDO;

final class ShipmentIncidentRepository extends BaseRepository
{
    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginate(array $filters, array $scopeContext): array
    {
        $parameters = [];
        $conditions = ['1 = 1'];
        $conditions[] = ScopeGuard::buildBranchWhereClause($scopeContext, 'si.branch_id', $parameters);

        if (!empty($filters['status'])) {
            $conditions[] = 'si.status = :status';
            $parameters[':status'] = $filters['status'];
        }
        if (!empty($filters['incident_type'])) {
            $conditions[] = 'si.incident_type = :incident_type';
            $parameters[':incident_type'] = $filters['incident_type'];
        }
        if (!empty($filters['severity'])) {
            $conditions[] = 'si.severity = :severity';
            $parameters[':severity'] = $filters['severity'];
        }
        if (!empty($filters['tracking_code'])) {
            $conditions[] = 's.tracking_code = :tracking_code';
            $parameters[':tracking_code'] = $filters['tracking_code'];
        }

        $where = implode(' AND ', $conditions);
        $countStmt = $this->pdo->prepare(
            'SELECT COUNT(*)
             FROM shipment_incidents si
             INNER JOIN shipments s ON s.id = si.shipment_id
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
            'SELECT si.public_id, si.incident_code, si.branch_id, si.incident_type, si.severity,
                    si.description, si.evidence_urls, si.responsible_user_id, si.status,
                    si.resolution_note, si.reported_by, si.resolved_by, si.resolved_at,
                    si.created_at, si.updated_at,
                    s.public_id AS shipment_public_id, s.tracking_code, s.status AS shipment_status,
                    s.recipient_name, s.recipient_phone_masked,
                    b.name AS branch_name,
                    rep.full_name AS reported_by_name,
                    resp.full_name AS responsible_user_name,
                    resv.full_name AS resolved_by_name
             FROM shipment_incidents si
             INNER JOIN shipments s ON s.id = si.shipment_id
             INNER JOIN branches b ON b.id = si.branch_id
             LEFT JOIN users rep ON rep.id = si.reported_by
             LEFT JOIN users resp ON resp.id = si.responsible_user_id
             LEFT JOIN users resv ON resv.id = si.resolved_by
             WHERE ' . $where . '
             ORDER BY si.created_at DESC, si.id DESC
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
            $item['reported_by'] = (int) $item['reported_by'];
            $item['responsible_user_id'] = $item['responsible_user_id'] === null ? null : (int) $item['responsible_user_id'];
            $item['resolved_by'] = $item['resolved_by'] === null ? null : (int) $item['resolved_by'];
            $item['evidence_urls'] = $this->decodeJsonArray($item['evidence_urls']);
        }
        unset($item);

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByIdentifier(string $identifier, bool $forUpdate = false): ?array
    {
        if ($forUpdate and !$this->pdo->inTransaction()) {
            throw new ApiException('500_INTERNAL_ERROR', 'Khóa sự cố vận đơn cần thực hiện trong transaction.');
        }

        $isPublicId = preg_match('/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i', $identifier) === 1;
        $column = $isPublicId ? 'si.public_id' : 'si.incident_code';

        $stmt = $this->pdo->prepare(
            'SELECT si.*,
                    s.public_id AS shipment_public_id, s.tracking_code, s.status AS shipment_status,
                    s.origin_branch_id, s.destination_branch_id, s.current_branch_id,
                    s.recipient_name, s.recipient_phone_masked,
                    b.name AS branch_name,
                    rep.full_name AS reported_by_name,
                    resp.full_name AS responsible_user_name,
                    resv.full_name AS resolved_by_name
             FROM shipment_incidents si
             INNER JOIN shipments s ON s.id = si.shipment_id
             INNER JOIN branches b ON b.id = si.branch_id
             LEFT JOIN users rep ON rep.id = si.reported_by
             LEFT JOIN users resp ON resp.id = si.responsible_user_id
             LEFT JOIN users resv ON resv.id = si.resolved_by
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

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO shipment_incidents
                (public_id, incident_code, shipment_id, branch_id, incident_type, severity,
                 description, evidence_urls, responsible_user_id, status, reported_by, created_at, updated_at)
             VALUES
                (:public_id, :incident_code, :shipment_id, :branch_id, :incident_type, :severity,
                 :description, :evidence_urls, :responsible_user_id, :status, :reported_by, NOW(), NOW())',
        );
        $stmt->execute([
            ':public_id' => $data['public_id'],
            ':incident_code' => $data['incident_code'],
            ':shipment_id' => $data['shipment_id'],
            ':branch_id' => $data['branch_id'],
            ':incident_type' => $data['incident_type'],
            ':severity' => $data['severity'],
            ':description' => $data['description'],
            ':evidence_urls' => $data['evidence_urls'] === [] ? null : json_encode($data['evidence_urls'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':responsible_user_id' => $data['responsible_user_id'],
            ':status' => 'reported',
            ':reported_by' => $data['reported_by'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @param array<string, mixed> $updates
     */
    public function update(int $id, array $updates, ?int $resolvedBy = null, bool $markResolved = false): void
    {
        $sets = ['updated_at = NOW()'];
        $params = [':id' => $id];

        foreach ($updates as $column => $value) {
            if ($column === 'evidence_urls') {
                $sets[] = 'evidence_urls = :evidence_urls';
                $params[':evidence_urls'] = $value === [] ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                $sets[] = "{$column} = :{$column}";
                $params[':' . $column] = $value;
            }
        }

        if ($markResolved) {
            $sets[] = 'resolved_by = :resolved_by';
            $sets[] = 'resolved_at = NOW()';
            $params[':resolved_by'] = $resolvedBy;
        }

        $stmt = $this->pdo->prepare('UPDATE shipment_incidents SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $stmt->execute($params);
    }

    public function delete(int $id): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM shipment_incidents WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }

    public function countOpenIncidentsForShipment(int $shipmentId, ?int $excludeIncidentId = null): int
    {
        $sql = "SELECT COUNT(*) FROM shipment_incidents WHERE shipment_id = :shipment_id AND status IN ('reported', 'investigating')";
        $params = [':shipment_id' => $shipmentId];
        if ($excludeIncidentId !== null) {
            $sql .= ' AND id <> :exclude_id';
            $params[':exclude_id'] = $excludeIncidentId;
        }
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    }

    public function assertUserExists(int $userId): void
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM users WHERE id = :id AND is_active = 1 LIMIT 1');
        $stmt->execute([':id' => $userId]);
        if ($stmt->fetchColumn() === false) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Nhân sự chịu trách nhiệm không tồn tại hoặc đã ngừng hoạt động.',
                ['responsible_user_id' => ['Nhân sự không hợp lệ.']],
            );
        }
    }

    /**
     * @param array<string, mixed> $oldValues
     * @param array<string, mixed> $newValues
     */
    public function createAuditLog(
        ?int $userId,
        ?int $branchId,
        string $action,
        string $tableName,
        int $recordId,
        array $oldValues,
        array $newValues,
        string $ipAddress,
        ?string $userAgent,
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO audit_logs
                (user_id, branch_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
             VALUES
                (:user_id, :branch_id, :action, :table_name, :record_id, :old_values, :new_values, :ip_address, :user_agent, NOW())',
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':branch_id' => $branchId,
            ':action' => $action,
            ':table_name' => $tableName,
            ':record_id' => $recordId,
            ':old_values' => $oldValues === [] ? null : json_encode($oldValues, JSON_UNESCAPED_UNICODE),
            ':new_values' => $newValues === [] ? null : json_encode($newValues, JSON_UNESCAPED_UNICODE),
            ':ip_address' => $ipAddress,
            ':user_agent' => $userAgent,
        ]);
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