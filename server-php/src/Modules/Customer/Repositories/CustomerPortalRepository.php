<?php

declare(strict_types=1);

namespace App\Modules\Customer\Repositories;

use App\Core\ApiException;
use App\Core\Crypto;
use App\Core\Database;
use App\Core\UlidGenerator;
use PDO;

final class CustomerPortalRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveCustomerByUserId(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM customers WHERE user_id = :user_id AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([':user_id' => $userId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($customer !== false) {
            if ((int) $customer['is_active'] !== 1) {
                throw new ApiException('403_FORBIDDEN', 'Tài khoản khách hàng đang bị tạm khóa.', [], 403);
            }
            return $customer;
        }

        // Tự động khởi tạo hồ sơ customers nếu tài khoản khách vừa đăng ký chưa có bản ghi liên kết
        $uStmt = $this->pdo->prepare('SELECT * FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $uStmt->execute([':id' => $userId]);
        $user = $uStmt->fetch(PDO::FETCH_ASSOC);
        if ($user === false) {
            throw new ApiException('401_UNAUTHORIZED', 'Không tìm thấy tài khoản người dùng.');
        }

        $publicId = UlidGenerator::generate();
        $code = 'KH-' . substr($publicId, -6);
        $ins = $this->pdo->prepare(
            "INSERT INTO customers (
                public_id, user_id, customer_code, customer_type, full_name,
                phone_encrypted, phone_hash, phone_masked, email,
                credit_limit, billing_cycle, is_active, created_by, updated_by
            ) VALUES (
                :public_id, :user_id, :customer_code, 'individual', :full_name,
                :phone_encrypted, :phone_hash, :phone_masked, :email,
                0.00, 'immediate', 1, :created_by, :updated_by
            )"
        );
        $ins->execute([
            ':public_id' => $publicId,
            ':user_id' => $userId,
            ':customer_code' => $code,
            ':full_name' => $user['full_name'],
            ':phone_encrypted' => $user['phone_encrypted'],
            ':phone_hash' => $user['phone_hash'],
            ':phone_masked' => $user['phone_masked'],
            ':email' => $user['email'],
            ':created_by' => $userId,
            ':updated_by' => $userId,
        ]);

        $stmt->execute([':user_id' => $userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * @param array<string, mixed> $filters
     * @return list<array<string, mixed>>
     */
    public function listAddresses(int $userId, array $filters): array
    {
        $customer = $this->resolveCustomerByUserId($userId);
        $params = [':customer_id' => (int) $customer['id']];
        $where = ['ca.customer_id = :customer_id', 'ca.deleted_at IS NULL'];

        if (!empty($filters['address_type'])) {
            $type = (string) $filters['address_type'];
            if (in_array($type, ['sender', 'receiver'], true)) {
                $where[] = "ca.address_type IN (:address_type, 'both')";
                $params[':address_type'] = $type;
            }
        }

        $sql = 'SELECT ca.*,
                       p.name AS province_name,
                       d.name AS district_name,
                       w.name AS ward_name
                FROM customer_addresses ca
                LEFT JOIN provinces p ON p.id = ca.province_id
                LEFT JOIN districts d ON d.id = ca.district_id
                LEFT JOIN wards w ON w.id = ca.ward_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY ca.is_default DESC, ca.id DESC';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $items = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $items[] = $this->formatAddress($row);
        }

        return $items;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createAddress(int $userId, array $data): array
    {
        return Database::transaction(function () use ($userId, $data): array {
            $customer = $this->resolveCustomerByUserId($userId);
            $customerId = (int) $customer['id'];

            $phone = trim((string) $data['phone']);
            $isDefault = !empty($data['is_default']) ? 1 : 0;
            $addressType = (string) ($data['address_type'] ?? 'both');
            if (!in_array($addressType, ['sender', 'receiver', 'both'], true)) {
                throw new ApiException('422_VALIDATION_ERROR', 'address_type không hợp lệ.', [], 422);
            }

            if ($isDefault === 1) {
                $reset = $this->pdo->prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = :customer_id');
                $reset->execute([':customer_id' => $customerId]);
            }

            $publicId = UlidGenerator::generate();
            $stmt = $this->pdo->prepare(
                'INSERT INTO customer_addresses (
                    public_id, customer_id, address_type, label, contact_name,
                    phone_encrypted, phone_hash, phone_masked,
                    province_id, district_id, ward_id, address_line,
                    latitude, longitude, is_default
                ) VALUES (
                    :public_id, :customer_id, :address_type, :label, :contact_name,
                    :phone_encrypted, :phone_hash, :phone_masked,
                    :province_id, :district_id, :ward_id, :address_line,
                    :latitude, :longitude, :is_default
                )'
            );
            $stmt->execute([
                ':public_id' => $publicId,
                ':customer_id' => $customerId,
                ':address_type' => $addressType,
                ':label' => isset($data['label']) && $data['label'] !== '' ? trim((string) $data['label']) : null,
                ':contact_name' => trim((string) $data['contact_name']),
                ':phone_encrypted' => Crypto::encrypt($phone),
                ':phone_hash' => Crypto::hashPhone($phone),
                ':phone_masked' => Crypto::maskPhone($phone),
                ':province_id' => (int) $data['province_id'],
                ':district_id' => (int) $data['district_id'],
                ':ward_id' => (int) $data['ward_id'],
                ':address_line' => trim((string) $data['address_line']),
                ':latitude' => isset($data['latitude']) && $data['latitude'] !== '' ? (float) $data['latitude'] : null,
                ':longitude' => isset($data['longitude']) && $data['longitude'] !== '' ? (float) $data['longitude'] : null,
                ':is_default' => $isDefault,
            ]);

            return $this->findAddress($customerId, $publicId);
        });
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function updateAddress(int $userId, string $publicId, array $data): array
    {
        return Database::transaction(function () use ($userId, $publicId, $data): array {
            $customer = $this->resolveCustomerByUserId($userId);
            $customerId = (int) $customer['id'];
            $existing = $this->findRawAddress($customerId, $publicId);
            $addressId = (int) $existing['id'];

            if (!empty($data['is_default'])) {
                $reset = $this->pdo->prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = :customer_id');
                $reset->execute([':customer_id' => $customerId]);
            }

            $sets = [];
            $params = [':id' => $addressId];

            if (array_key_exists('address_type', $data)) {
                if (!in_array((string) $data['address_type'], ['sender', 'receiver', 'both'], true)) {
                    throw new ApiException('422_VALIDATION_ERROR', 'address_type không hợp lệ.', [], 422);
                }
                $sets[] = 'address_type = :address_type';
                $params[':address_type'] = (string) $data['address_type'];
            }
            if (array_key_exists('label', $data)) {
                $sets[] = 'label = :label';
                $params[':label'] = $data['label'] === null ? null : trim((string) $data['label']);
            }
            if (array_key_exists('contact_name', $data)) {
                $sets[] = 'contact_name = :contact_name';
                $params[':contact_name'] = trim((string) $data['contact_name']);
            }
            if (array_key_exists('phone', $data) && !empty($data['phone'])) {
                $phone = trim((string) $data['phone']);
                $sets[] = 'phone_encrypted = :phone_encrypted, phone_hash = :phone_hash, phone_masked = :phone_masked';
                $params[':phone_encrypted'] = Crypto::encrypt($phone);
                $params[':phone_hash'] = Crypto::hashPhone($phone);
                $params[':phone_masked'] = Crypto::maskPhone($phone);
            }
            foreach (['province_id', 'district_id', 'ward_id'] as $geoField) {
                if (array_key_exists($geoField, $data)) {
                    $sets[] = "{$geoField} = :{$geoField}";
                    $params[":{$geoField}"] = (int) $data[$geoField];
                }
            }
            if (array_key_exists('address_line', $data)) {
                $sets[] = 'address_line = :address_line';
                $params[':address_line'] = trim((string) $data['address_line']);
            }
            foreach (['latitude', 'longitude'] as $coord) {
                if (array_key_exists($coord, $data)) {
                    $sets[] = "{$coord} = :{$coord}";
                    $params[":{$coord}"] = $data[$coord] === null || $data[$coord] === '' ? null : (float) $data[$coord];
                }
            }
            if (array_key_exists('is_default', $data)) {
                $sets[] = 'is_default = :is_default';
                $params[':is_default'] = (int) (bool) $data['is_default'];
            }

            if ($sets !== []) {
                $stmt = $this->pdo->prepare('UPDATE customer_addresses SET ' . implode(', ', $sets) . ' WHERE id = :id');
                $stmt->execute($params);
            }

            return $this->findAddress($customerId, $publicId);
        });
    }

    public function deleteAddress(int $userId, string $publicId): void
    {
        $customer = $this->resolveCustomerByUserId($userId);
        $existing = $this->findRawAddress((int) $customer['id'], $publicId);
        $stmt = $this->pdo->prepare('UPDATE customer_addresses SET deleted_at = NOW(), is_default = 0 WHERE id = :id');
        $stmt->execute([':id' => (int) $existing['id']]);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginateOwnPickupRequests(int $userId, array $filters, int $page, int $perPage): array
    {
        $customer = $this->resolveCustomerByUserId($userId);
        $params = [':customer_id' => (int) $customer['id']];
        $where = ['pr.customer_id = :customer_id'];

        if (!empty($filters['status'])) {
            $where[] = 'pr.status = :status';
            $params[':status'] = (string) $filters['status'];
        }
        if (!empty($filters['request_code'])) {
            $where[] = 'pr.request_code LIKE :request_code';
            $params[':request_code'] = '%' . trim((string) $filters['request_code']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        $cStmt = $this->pdo->prepare("SELECT COUNT(*) FROM pickup_requests pr WHERE {$whereSql}");
        $cStmt->execute($params);
        $total = (int) $cStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $stmt = $this->pdo->prepare(
            "SELECT pr.*, b.code AS branch_code, b.name AS branch_name,
                    drv.full_name AS driver_name, drv.phone_masked AS driver_phone_masked
             FROM pickup_requests pr
             LEFT JOIN branches b ON b.id = pr.branch_id
             LEFT JOIN users drv ON drv.id = pr.assigned_driver_id
             WHERE {$whereSql}
             ORDER BY pr.id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $items[] = $this->formatPickup($row);
        }

        return ['items' => $items, 'total' => $total];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createPickupRequest(int $userId, array $data): array
    {
        return Database::transaction(function () use ($userId, $data): array {
            $customer = $this->resolveCustomerByUserId($userId);
            $customerId = (int) $customer['id'];

            $pickupMode = (string) ($data['pickup_mode'] ?? 'driver_pickup');
            if (!in_array($pickupMode, ['driver_pickup', 'counter_dropoff'], true)) {
                throw new ApiException('422_VALIDATION_ERROR', 'pickup_mode không hợp lệ.', [], 422);
            }

            if (!empty($data['address_public_id'])) {
                $addr = $this->findRawAddress($customerId, (string) $data['address_public_id']);
                $senderName = (string) $addr['contact_name'];
                $senderPhoneEncrypted = (string) $addr['phone_encrypted'];
                $senderPhoneHash = (string) $addr['phone_hash'];
                $senderPhoneMasked = (string) $addr['phone_masked'];
                $provinceId = (int) $addr['province_id'];
                $districtId = (int) $addr['district_id'];
                $wardId = (int) $addr['ward_id'];
                $pickupAddress = (string) $addr['address_line'];
                $latitude = $addr['latitude'] !== null ? (float) $addr['latitude'] : null;
                $longitude = $addr['longitude'] !== null ? (float) $addr['longitude'] : null;
            } else {
                $phone = trim((string) ($data['sender_phone'] ?? ''));
                $senderName = trim((string) ($data['sender_name'] ?? ''));
                $provinceId = (int) ($data['province_id'] ?? 0);
                $districtId = (int) ($data['district_id'] ?? 0);
                $wardId = (int) ($data['ward_id'] ?? 0);
                $pickupAddress = trim((string) ($data['pickup_address'] ?? ''));

                if ($senderName === '' || $phone === '' || $provinceId < 1 || $districtId < 1 || $wardId < 1 || $pickupAddress === '') {
                    throw new ApiException('422_VALIDATION_ERROR', 'Vui lòng cung cấp đủ thông tin địa chỉ lấy hàng hoặc chọn address_public_id.', [], 422);
                }

                $senderPhoneEncrypted = Crypto::encrypt($phone);
                $senderPhoneHash = Crypto::hashPhone($phone);
                $senderPhoneMasked = Crypto::maskPhone($phone);
                $latitude = isset($data['latitude']) && $data['latitude'] !== '' ? (float) $data['latitude'] : null;
                $longitude = isset($data['longitude']) && $data['longitude'] !== '' ? (float) $data['longitude'] : null;
            }

            $branchId = $this->resolveNearestBranchId(
                !empty($data['branch_id']) ? (int) $data['branch_id'] : null,
                $provinceId,
                $districtId,
            );

            $slaStmt = $this->pdo->query('SELECT pickup_sla_minutes FROM sla_deadlines WHERE is_active = 1 ORDER BY id ASC LIMIT 1');
            $slaMinutes = $slaStmt->fetchColumn();
            $minutes = $slaMinutes !== false ? max(30, (int) $slaMinutes) : 120;

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
                    DATE_ADD(NOW(), INTERVAL {$minutes} MINUTE), 'pending', 1, :created_by
                )"
            );
            $stmt->execute([
                ':public_id' => $publicId,
                ':request_code' => $requestCode,
                ':customer_id' => $customerId,
                ':branch_id' => $branchId,
                ':pickup_mode' => $pickupMode,
                ':sender_name' => $senderName,
                ':sender_phone_encrypted' => $senderPhoneEncrypted,
                ':sender_phone_hash' => $senderPhoneHash,
                ':sender_phone_masked' => $senderPhoneMasked,
                ':province_id' => $provinceId,
                ':district_id' => $districtId,
                ':ward_id' => $wardId,
                ':pickup_address' => $pickupAddress,
                ':latitude' => $latitude,
                ':longitude' => $longitude,
                ':estimated_parcel_count' => max(1, (int) ($data['estimated_parcel_count'] ?? 1)),
                ':estimated_weight_gram' => max(1, (int) ($data['estimated_weight_gram'] ?? 500)),
                ':note' => isset($data['note']) && $data['note'] !== '' ? trim((string) $data['note']) : null,
                ':created_by' => $userId,
            ]);

            return $this->findOwnPickupDetail($userId, $publicId);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function findOwnPickupDetail(int $userId, string $publicId): array
    {
        $customer = $this->resolveCustomerByUserId($userId);
        $stmt = $this->pdo->prepare(
            'SELECT pr.*, b.code AS branch_code, b.name AS branch_name,
                    drv.full_name AS driver_name, drv.phone_masked AS driver_phone_masked
             FROM pickup_requests pr
             LEFT JOIN branches b ON b.id = pr.branch_id
             LEFT JOIN users drv ON drv.id = pr.assigned_driver_id
             WHERE pr.public_id = :public_id AND pr.customer_id = :customer_id
             LIMIT 1'
        );
        $stmt->execute([
            ':public_id' => strtoupper(trim($publicId)),
            ':customer_id' => (int) $customer['id'],
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy yêu cầu lấy hàng.', [], 404);
        }

        return $this->formatPickup($row);
    }

    /**
     * @return array<string, mixed>
     */
    public function cancelOwnPickupRequest(int $userId, string $publicId, string $cancelReason): array
    {
        return Database::transaction(function () use ($userId, $publicId, $cancelReason): array {
            $customer = $this->resolveCustomerByUserId($userId);
            $stmt = $this->pdo->prepare(
                'SELECT * FROM pickup_requests WHERE public_id = :public_id AND customer_id = :customer_id LIMIT 1 FOR UPDATE'
            );
            $stmt->execute([
                ':public_id' => strtoupper(trim($publicId)),
                ':customer_id' => (int) $customer['id'],
            ]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row === false) {
                throw new ApiException('404_NOT_FOUND', 'Không tìm thấy yêu cầu lấy hàng.', [], 404);
            }
            if (!in_array((string) $row['status'], ['pending', 'assigned'], true)) {
                throw new ApiException('422_VALIDATION_ERROR', 'Chỉ có thể hủy yêu cầu lấy hàng khi tài xế chưa nhận đơn (pending/assigned).', [], 422);
            }

            $upd = $this->pdo->prepare(
                "UPDATE pickup_requests
                 SET status = 'cancelled',
                     cancel_reason = :cancel_reason,
                     version = version + 1
                 WHERE id = :id"
            );
            $upd->execute([
                ':cancel_reason' => trim($cancelReason),
                ':id' => (int) $row['id'],
            ]);

            return $this->findOwnPickupDetail($userId, $publicId);
        });
    }

    private function resolveNearestBranchId(?int $requestedBranchId, int $provinceId, int $districtId): int
    {
        if ($requestedBranchId !== null && $requestedBranchId > 0) {
            $stmt = $this->pdo->prepare('SELECT id FROM branches WHERE id = :id AND is_active = 1 AND deleted_at IS NULL LIMIT 1');
            $stmt->execute([':id' => $requestedBranchId]);
            $found = $stmt->fetchColumn();
            if ($found === false) {
                throw new ApiException('422_VALIDATION_ERROR', 'Bưu cục/chi nhánh được chọn không hoạt động.', [], 422);
            }
            return (int) $found;
        }

        $stmt = $this->pdo->prepare(
            'SELECT id FROM branches
             WHERE is_active = 1 AND deleted_at IS NULL
             ORDER BY
                CASE WHEN district_id = :district_id THEN 0 WHEN province_id = :province_id THEN 1 ELSE 2 END ASC,
                id ASC
             LIMIT 1'
        );
        $stmt->execute([':district_id' => $districtId, ':province_id' => $provinceId]);
        $branchId = $stmt->fetchColumn();
        if ($branchId === false) {
            throw new ApiException('500_INTERNAL_ERROR', 'Hệ thống chưa có chi nhánh/bưu cục hoạt động để tiếp nhận yêu cầu.');
        }

        return (int) $branchId;
    }

    /**
     * @return array<string, mixed>
     */
    private function findRawAddress(int $customerId, string $publicId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM customer_addresses WHERE customer_id = :customer_id AND public_id = :public_id AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([
            ':customer_id' => $customerId,
            ':public_id' => strtoupper(trim($publicId)),
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy địa chỉ trong sổ địa chỉ.', [], 404);
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function findAddress(int $customerId, string $publicId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ca.*, p.name AS province_name, d.name AS district_name, w.name AS ward_name
             FROM customer_addresses ca
             LEFT JOIN provinces p ON p.id = ca.province_id
             LEFT JOIN districts d ON d.id = ca.district_id
             LEFT JOIN wards w ON w.id = ca.ward_id
             WHERE ca.customer_id = :customer_id AND ca.public_id = :public_id AND ca.deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([
            ':customer_id' => $customerId,
            ':public_id' => strtoupper(trim($publicId)),
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $this->formatAddress($row);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatAddress(array $row): array
    {
        return [
            'public_id' => $row['public_id'],
            'address_type' => $row['address_type'],
            'label' => $row['label'],
            'contact_name' => $row['contact_name'],
            'phone' => Crypto::decrypt((string) $row['phone_encrypted']),
            'phone_masked' => $row['phone_masked'],
            'province_id' => (int) $row['province_id'],
            'province_name' => $row['province_name'] ?? null,
            'district_id' => (int) $row['district_id'],
            'district_name' => $row['district_name'] ?? null,
            'ward_id' => (int) $row['ward_id'],
            'ward_name' => $row['ward_name'] ?? null,
            'address_line' => $row['address_line'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'is_default' => (bool) $row['is_default'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatPickup(array $row): array
    {
        return [
            'public_id' => $row['public_id'],
            'request_code' => $row['request_code'],
            'branch_id' => (int) $row['branch_id'],
            'branch_code' => $row['branch_code'] ?? null,
            'branch_name' => $row['branch_name'] ?? null,
            'pickup_mode' => $row['pickup_mode'],
            'sender_name' => $row['sender_name'],
            'sender_phone' => !empty($row['sender_phone_encrypted']) ? Crypto::decrypt((string) $row['sender_phone_encrypted']) : null,
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
            'assigned_driver' => $row['assigned_driver_id'] !== null ? [
                'full_name' => $row['driver_name'] ?? null,
                'phone_masked' => $row['driver_phone_masked'] ?? null,
            ] : null,
            'picked_up_at' => $row['picked_up_at'],
            'failure_reason' => $row['failure_reason'],
            'cancel_reason' => $row['cancel_reason'],
            'version' => (int) $row['version'],
            'created_at' => $row['created_at'],
        ];
    }
}