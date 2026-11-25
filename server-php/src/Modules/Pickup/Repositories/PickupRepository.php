<?php

declare(strict_types=1);

namespace App\Modules\Pickup\Repositories;

use App\Core\ApiException;
use App\Core\Crypto;
use App\Core\Database;
use App\Core\ScopeGuard;
use App\Core\UlidGenerator;
use PDO;

final class PickupRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginate(array $filters, array $scopeContext, int $page, int $perPage): array
    {
        $params = [];
        $where = [
            ScopeGuard::applyBranchFilter($scopeContext, 'pr.branch_id', $params),
        ];

        if (!empty($filters['branch_id'])) {
            $requestedBranchId = (int) $filters['branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $requestedBranchId);
            $where[] = 'pr.branch_id = :filter_branch_id';
            $params[':filter_branch_id'] = $requestedBranchId;
        }
        if (!empty($filters['status'])) {
            $where[] = 'pr.status = :status';
            $params[':status'] = (string) $filters['status'];
        }
        if (!empty($filters['pickup_mode'])) {
            $where[] = 'pr.pickup_mode = :pickup_mode';
            $params[':pickup_mode'] = (string) $filters['pickup_mode'];
        }
        if (!empty($filters['assigned_driver_id'])) {
            $where[] = 'pr.assigned_driver_id = :assigned_driver_id';
            $params[':assigned_driver_id'] = (int) $filters['assigned_driver_id'];
        }
        if (!empty($filters['sla_alert'])) {
            $alert = (string) $filters['sla_alert'];
            if ($alert === 'breached') {
                $where[] = "pr.status IN ('pending', 'assigned', 'accepted') AND pr.sla_deadline_at < NOW()";
            } elseif ($alert === 'warning') {
                $where[] = "pr.status IN ('pending', 'assigned', 'accepted') AND pr.sla_deadline_at >= NOW() AND pr.sla_deadline_at <= DATE_ADD(NOW(), INTERVAL 30 MINUTE)";
            } elseif ($alert === 'at_risk') {
                $where[] = "pr.status IN ('pending', 'assigned', 'accepted') AND pr.sla_deadline_at <= DATE_ADD(NOW(), INTERVAL 30 MINUTE)";
            }
        }
        if (!empty($filters['search'])) {
            $kw = '%' . trim((string) $filters['search']) . '%';
            $where[] = '(pr.request_code LIKE :search1 OR pr.sender_name LIKE :search2 OR pr.sender_phone_masked LIKE :search3 OR pr.pickup_address LIKE :search4 OR drv.full_name LIKE :search5)';
            $params[':search1'] = $kw;
            $params[':search2'] = $kw;
            $params[':search3'] = $kw;
            $params[':search4'] = $kw;
            $params[':search5'] = $kw;
        }
        if (!empty($filters['request_code'])) {
            $where[] = 'pr.request_code LIKE :request_code';
            $params[':request_code'] = '%' . trim((string) $filters['request_code']) . '%';
        }
        if (!empty($filters['phone'])) {
            $where[] = 'pr.sender_phone_hash = :sender_phone_hash';
            $params[':sender_phone_hash'] = Crypto::hashPhone((string) $filters['phone']);
        }
        if (!empty($filters['from_date'])) {
            $where[] = 'DATE(pr.created_at) >= :from_date';
            $params[':from_date'] = (string) $filters['from_date'];
        }
        if (!empty($filters['to_date'])) {
            $where[] = 'DATE(pr.created_at) <= :to_date';
            $params[':to_date'] = (string) $filters['to_date'];
        }

        $whereSql = implode(' AND ', $where);
        $countStmt = $this->pdo->prepare(
            "SELECT COUNT(*)
             FROM pickup_requests pr
             INNER JOIN branches b ON b.id = pr.branch_id
             LEFT JOIN users drv ON drv.id = pr.assigned_driver_id
             WHERE {$whereSql}"
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT pr.*,
                       b.public_id AS branch_public_id, b.code AS branch_code, b.name AS branch_name,
                       drv.public_id AS driver_public_id, drv.employee_code AS driver_code,
                       drv.full_name AS driver_name, drv.phone_masked AS driver_phone_masked,
                       TIMESTAMPDIFF(MINUTE, NOW(), pr.sla_deadline_at) AS minutes_remaining,
                       CASE
                           WHEN pr.status IN ('pending', 'assigned', 'accepted') AND pr.sla_deadline_at < NOW() THEN 1
                           ELSE 0
                       END AS is_sla_breached,
                       CASE
                           WHEN pr.status IN ('pending', 'assigned', 'accepted')
                                AND pr.sla_deadline_at >= NOW()
                                AND pr.sla_deadline_at <= DATE_ADD(NOW(), INTERVAL 30 MINUTE) THEN 1
                           ELSE 0
                       END AS is_sla_warning
                FROM pickup_requests pr
                INNER JOIN branches b ON b.id = pr.branch_id
                LEFT JOIN users drv ON drv.id = pr.assigned_driver_id
                WHERE {$whereSql}
                ORDER BY is_sla_breached DESC, is_sla_warning DESC, pr.sla_deadline_at ASC, pr.id DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $items[] = $this->formatPickupRow($row, false);
        }

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createRequest(
        array $data,
        array $scopeContext,
        int $actorId,
        string $ip,
        ?string $userAgent
    ): array {
        return Database::transaction(function () use ($data, $scopeContext, $actorId, $ip, $userAgent): array {
            $branchId = (int) ($data['branch_id'] ?? ($scopeContext['active_branch_id'] ?? 0));
            if ($branchId < 1) {
                throw new ApiException('422_VALIDATION_ERROR', 'Vui lòng chọn bưu cục tiếp nhận.', ['branch_id' => ['Bưu cục là bắt buộc']], 422);
            }
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            $bStmt = $this->pdo->prepare('SELECT id FROM branches WHERE id = :id AND is_active = 1 AND deleted_at IS NULL LIMIT 1');
            $bStmt->execute([':id' => $branchId]);
            if ($bStmt->fetchColumn() === false) {
                throw new ApiException('422_VALIDATION_ERROR', 'Bưu cục không tồn tại hoặc ngừng hoạt động.', ['branch_id' => ['Bưu cục không hợp lệ']], 422);
            }

            $pickupMode = (string) ($data['pickup_mode'] ?? 'driver_pickup');
            if (!in_array($pickupMode, ['driver_pickup', 'counter_dropoff'], true)) {
                throw new ApiException('422_VALIDATION_ERROR', 'Hình thức lấy hàng không hợp lệ.', ['pickup_mode' => ['pickup_mode không hợp lệ']], 422);
            }

            $phone = trim((string) $data['sender_phone']);
            $phoneHash = Crypto::hashPhone($phone);

            // Tự động liên kết customer_id nếu SĐT đã có hồ sơ khách hàng
            $cStmt = $this->pdo->prepare('SELECT id FROM customers WHERE phone_hash = :hash AND deleted_at IS NULL LIMIT 1');
            $cStmt->execute([':hash' => $phoneHash]);
            $customerIdRaw = $cStmt->fetchColumn();
            $customerId = $customerIdRaw !== false ? (int) $customerIdRaw : null;

            $slaStmt = $this->pdo->query('SELECT pickup_sla_minutes FROM sla_deadlines WHERE is_active = 1 ORDER BY id ASC LIMIT 1');
            $slaRaw = $slaStmt->fetchColumn();
            $slaMinutes = $slaRaw !== false ? max(30, (int) $slaRaw) : 120;

            $publicId = UlidGenerator::generate();
            $requestCode = 'PU' . date('ymd') . substr($publicId, -6);

            $stmt = $this->pdo->prepare(
                "INSERT INTO pickup_requests (
                    public_id, request_code, customer_id, branch_id, pickup_mode,
                    sender_name, sender_phone_encrypted, sender_phone_hash, sender_phone_masked,
                    province_id, district_id, ward_id, pickup_address, latitude, longitude,
                    estimated_parcel_count, estimated_weight_gram, note,
                    sla_deadline_at, status, version, created_by
                ) VALUES (
                    :public_id, :request_code, :customer_id, :branch_id, :pickup_mode,
                    :sender_name, :sender_phone_encrypted, :sender_phone_hash, :sender_phone_masked,
                    :province_id, :district_id, :ward_id, :pickup_address, :latitude, :longitude,
                    :estimated_parcel_count, :estimated_weight_gram, :note,
                    DATE_ADD(NOW(), INTERVAL {$slaMinutes} MINUTE), 'pending', 1, :created_by
                )"
            );
            $stmt->execute([
                ':public_id' => $publicId,
                ':request_code' => $requestCode,
                ':customer_id' => $customerId,
                ':branch_id' => $branchId,
                ':pickup_mode' => $pickupMode,
                ':sender_name' => trim((string) $data['sender_name']),
                ':sender_phone_encrypted' => Crypto::encrypt($phone),
                ':sender_phone_hash' => $phoneHash,
                ':sender_phone_masked' => Crypto::maskPhone($phone),
                ':province_id' => (int) $data['province_id'],
                ':district_id' => (int) $data['district_id'],
                ':ward_id' => (int) $data['ward_id'],
                ':pickup_address' => trim((string) $data['pickup_address']),
                ':latitude' => isset($data['latitude']) && $data['latitude'] !== '' ? (float) $data['latitude'] : null,
                ':longitude' => isset($data['longitude']) && $data['longitude'] !== '' ? (float) $data['longitude'] : null,
                ':estimated_parcel_count' => max(1, (int) ($data['estimated_parcel_count'] ?? 1)),
                ':estimated_weight_gram' => max(1, (int) ($data['estimated_weight_gram'] ?? 500)),
                ':note' => isset($data['note']) && trim((string) $data['note']) !== '' ? trim((string) $data['note']) : null,
                ':created_by' => $actorId,
            ]);

            $newId = (int) $this->pdo->lastInsertId();
            $this->writeAuditLog(
                $actorId,
                $branchId,
                'CREATE_PICKUP_REQUEST',
                'pickup_requests',
                $newId,
                null,
                ['request_code' => $requestCode, 'branch_id' => $branchId, 'status' => 'pending'],
                $ip,
                $userAgent
            );

            return $this->findDetail($publicId, $scopeContext);
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function findDetail(string $identifier, array $scopeContext): array
    {
        $row = $this->fetchRawPickup($identifier, false);
        ScopeGuard::assertBranchAccess($scopeContext, (int) $row['branch_id']);

        return $this->formatPickupRow($row, true);
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return list<array<string, mixed>>
     */
    public function listAvailableDrivers(array $scopeContext): array
    {
        $params = [];
        $scopeSql = ScopeGuard::applyBranchFilter($scopeContext, 'ubs.branch_id', $params);

        $sql = "SELECT DISTINCT u.id, u.public_id, u.employee_code, u.full_name, u.phone_masked,
                       MIN(ubs.branch_id) AS branch_id,
                       (
                           SELECT COUNT(*)
                           FROM pickup_requests pr2
                           WHERE pr2.assigned_driver_id = u.id
                             AND pr2.status IN ('assigned', 'accepted')
                       ) AS active_pickup_count
                FROM users u
                INNER JOIN user_has_roles uhr ON uhr.user_id = u.id
                INNER JOIN roles r ON r.id = uhr.role_id AND r.code = 'pickup_delivery_driver'
                INNER JOIN user_branch_scopes ubs ON ubs.user_id = u.id
                WHERE u.is_active = 1
                  AND u.deleted_at IS NULL
                  AND ({$scopeSql})
                GROUP BY u.id, u.public_id, u.employee_code, u.full_name, u.phone_masked
                ORDER BY active_pickup_count ASC, u.full_name ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $drivers = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $drivers[] = [
                'id' => (int) $row['id'],
                'public_id' => $row['public_id'],
                'employee_code' => $row['employee_code'],
                'full_name' => $row['full_name'],
                'phone_masked' => $row['phone_masked'],
                'branch_id' => $row['branch_id'] !== null ? (int) $row['branch_id'] : null,
                'active_pickup_count' => (int) $row['active_pickup_count'],
            ];
        }

        return $drivers;
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function assignDriver(
        string $identifier,
        string $driverIdentifier,
        int $expectedVersion,
        array $scopeContext,
        int $actorId,
        string $ip,
        ?string $userAgent,
        bool $autoAssign = false
    ): array {
        return Database::transaction(function () use ($identifier, $driverIdentifier, $expectedVersion, $scopeContext, $actorId, $ip, $userAgent, $autoAssign): array {
            $row = $this->fetchRawPickup($identifier, true);
            $pickupId = (int) $row['id'];
            $branchId = (int) $row['branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            if ((int) $row['version'] !== $expectedVersion) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Yêu cầu lấy hàng đã được điều phối viên khác cập nhật, vui lòng tải lại dữ liệu mới nhất.',
                    ['current_version' => (int) $row['version']],
                    409,
                );
            }

            if (!in_array((string) $row['status'], ['pending', 'assigned', 'pickup_failed'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Chỉ có thể phân công tài xế khi yêu cầu ở trạng thái pending, assigned hoặc pickup_failed.',
                    ['status' => [$row['status']]],
                    422,
                );
            }

            $driver = $autoAssign
                ? $this->resolveLeastBusyDriverForBranch($branchId)
                : $this->resolveActivePickupDriver($driverIdentifier);
            $driverId = (int) $driver['id'];

            $update = $this->pdo->prepare(
                "UPDATE pickup_requests
                 SET assigned_driver_id = :driver_id,
                     assigned_by = :assigned_by,
                     assigned_at = NOW(),
                     status = 'assigned',
                     failure_reason = NULL,
                     version = version + 1
                 WHERE id = :id AND version = :expected_version"
            );
            $update->execute([
                ':driver_id' => $driverId,
                ':assigned_by' => $actorId,
                ':id' => $pickupId,
                ':expected_version' => $expectedVersion,
            ]);

            if ($update->rowCount() === 0) {
                throw new ApiException('409_VERSION_CONFLICT', 'Xung đột phiên bản khi phân lệnh tài xế.', [], 409);
            }

            $this->writeAuditLog(
                $actorId,
                $branchId,
                $autoAssign ? 'AUTO_ASSIGN_PICKUP_DRIVER' : 'ASSIGN_PICKUP_DRIVER',
                'pickup_requests',
                $pickupId,
                ['status' => $row['status'], 'assigned_driver_id' => $row['assigned_driver_id'], 'version' => (int) $row['version']],
                ['status' => 'assigned', 'assigned_driver_id' => $driverId, 'version' => $expectedVersion + 1],
                $ip,
                $userAgent
            );

            return $this->findDetail((string) $pickupId, $scopeContext);
        });
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function cancelRequest(
        string $identifier,
        string $cancelReason,
        int $expectedVersion,
        array $scopeContext,
        int $actorId,
        string $ip,
        ?string $userAgent
    ): array {
        return Database::transaction(function () use ($identifier, $cancelReason, $expectedVersion, $scopeContext, $actorId, $ip, $userAgent): array {
            $row = $this->fetchRawPickup($identifier, true);
            $pickupId = (int) $row['id'];
            $branchId = (int) $row['branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            if ((int) $row['version'] !== $expectedVersion) {
                throw new ApiException(
                    '409_VERSION_CONFLICT',
                    'Yêu cầu lấy hàng đã thay đổi phiên bản, vui lòng tải lại dữ liệu mới nhất.',
                    ['current_version' => (int) $row['version']],
                    409,
                );
            }

            if (!in_array((string) $row['status'], ['pending', 'assigned', 'accepted', 'pickup_failed'], true)) {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Không thể hủy yêu cầu lấy hàng ở trạng thái hiện tại.',
                    ['status' => [$row['status']]],
                    422,
                );
            }

            $update = $this->pdo->prepare(
                "UPDATE pickup_requests
                 SET status = 'cancelled',
                     cancel_reason = :cancel_reason,
                     version = version + 1
                 WHERE id = :id AND version = :expected_version"
            );
            $update->execute([
                ':cancel_reason' => trim($cancelReason),
                ':id' => $pickupId,
                ':expected_version' => $expectedVersion,
            ]);

            if ($update->rowCount() === 0) {
                throw new ApiException('409_VERSION_CONFLICT', 'Xung đột phiên bản khi hủy yêu cầu lấy hàng.', [], 409);
            }

            $this->writeAuditLog(
                $actorId,
                $branchId,
                'CANCEL_PICKUP_REQUEST',
                'pickup_requests',
                $pickupId,
                ['status' => $row['status'], 'version' => (int) $row['version']],
                ['status' => 'cancelled', 'cancel_reason' => trim($cancelReason), 'version' => $expectedVersion + 1],
                $ip,
                $userAgent
            );

            return $this->findDetail((string) $pickupId, $scopeContext);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchRawPickup(string $identifier, bool $forUpdate): array
    {
        if (ctype_digit($identifier)) {
            $where = 'pr.id = :id';
            $params = [':id' => (int) $identifier];
        } elseif (preg_match('/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i', $identifier) === 1) {
            $where = 'pr.public_id = :id';
            $params = [':id' => strtoupper($identifier)];
        } else {
            $where = 'pr.request_code = :id';
            $params = [':id' => strtoupper($identifier)];
        }

        $lockSql = $forUpdate ? ' FOR UPDATE' : '';
        $sql = "SELECT pr.*,
                       b.public_id AS branch_public_id, b.code AS branch_code, b.name AS branch_name,
                       drv.public_id AS driver_public_id, drv.employee_code AS driver_code,
                       drv.full_name AS driver_name, drv.phone_masked AS driver_phone_masked,
                       TIMESTAMPDIFF(MINUTE, NOW(), pr.sla_deadline_at) AS minutes_remaining,
                       CASE
                           WHEN pr.status IN ('pending', 'assigned', 'accepted') AND pr.sla_deadline_at < NOW() THEN 1
                           ELSE 0
                       END AS is_sla_breached,
                       CASE
                           WHEN pr.status IN ('pending', 'assigned', 'accepted')
                                AND pr.sla_deadline_at >= NOW()
                                AND pr.sla_deadline_at <= DATE_ADD(NOW(), INTERVAL 30 MINUTE) THEN 1
                           ELSE 0
                       END AS is_sla_warning
                FROM pickup_requests pr
                INNER JOIN branches b ON b.id = pr.branch_id
                LEFT JOIN users drv ON drv.id = pr.assigned_driver_id
                WHERE {$where}
                LIMIT 1{$lockSql}";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy yêu cầu lấy hàng.', [], 404);
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveLeastBusyDriverForBranch(int $branchId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT u.id, u.public_id, u.employee_code, u.full_name,
                    (
                        SELECT COUNT(*)
                        FROM pickup_requests pr2
                        WHERE pr2.assigned_driver_id = u.id
                          AND pr2.status IN ('assigned', 'accepted')
                    ) AS active_pickup_count
             FROM users u
             INNER JOIN user_has_roles uhr ON uhr.user_id = u.id
             INNER JOIN roles r ON r.id = uhr.role_id AND r.code = 'pickup_delivery_driver'
             INNER JOIN user_branch_scopes ubs ON ubs.user_id = u.id AND ubs.branch_id = :branch_id
             WHERE u.is_active = 1
               AND u.deleted_at IS NULL
             ORDER BY active_pickup_count ASC, u.id ASC
             LIMIT 1"
        );
        $stmt->execute([':branch_id' => $branchId]);
        $driver = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($driver === false) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Chi nhánh hiện chưa có tài xế lấy/giao hàng đang hoạt động để gán tự động.',
                ['driver_id' => ['Không có tài xế khả dụng']],
                422,
            );
        }

        return $driver;
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveActivePickupDriver(string $driverIdentifier): array
    {
        $isId = ctype_digit($driverIdentifier);
        $col = $isId ? 'u.id' : 'u.public_id';
        $stmt = $this->pdo->prepare(
            "SELECT u.id, u.public_id, u.employee_code, u.full_name
             FROM users u
             INNER JOIN user_has_roles uhr ON uhr.user_id = u.id
             INNER JOIN roles r ON r.id = uhr.role_id AND r.code = 'pickup_delivery_driver'
             WHERE {$col} = :id
               AND u.is_active = 1
               AND u.deleted_at IS NULL
             LIMIT 1"
        );
        $stmt->execute([':id' => $isId ? (int) $driverIdentifier : strtoupper($driverIdentifier)]);
        $driver = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($driver === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Tài xế lấy/giao hàng không tồn tại hoặc đã bị khóa.', ['driver_id' => ['Tài xế không hợp lệ']], 422);
        }

        return $driver;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatPickupRow(array $row, bool $includePlainPhone): array
    {
        $item = [
            'public_id' => $row['public_id'],
            'request_code' => $row['request_code'],
            'customer_id' => $row['customer_id'] !== null ? (int) $row['customer_id'] : null,
            'branch_id' => (int) $row['branch_id'],
            'branch_public_id' => $row['branch_public_id'] ?? null,
            'branch_code' => $row['branch_code'] ?? null,
            'branch_name' => $row['branch_name'] ?? null,
            'pickup_mode' => $row['pickup_mode'],
            'sender_name' => $row['sender_name'],
            'sender_phone_masked' => $row['sender_phone_masked'],
            'province_id' => (int) $row['province_id'],
            'district_id' => (int) $row['district_id'],
            'ward_id' => (int) $row['ward_id'],
            'pickup_address' => $row['pickup_address'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'estimated_parcel_count' => (int) $row['estimated_parcel_count'],
            'estimated_weight_gram' => (int) $row['estimated_weight_gram'],
            'note' => $row['note'],
            'status' => $row['status'],
            'sla_deadline_at' => $row['sla_deadline_at'],
            'minutes_remaining' => (int) ($row['minutes_remaining'] ?? 0),
            'is_sla_breached' => (bool) ($row['is_sla_breached'] ?? false),
            'is_sla_warning' => (bool) ($row['is_sla_warning'] ?? false),
            'assigned_driver_id' => $row['assigned_driver_id'] !== null ? (int) $row['assigned_driver_id'] : null,
            'assigned_driver_name' => $row['driver_name'] ?? null,
            'assigned_driver_phone_masked' => $row['driver_phone_masked'] ?? null,
            'assigned_driver' => $row['assigned_driver_id'] !== null ? [
                'id' => (int) $row['assigned_driver_id'],
                'public_id' => $row['driver_public_id'] ?? null,
                'employee_code' => $row['driver_code'] ?? null,
                'full_name' => $row['driver_name'] ?? null,
                'phone_masked' => $row['driver_phone_masked'] ?? null,
            ] : null,
            'assigned_at' => $row['assigned_at'],
            'picked_up_at' => $row['picked_up_at'],
            'failure_reason' => $row['failure_reason'],
            'cancel_reason' => $row['cancel_reason'],
            'version' => (int) $row['version'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];

        if ($includePlainPhone && !empty($row['sender_phone_encrypted'])) {
            $item['sender_phone'] = Crypto::decrypt((string) $row['sender_phone_encrypted']);
        }

        return $item;
    }

    /**
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    private function writeAuditLog(
        int $userId,
        int $branchId,
        string $action,
        string $tableName,
        int $recordId,
        ?array $oldValues,
        ?array $newValues,
        string $ipAddress,
        ?string $userAgent
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO audit_logs (user_id, branch_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
             VALUES (:user_id, :branch_id, :action, :table_name, :record_id, :old_values, :new_values, :ip_address, :user_agent)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':branch_id' => $branchId,
            ':action' => $action,
            ':table_name' => $tableName,
            ':record_id' => $recordId,
            ':old_values' => $oldValues !== null ? json_encode($oldValues, JSON_UNESCAPED_UNICODE) : null,
            ':new_values' => $newValues !== null ? json_encode($newValues, JSON_UNESCAPED_UNICODE) : null,
            ':ip_address' => $ipAddress !== '' ? $ipAddress : '127.0.0.1',
            ':user_agent' => $userAgent !== null ? substr($userAgent, 0, 500) : null,
        ]);
    }
}