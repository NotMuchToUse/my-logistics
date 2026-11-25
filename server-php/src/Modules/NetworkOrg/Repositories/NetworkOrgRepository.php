<?php

declare(strict_types=1);

namespace App\Modules\NetworkOrg\Repositories;

use App\Core\ApiException;
use App\Core\Crypto;
use App\Core\Database;
use App\Core\ScopeGuard;
use App\Core\UlidGenerator;
use PDO;

final class NetworkOrgRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginateBranches(array $filters, array $scopeContext, int $page, int $perPage): array
    {
        $params = [];
        $where = [
            'b.deleted_at IS NULL',
            ScopeGuard::applyBranchFilter($scopeContext, 'b.id', $params),
        ];

        if (!empty($filters['branch_type'])) {
            $where[] = 'b.branch_type = :branch_type';
            $params[':branch_type'] = (string) $filters['branch_type'];
        }
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $where[] = 'b.is_active = :is_active';
            $params[':is_active'] = (int) $filters['is_active'];
        }
        if (!empty($filters['search'])) {
            $where[] = '(b.code LIKE :search OR b.name LIKE :search)';
            $params[':search'] = '%' . trim((string) $filters['search']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM branches b WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT b.id, b.public_id, b.parent_branch_id, pb.public_id AS parent_public_id, pb.name AS parent_branch_name,
                       b.code, b.name, b.branch_type, b.province_id, b.district_id, b.ward_id,
                       b.address_line, b.latitude, b.longitude, b.hotline_phone, b.operating_hours,
                       b.accepts_counter_dropoff, b.is_active, b.created_at, b.updated_at
                FROM branches b
                LEFT JOIN branches pb ON pb.id = b.parent_branch_id
                WHERE {$whereSql}
                ORDER BY b.id DESC
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
            $items[] = $this->formatBranch($row);
        }

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @return array<string, mixed>
     */
    public function findBranchByIdentifier(string $identifier): array
    {
        $isId = ctype_digit($identifier);
        $column = $isId ? 'b.id' : 'b.public_id';
        $stmt = $this->pdo->prepare(
            "SELECT b.*, pb.public_id AS parent_public_id, pb.name AS parent_branch_name
             FROM branches b
             LEFT JOIN branches pb ON pb.id = b.parent_branch_id
             WHERE {$column} = :identifier AND b.deleted_at IS NULL
             LIMIT 1"
        );
        $stmt->execute([':identifier' => $isId ? (int) $identifier : strtoupper($identifier)]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy chi nhánh/bưu cục.', [], 404);
        }

        return $row;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createBranch(array $data, int $actorId, ?int $activeBranchId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($data, $actorId, $activeBranchId, $ip, $userAgent): array {
            $check = $this->pdo->prepare('SELECT id FROM branches WHERE code = :code AND deleted_at IS NULL LIMIT 1');
            $check->execute([':code' => strtoupper(trim((string) $data['code']))]);
            if ($check->fetchColumn() !== false) {
                throw new ApiException('422_VALIDATION_ERROR', 'Mã chi nhánh đã tồn tại.', ['code' => ['Mã chi nhánh đã tồn tại']], 422);
            }

            $publicId = UlidGenerator::generate();
            $stmt = $this->pdo->prepare(
                'INSERT INTO branches (
                    public_id, parent_branch_id, code, name, branch_type,
                    province_id, district_id, ward_id, address_line,
                    latitude, longitude, hotline_phone, operating_hours,
                    accepts_counter_dropoff, is_active, created_by, updated_by
                ) VALUES (
                    :public_id, :parent_branch_id, :code, :name, :branch_type,
                    :province_id, :district_id, :ward_id, :address_line,
                    :latitude, :longitude, :hotline_phone, :operating_hours,
                    :accepts_counter_dropoff, :is_active, :created_by, :updated_by
                )'
            );
            $stmt->execute([
                ':public_id' => $publicId,
                ':parent_branch_id' => !empty($data['parent_branch_id']) ? (int) $data['parent_branch_id'] : null,
                ':code' => strtoupper(trim((string) $data['code'])),
                ':name' => trim((string) $data['name']),
                ':branch_type' => (string) $data['branch_type'],
                ':province_id' => (int) $data['province_id'],
                ':district_id' => (int) $data['district_id'],
                ':ward_id' => (int) $data['ward_id'],
                ':address_line' => trim((string) $data['address_line']),
                ':latitude' => isset($data['latitude']) && $data['latitude'] !== '' ? (float) $data['latitude'] : null,
                ':longitude' => isset($data['longitude']) && $data['longitude'] !== '' ? (float) $data['longitude'] : null,
                ':hotline_phone' => isset($data['hotline_phone']) ? trim((string) $data['hotline_phone']) : null,
                ':operating_hours' => isset($data['operating_hours']) ? trim((string) $data['operating_hours']) : null,
                ':accepts_counter_dropoff' => isset($data['accepts_counter_dropoff']) ? (int) (bool) $data['accepts_counter_dropoff'] : 1,
                ':is_active' => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
                ':created_by' => $actorId,
                ':updated_by' => $actorId,
            ]);

            $branchId = (int) $this->pdo->lastInsertId();
            $created = $this->findBranchByIdentifier((string) $branchId);
            $this->writeAuditLog($actorId, $activeBranchId ?? $branchId, 'CREATE_BRANCH', 'branches', $branchId, null, $this->formatBranch($created), $ip, $userAgent);

            return $this->formatBranch($created);
        });
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function updateBranch(string $identifier, array $data, array $scopeContext, int $actorId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($identifier, $data, $scopeContext, $actorId, $ip, $userAgent): array {
            $existing = $this->findBranchByIdentifier($identifier);
            $branchId = (int) $existing['id'];
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            $allowedFields = [
                'parent_branch_id', 'name', 'branch_type', 'province_id', 'district_id', 'ward_id',
                'address_line', 'latitude', 'longitude', 'hotline_phone', 'operating_hours',
                'accepts_counter_dropoff', 'is_active',
            ];
            $sets = ['updated_by = :updated_by'];
            $params = [':id' => $branchId, ':updated_by' => $actorId];

            foreach ($allowedFields as $field) {
                if (!array_key_exists($field, $data)) {
                    continue;
                }
                $sets[] = "{$field} = :{$field}";
                $val = $data[$field];
                if (in_array($field, ['parent_branch_id', 'province_id', 'district_id', 'ward_id'], true)) {
                    $params[":{$field}"] = $val === null || $val === '' ? null : (int) $val;
                } elseif (in_array($field, ['accepts_counter_dropoff', 'is_active'], true)) {
                    $params[":{$field}"] = (int) (bool) $val;
                } elseif (in_array($field, ['latitude', 'longitude'], true)) {
                    $params[":{$field}"] = $val === null || $val === '' ? null : (float) $val;
                } else {
                    $params[":{$field}"] = $val === null ? null : trim((string) $val);
                }
            }

            $stmt = $this->pdo->prepare('UPDATE branches SET ' . implode(', ', $sets) . ' WHERE id = :id');
            $stmt->execute($params);

            $updated = $this->findBranchByIdentifier((string) $branchId);
            $this->writeAuditLog(
                $actorId,
                $scopeContext['active_branch_id'] ?? $branchId,
                'UPDATE_BRANCH',
                'branches',
                $branchId,
                $this->formatBranch($existing),
                $this->formatBranch($updated),
                $ip,
                $userAgent
            );

            return $this->formatBranch($updated);
        });
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginateWarehouses(array $filters, array $scopeContext, int $page, int $perPage): array
    {
        $params = [];
        $where = [
            'w.deleted_at IS NULL',
            ScopeGuard::applyWarehouseFilter($scopeContext, 'w.id', $params),
        ];

        if (!empty($filters['branch_id'])) {
            $where[] = 'w.branch_id = :branch_id';
            $params[':branch_id'] = (int) $filters['branch_id'];
        }
        if (!empty($filters['warehouse_type'])) {
            $where[] = 'w.warehouse_type = :warehouse_type';
            $params[':warehouse_type'] = (string) $filters['warehouse_type'];
        }
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $where[] = 'w.is_active = :is_active';
            $params[':is_active'] = (int) $filters['is_active'];
        }
        if (!empty($filters['search'])) {
            $where[] = '(w.code LIKE :search OR w.name LIKE :search)';
            $params[':search'] = '%' . trim((string) $filters['search']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM warehouses w WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $stmt = $this->pdo->prepare(
            "SELECT w.*, b.public_id AS branch_public_id, b.code AS branch_code, b.name AS branch_name
             FROM warehouses w
             INNER JOIN branches b ON b.id = w.branch_id
             WHERE {$whereSql}
             ORDER BY w.id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $items[] = $this->formatWarehouse($row);
        }

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @return array<string, mixed>
     */
    public function findWarehouseByIdentifier(string $identifier): array
    {
        $isId = ctype_digit($identifier);
        $column = $isId ? 'w.id' : 'w.public_id';
        $stmt = $this->pdo->prepare(
            "SELECT w.*, b.public_id AS branch_public_id, b.code AS branch_code, b.name AS branch_name
             FROM warehouses w
             INNER JOIN branches b ON b.id = w.branch_id
             WHERE {$column} = :identifier AND w.deleted_at IS NULL
             LIMIT 1"
        );
        $stmt->execute([':identifier' => $isId ? (int) $identifier : strtoupper($identifier)]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy kho hàng.', [], 404);
        }

        return $row;
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createWarehouse(array $data, array $scopeContext, int $actorId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($data, $scopeContext, $actorId, $ip, $userAgent): array {
            $branchId = (int) $data['branch_id'];
            ScopeGuard::assertBranchAccess($scopeContext, $branchId);

            $check = $this->pdo->prepare('SELECT id FROM warehouses WHERE code = :code AND deleted_at IS NULL LIMIT 1');
            $check->execute([':code' => strtoupper(trim((string) $data['code']))]);
            if ($check->fetchColumn() !== false) {
                throw new ApiException('422_VALIDATION_ERROR', 'Mã kho đã tồn tại.', ['code' => ['Mã kho đã tồn tại']], 422);
            }

            $publicId = UlidGenerator::generate();
            $stmt = $this->pdo->prepare(
                'INSERT INTO warehouses (
                    public_id, branch_id, code, name, warehouse_type,
                    address_line, latitude, longitude, max_capacity_parcels,
                    is_active, created_by, updated_by
                ) VALUES (
                    :public_id, :branch_id, :code, :name, :warehouse_type,
                    :address_line, :latitude, :longitude, :max_capacity_parcels,
                    :is_active, :created_by, :updated_by
                )'
            );
            $stmt->execute([
                ':public_id' => $publicId,
                ':branch_id' => $branchId,
                ':code' => strtoupper(trim((string) $data['code'])),
                ':name' => trim((string) $data['name']),
                ':warehouse_type' => (string) $data['warehouse_type'],
                ':address_line' => trim((string) $data['address_line']),
                ':latitude' => isset($data['latitude']) && $data['latitude'] !== '' ? (float) $data['latitude'] : null,
                ':longitude' => isset($data['longitude']) && $data['longitude'] !== '' ? (float) $data['longitude'] : null,
                ':max_capacity_parcels' => isset($data['max_capacity_parcels']) ? (int) $data['max_capacity_parcels'] : 5000,
                ':is_active' => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
                ':created_by' => $actorId,
                ':updated_by' => $actorId,
            ]);

            $warehouseId = (int) $this->pdo->lastInsertId();
            $created = $this->findWarehouseByIdentifier((string) $warehouseId);
            $this->writeAuditLog($actorId, $scopeContext['active_branch_id'] ?? $branchId, 'CREATE_WAREHOUSE', 'warehouses', $warehouseId, null, $this->formatWarehouse($created), $ip, $userAgent);

            return $this->formatWarehouse($created);
        });
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function updateWarehouse(string $identifier, array $data, array $scopeContext, int $actorId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($identifier, $data, $scopeContext, $actorId, $ip, $userAgent): array {
            $existing = $this->findWarehouseByIdentifier($identifier);
            $warehouseId = (int) $existing['id'];
            ScopeGuard::assertWarehouseAccess($scopeContext, $warehouseId);

            $allowedFields = ['branch_id', 'name', 'warehouse_type', 'address_line', 'latitude', 'longitude', 'max_capacity_parcels', 'is_active'];
            $sets = ['updated_by = :updated_by'];
            $params = [':id' => $warehouseId, ':updated_by' => $actorId];

            foreach ($allowedFields as $field) {
                if (!array_key_exists($field, $data)) {
                    continue;
                }
                $sets[] = "{$field} = :{$field}";
                $val = $data[$field];
                if ($field === 'branch_id') {
                    ScopeGuard::assertBranchAccess($scopeContext, (int) $val);
                    $params[':branch_id'] = (int) $val;
                } elseif ($field === 'max_capacity_parcels') {
                    $params[':max_capacity_parcels'] = (int) $val;
                } elseif ($field === 'is_active') {
                    $params[':is_active'] = (int) (bool) $val;
                } elseif (in_array($field, ['latitude', 'longitude'], true)) {
                    $params[":{$field}"] = $val === null || $val === '' ? null : (float) $val;
                } else {
                    $params[":{$field}"] = $val === null ? null : trim((string) $val);
                }
            }

            $stmt = $this->pdo->prepare('UPDATE warehouses SET ' . implode(', ', $sets) . ' WHERE id = :id');
            $stmt->execute($params);

            $updated = $this->findWarehouseByIdentifier((string) $warehouseId);
            $this->writeAuditLog(
                $actorId,
                $scopeContext['active_branch_id'] ?? (int) $updated['branch_id'],
                'UPDATE_WAREHOUSE',
                'warehouses',
                $warehouseId,
                $this->formatWarehouse($existing),
                $this->formatWarehouse($updated),
                $ip,
                $userAgent
            );

            return $this->formatWarehouse($updated);
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listRoles(): array
    {
        return $this->pdo->query('SELECT * FROM roles ORDER BY id ASC')->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<string, mixed> $scopeContext
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginateStaffUsers(array $filters, array $scopeContext, int $page, int $perPage): array
    {
        $params = [];
        $where = [
            "u.user_type IN ('staff', 'system_dev')",
            'u.deleted_at IS NULL',
        ];

        $branchScopeSql = ScopeGuard::applyBranchFilter($scopeContext, 'ubs.branch_id', $params);
        if ($branchScopeSql !== '1 = 1') {
            $where[] = "EXISTS (SELECT 1 FROM user_branch_scopes ubs WHERE ubs.user_id = u.id AND ({$branchScopeSql}))";
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $where[] = 'u.is_active = :is_active';
            $params[':is_active'] = (int) $filters['is_active'];
        }
        if (!empty($filters['role_code'])) {
            $where[] = 'EXISTS (SELECT 1 FROM user_has_roles uhr INNER JOIN roles r ON r.id = uhr.role_id WHERE uhr.user_id = u.id AND r.code = :role_code)';
            $params[':role_code'] = (string) $filters['role_code'];
        }
        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $digits = preg_replace('/\D+/', '', $search) ?? '';
            if (strlen($digits) >= 9) {
                $where[] = '(u.full_name LIKE :search OR u.email LIKE :search OR u.employee_code LIKE :search OR u.phone_hash = :phone_hash)';
                $params[':phone_hash'] = Crypto::hashPhone($digits);
            } else {
                $where[] = '(u.full_name LIKE :search OR u.email LIKE :search OR u.employee_code LIKE :search)';
            }
            $params[':search'] = '%' . $search . '%';
        }

        $whereSql = implode(' AND ', $where);
        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM users u WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $stmt = $this->pdo->prepare(
            "SELECT u.id, u.public_id, u.employee_code, u.full_name, u.email,
                    u.phone_masked, u.avatar_url, u.user_type, u.must_change_password,
                    u.is_active, u.last_login_at, u.created_at
             FROM users u
             WHERE {$whereSql}
             ORDER BY u.id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if ($rows === []) {
            return ['items' => [], 'total' => $total];
        }

        $userIds = array_map(static fn (array $r): int => (int) $r['id'], $rows);
        $rolesMap = $this->fetchRolesForUsers($userIds);
        $scopesMap = $this->fetchScopesForUsers($userIds);

        $items = [];
        foreach ($rows as $row) {
            $uid = (int) $row['id'];
            $items[] = [
                'public_id' => $row['public_id'],
                'employee_code' => $row['employee_code'],
                'full_name' => $row['full_name'],
                'email' => $row['email'],
                'phone_masked' => $row['phone_masked'],
                'avatar_url' => $row['avatar_url'],
                'user_type' => $row['user_type'],
                'must_change_password' => (bool) $row['must_change_password'],
                'is_active' => (bool) $row['is_active'],
                'last_login_at' => $row['last_login_at'],
                'created_at' => $row['created_at'],
                'roles' => $rolesMap[$uid] ?? [],
                'branch_scopes' => $scopesMap[$uid] ?? [],
            ];
        }

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @return array<string, mixed>
     */
    public function findUserDetail(string $identifier): array
    {
        $row = $this->findRawUser($identifier);
        $uid = (int) $row['id'];
        $rolesMap = $this->fetchRolesForUsers([$uid]);
        $scopesMap = $this->fetchScopesForUsers([$uid]);

        return [
            'public_id' => $row['public_id'],
            'employee_code' => $row['employee_code'],
            'full_name' => $row['full_name'],
            'email' => $row['email'],
            'phone' => Crypto::decrypt((string) $row['phone_encrypted']),
            'phone_masked' => $row['phone_masked'],
            'avatar_url' => $row['avatar_url'],
            'user_type' => $row['user_type'],
            'must_change_password' => (bool) $row['must_change_password'],
            'is_active' => (bool) $row['is_active'],
            'last_login_at' => $row['last_login_at'],
            'created_at' => $row['created_at'],
            'roles' => $rolesMap[$uid] ?? [],
            'branch_scopes' => $scopesMap[$uid] ?? [],
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function createStaffUser(array $data, array $scopeContext, int $actorId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($data, $scopeContext, $actorId, $ip, $userAgent): array {
            $email = strtolower(trim((string) $data['email']));
            $phone = trim((string) $data['phone']);
            $phoneHash = Crypto::hashPhone($phone);

            $dupCheck = $this->pdo->prepare('SELECT id FROM users WHERE (email = :email OR phone_hash = :phone_hash) AND deleted_at IS NULL LIMIT 1');
            $dupCheck->execute([':email' => $email, ':phone_hash' => $phoneHash]);
            if ($dupCheck->fetchColumn() !== false) {
                throw new ApiException('422_VALIDATION_ERROR', 'Email hoặc số điện thoại đã tồn tại trong hệ thống.', [], 422);
            }

            $publicId = UlidGenerator::generate();
            $employeeCode = !empty($data['employee_code']) ? strtoupper(trim((string) $data['employee_code'])) : ('NV-' . substr($publicId, -6));
            $plainPassword = (string) ($data['password'] ?? 'Vietstar@2026');

            $stmt = $this->pdo->prepare(
                'INSERT INTO users (
                    public_id, employee_code, full_name, email,
                    phone_encrypted, phone_hash, phone_masked,
                    password_hash, user_type, must_change_password, is_active,
                    created_by, updated_by
                ) VALUES (
                    :public_id, :employee_code, :full_name, :email,
                    :phone_encrypted, :phone_hash, :phone_masked,
                    :password_hash, :user_type, 1, 1,
                    :created_by, :updated_by
                )'
            );
            $stmt->execute([
                ':public_id' => $publicId,
                ':employee_code' => $employeeCode,
                ':full_name' => trim((string) $data['full_name']),
                ':email' => $email,
                ':phone_encrypted' => Crypto::encrypt($phone),
                ':phone_hash' => $phoneHash,
                ':phone_masked' => Crypto::maskPhone($phone),
                ':password_hash' => password_hash($plainPassword, PASSWORD_BCRYPT),
                ':user_type' => 'staff',
                ':created_by' => $actorId,
                ':updated_by' => $actorId,
            ]);

            $userId = (int) $this->pdo->lastInsertId();

            if (!empty($data['role_codes']) && is_array($data['role_codes'])) {
                $this->replaceRoles($userId, $data['role_codes'], $actorId);
            }
            if (!empty($data['branch_scopes']) && is_array($data['branch_scopes'])) {
                $this->replaceBranchScopes($userId, $data['branch_scopes'], $scopeContext, $actorId);
            }

            $detail = $this->findUserDetail((string) $userId);
            $this->writeAuditLog($actorId, $scopeContext['active_branch_id'] ?? null, 'CREATE_STAFF_USER', 'users', $userId, null, [
                'public_id' => $publicId,
                'employee_code' => $employeeCode,
                'email' => $email,
            ], $ip, $userAgent);

            return $detail;
        });
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function updateStaffUser(string $identifier, array $data, array $scopeContext, int $actorId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($identifier, $data, $scopeContext, $actorId, $ip, $userAgent): array {
            $existing = $this->findRawUser($identifier);
            $userId = (int) $existing['id'];

            $sets = ['updated_by = :updated_by'];
            $params = [':id' => $userId, ':updated_by' => $actorId];

            if (array_key_exists('full_name', $data)) {
                $sets[] = 'full_name = :full_name';
                $params[':full_name'] = trim((string) $data['full_name']);
            }
            if (array_key_exists('employee_code', $data)) {
                $sets[] = 'employee_code = :employee_code';
                $params[':employee_code'] = $data['employee_code'] === null ? null : strtoupper(trim((string) $data['employee_code']));
            }
            if (array_key_exists('phone', $data) && !empty($data['phone'])) {
                $phone = trim((string) $data['phone']);
                $sets[] = 'phone_encrypted = :phone_encrypted, phone_hash = :phone_hash, phone_masked = :phone_masked';
                $params[':phone_encrypted'] = Crypto::encrypt($phone);
                $params[':phone_hash'] = Crypto::hashPhone($phone);
                $params[':phone_masked'] = Crypto::maskPhone($phone);
            }
            if (array_key_exists('is_active', $data)) {
                $sets[] = 'is_active = :is_active';
                $params[':is_active'] = (int) (bool) $data['is_active'];
            }
            if (array_key_exists('must_change_password', $data)) {
                $sets[] = 'must_change_password = :must_change_password';
                $params[':must_change_password'] = (int) (bool) $data['must_change_password'];
            }

            $stmt = $this->pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id');
            $stmt->execute($params);

            $updated = $this->findUserDetail((string) $userId);
            $this->writeAuditLog($actorId, $scopeContext['active_branch_id'] ?? null, 'UPDATE_STAFF_USER', 'users', $userId, [
                'full_name' => $existing['full_name'],
                'employee_code' => $existing['employee_code'],
                'is_active' => (int) $existing['is_active'],
            ], [
                'full_name' => $updated['full_name'],
                'employee_code' => $updated['employee_code'],
                'is_active' => (int) $updated['is_active'],
            ], $ip, $userAgent);

            return $updated;
        });
    }

    /**
     * @param list<string> $roleCodes
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function syncUserRoles(string $identifier, array $roleCodes, array $scopeContext, int $actorId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($identifier, $roleCodes, $scopeContext, $actorId, $ip, $userAgent): array {
            $user = $this->findRawUser($identifier);
            $userId = (int) $user['id'];
            $oldRoles = $this->fetchRolesForUsers([$userId])[$userId] ?? [];

            $this->replaceRoles($userId, $roleCodes, $actorId);
            $newRoles = $this->fetchRolesForUsers([$userId])[$userId] ?? [];

            $this->writeAuditLog(
                $actorId,
                $scopeContext['active_branch_id'] ?? null,
                'ASSIGN_USER_ROLES',
                'user_has_roles',
                $userId,
                ['roles' => $oldRoles],
                ['roles' => $newRoles],
                $ip,
                $userAgent
            );

            return $this->findUserDetail((string) $userId);
        });
    }

    /**
     * @param list<array<string, mixed>> $scopes
     * @param array<string, mixed> $scopeContext
     * @return array<string, mixed>
     */
    public function syncUserBranchScopes(string $identifier, array $scopes, array $scopeContext, int $actorId, string $ip, ?string $userAgent): array
    {
        return Database::transaction(function () use ($identifier, $scopes, $scopeContext, $actorId, $ip, $userAgent): array {
            $user = $this->findRawUser($identifier);
            $userId = (int) $user['id'];
            $oldScopes = $this->fetchScopesForUsers([$userId])[$userId] ?? [];

            $this->replaceBranchScopes($userId, $scopes, $scopeContext, $actorId);
            $newScopes = $this->fetchScopesForUsers([$userId])[$userId] ?? [];

            $this->writeAuditLog(
                $actorId,
                $scopeContext['active_branch_id'] ?? null,
                'ASSIGN_USER_BRANCH_SCOPES',
                'user_branch_scopes',
                $userId,
                ['branch_scopes' => $oldScopes],
                ['branch_scopes' => $newScopes],
                $ip,
                $userAgent
            );

            return $this->findUserDetail((string) $userId);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function findRawUser(string $identifier): array
    {
        $isId = ctype_digit($identifier);
        $column = $isId ? 'id' : 'public_id';
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE {$column} = :identifier AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([':identifier' => $isId ? (int) $identifier : strtoupper($identifier)]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy tài khoản nhân sự.', [], 404);
        }

        return $row;
    }

    /**
     * @param list<string> $roleCodes
     */
    private function replaceRoles(int $userId, array $roleCodes, int $actorId): void
    {
        $cleanCodes = array_values(array_unique(array_filter(array_map(
            static fn (mixed $c): string => trim((string) $c),
            $roleCodes
        ), static fn (string $c): bool => $c !== '')));

        if ($cleanCodes === []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Phải chỉ định ít nhất 1 vai trò (role_codes).', [], 422);
        }

        $placeholders = [];
        $params = [];
        foreach ($cleanCodes as $idx => $code) {
            $ph = ':rc_' . $idx;
            $placeholders[] = $ph;
            $params[$ph] = $code;
        }

        $stmt = $this->pdo->prepare('SELECT id, code FROM roles WHERE code IN (' . implode(', ', $placeholders) . ')');
        $stmt->execute($params);
        $found = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($found) !== count($cleanCodes)) {
            throw new ApiException('422_VALIDATION_ERROR', 'Danh sách role_codes chứa mã vai trò không hợp lệ.', [], 422);
        }

        $del = $this->pdo->prepare('DELETE FROM user_has_roles WHERE user_id = :user_id');
        $del->execute([':user_id' => $userId]);

        $ins = $this->pdo->prepare('INSERT INTO user_has_roles (user_id, role_id, assigned_by) VALUES (:user_id, :role_id, :assigned_by)');
        foreach ($found as $roleRow) {
            $ins->execute([
                ':user_id' => $userId,
                ':role_id' => (int) $roleRow['id'],
                ':assigned_by' => $actorId,
            ]);
        }
    }

    /**
     * @param list<array<string, mixed>> $scopes
     * @param array<string, mixed> $scopeContext
     */
    private function replaceBranchScopes(int $userId, array $scopes, array $scopeContext, int $actorId): void
    {
        if ($scopes === []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Phải chỉ định ít nhất 1 phạm vi chi nhánh/kho.', [], 422);
        }

        $allowedTypes = ['hq_all', 'region_center', 'branch', 'post_office', 'warehouse'];
        $del = $this->pdo->prepare('DELETE FROM user_branch_scopes WHERE user_id = :user_id');
        $del->execute([':user_id' => $userId]);

        $ins = $this->pdo->prepare(
            'INSERT INTO user_branch_scopes (user_id, scope_type, branch_id, warehouse_id, is_primary, assigned_by)
             VALUES (:user_id, :scope_type, :branch_id, :warehouse_id, :is_primary, :assigned_by)'
        );

        foreach ($scopes as $index => $scope) {
            $scopeType = (string) ($scope['scope_type'] ?? '');
            if (!in_array($scopeType, $allowedTypes, true)) {
                throw new ApiException('422_VALIDATION_ERROR', "scope_type không hợp lệ tại phần tử #{$index}.", [], 422);
            }

            $branchId = isset($scope['branch_id']) && $scope['branch_id'] !== null && $scope['branch_id'] !== '' ? (int) $scope['branch_id'] : null;
            $warehouseId = isset($scope['warehouse_id']) && $scope['warehouse_id'] !== null && $scope['warehouse_id'] !== '' ? (int) $scope['warehouse_id'] : null;

            if ($scopeType === 'hq_all' && ($scopeContext['is_hq_all'] ?? false) !== true) {
                throw new ApiException('403_BRANCH_SCOPE', 'Chỉ quản trị viên toàn quốc (hq_all) mới được cấp quyền hq_all.', [], 403);
            }
            if ($branchId !== null) {
                ScopeGuard::assertBranchAccess($scopeContext, $branchId);
            }
            if ($warehouseId !== null) {
                ScopeGuard::assertWarehouseAccess($scopeContext, $warehouseId);
            }

            $ins->execute([
                ':user_id' => $userId,
                ':scope_type' => $scopeType,
                ':branch_id' => $scopeType === 'hq_all' ? null : $branchId,
                ':warehouse_id' => $scopeType === 'warehouse' ? $warehouseId : null,
                ':is_primary' => !empty($scope['is_primary']) || $index === 0 ? 1 : 0,
                ':assigned_by' => $actorId,
            ]);
        }
    }

    /**
     * @param list<int> $userIds
     * @return array<int, list<array<string, mixed>>>
     */
    private function fetchRolesForUsers(array $userIds): array
    {
        $placeholders = [];
        $params = [];
        foreach ($userIds as $i => $id) {
            $ph = ':u_' . $i;
            $placeholders[] = $ph;
            $params[$ph] = $id;
        }
        $stmt = $this->pdo->prepare(
            'SELECT uhr.user_id, r.id AS role_id, r.code, r.name
             FROM user_has_roles uhr
             INNER JOIN roles r ON r.id = uhr.role_id
             WHERE uhr.user_id IN (' . implode(', ', $placeholders) . ')'
        );
        $stmt->execute($params);

        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[(int) $row['user_id']][] = [
                'role_id' => (int) $row['role_id'],
                'code' => $row['code'],
                'name' => $row['name'],
            ];
        }
        return $map;
    }

    /**
     * @param list<int> $userIds
     * @return array<int, list<array<string, mixed>>>
     */
    private function fetchScopesForUsers(array $userIds): array
    {
        $placeholders = [];
        $params = [];
        foreach ($userIds as $i => $id) {
            $ph = ':us_' . $i;
            $placeholders[] = $ph;
            $params[$ph] = $id;
        }
        $stmt = $this->pdo->prepare(
            'SELECT ubs.id, ubs.user_id, ubs.scope_type, ubs.branch_id, b.code AS branch_code, b.name AS branch_name,
                    ubs.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, ubs.is_primary
             FROM user_branch_scopes ubs
             LEFT JOIN branches b ON b.id = ubs.branch_id
             LEFT JOIN warehouses w ON w.id = ubs.warehouse_id
             WHERE ubs.user_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY ubs.is_primary DESC, ubs.id ASC'
        );
        $stmt->execute($params);

        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[(int) $row['user_id']][] = [
                'id' => (int) $row['id'],
                'scope_type' => $row['scope_type'],
                'branch_id' => $row['branch_id'] !== null ? (int) $row['branch_id'] : null,
                'branch_code' => $row['branch_code'],
                'branch_name' => $row['branch_name'],
                'warehouse_id' => $row['warehouse_id'] !== null ? (int) $row['warehouse_id'] : null,
                'warehouse_code' => $row['warehouse_code'],
                'warehouse_name' => $row['warehouse_name'],
                'is_primary' => (bool) $row['is_primary'],
            ];
        }
        return $map;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatBranch(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'public_id' => $row['public_id'],
            'parent_branch_id' => $row['parent_branch_id'] !== null ? (int) $row['parent_branch_id'] : null,
            'parent_public_id' => $row['parent_public_id'] ?? null,
            'parent_branch_name' => $row['parent_branch_name'] ?? null,
            'code' => $row['code'],
            'name' => $row['name'],
            'branch_type' => $row['branch_type'],
            'province_id' => (int) $row['province_id'],
            'district_id' => (int) $row['district_id'],
            'ward_id' => (int) $row['ward_id'],
            'address_line' => $row['address_line'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'hotline_phone' => $row['hotline_phone'],
            'operating_hours' => $row['operating_hours'],
            'accepts_counter_dropoff' => (bool) $row['accepts_counter_dropoff'],
            'is_active' => (bool) $row['is_active'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatWarehouse(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'public_id' => $row['public_id'],
            'branch_id' => (int) $row['branch_id'],
            'branch_public_id' => $row['branch_public_id'] ?? null,
            'branch_code' => $row['branch_code'] ?? null,
            'branch_name' => $row['branch_name'] ?? null,
            'code' => $row['code'],
            'name' => $row['name'],
            'warehouse_type' => $row['warehouse_type'],
            'address_line' => $row['address_line'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'max_capacity_parcels' => (int) $row['max_capacity_parcels'],
            'is_active' => (bool) $row['is_active'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /**
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    private function writeAuditLog(
        int $userId,
        ?int $branchId,
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