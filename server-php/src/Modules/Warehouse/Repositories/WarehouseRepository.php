<?php

declare(strict_types=1);

namespace App\Modules\Warehouse\Repositories;

use PDO;

final class WarehouseRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findWarehouseById(int $warehouseId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT w.id, w.public_id, w.branch_id, w.code, w.name, w.warehouse_type, w.is_active,
                    b.code AS branch_code, b.name AS branch_name
             FROM warehouses w
             INNER JOIN branches b ON b.id = w.branch_id
             WHERE w.id = :id AND w.deleted_at IS NULL AND b.deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([':id' => $warehouseId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @param array<int, int>|null $allowedWarehouseIds
     * @return list<array<string, mixed>>
     */
    public function listActiveWarehouses(?array $allowedWarehouseIds = null): array
    {
        $where = ['w.is_active = 1', 'w.deleted_at IS NULL', 'b.deleted_at IS NULL'];
        $params = [];
        if ($allowedWarehouseIds !== null) {
            if ($allowedWarehouseIds === []) {
                return [];
            }
            $ph = [];
            foreach (array_values($allowedWarehouseIds) as $i => $wid) {
                $key = ":awh_{$i}";
                $ph[] = $key;
                $params[$key] = $wid;
            }
            $where[] = 'w.id IN (' . implode(', ', $ph) . ')';
        }

        $stmt = $this->pdo->prepare(
            'SELECT w.id, w.public_id, w.branch_id, w.code, w.name, w.warehouse_type,
                    b.code AS branch_code, b.name AS branch_name
             FROM warehouses w
             INNER JOIN branches b ON b.id = w.branch_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY w.id ASC'
        );
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param array<int, int>|null $allowedWarehouseIds
     * @return array<string, mixed>|null
     */
    public function findFirstWarehouseInScope(?array $allowedWarehouseIds): ?array
    {
        $where = ['w.is_active = 1', 'w.deleted_at IS NULL', 'b.deleted_at IS NULL'];
        $params = [];
        if ($allowedWarehouseIds !== null) {
            if ($allowedWarehouseIds === []) {
                return null;
            }
            $ph = [];
            foreach (array_values($allowedWarehouseIds) as $i => $wid) {
                $key = ":fw_{$i}";
                $ph[] = $key;
                $params[$key] = $wid;
            }
            $where[] = 'w.id IN (' . implode(', ', $ph) . ')';
        }

        $stmt = $this->pdo->prepare(
            'SELECT w.id, w.public_id, w.branch_id, w.code, w.name, w.warehouse_type, w.is_active,
                    b.code AS branch_code, b.name AS branch_name
             FROM warehouses w
             INNER JOIN branches b ON b.id = w.branch_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY w.id ASC
             LIMIT 1'
        );
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findPrimaryWarehouseByBranchId(int $branchId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT w.id, w.public_id, w.branch_id, w.code, w.name, w.warehouse_type, w.is_active,
                    b.code AS branch_code, b.name AS branch_name
             FROM warehouses w
             INNER JOIN branches b ON b.id = w.branch_id
             WHERE w.branch_id = :branch_id AND w.is_active = 1 AND w.deleted_at IS NULL
             ORDER BY w.id ASC
             LIMIT 1'
        );
        $stmt->execute([':branch_id' => $branchId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findBranchById(int $branchId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, public_id, code, name, branch_type, is_active
             FROM branches
             WHERE id = :id AND deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([':id' => $branchId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @param array<int, int>|null $allowedBranchIds
     * @return list<array<string, mixed>>
     */
    public function listVehicles(?array $allowedBranchIds = null): array
    {
        $where = ['v.deleted_at IS NULL', "v.status <> 'retired'"];
        $params = [];
        if ($allowedBranchIds !== null) {
            if ($allowedBranchIds === []) {
                return [];
            }
            $ph = [];
            foreach (array_values($allowedBranchIds) as $i => $bid) {
                $key = ":vb_{$i}";
                $ph[] = $key;
                $params[$key] = $bid;
            }
            $where[] = 'v.branch_id IN (' . implode(', ', $ph) . ')';
        }

        $stmt = $this->pdo->prepare(
            'SELECT v.id, v.branch_id, v.plate_number, v.vehicle_type, v.max_payload_kg, v.status
             FROM vehicles v
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY v.id ASC'
        );
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findVehicleById(int $vehicleId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, branch_id, plate_number, vehicle_type, max_payload_kg, status
             FROM vehicles
             WHERE id = :id AND deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([':id' => $vehicleId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listActivePartners(): array
    {
        $stmt = $this->pdo->query(
            'SELECT id, code, name, partner_type, is_active
             FROM third_party_partners
             WHERE is_active = 1 AND deleted_at IS NULL
             ORDER BY id ASC'
        );

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findPartnerById(int $partnerId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, code, name, partner_type, is_active
             FROM third_party_partners
             WHERE id = :id AND deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([':id' => $partnerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @param array<int, int>|null $allowedWarehouseIds
     * @return list<array<string, mixed>>
     */
    public function listLinehaulShipmentFixtures(?array $allowedWarehouseIds = null): array
    {
        $where = ["s.status IN ('in_warehouse', 'picked_up', 'pending_return')", 's.deleted_at IS NULL'];
        $params = [];
        if ($allowedWarehouseIds !== null) {
            if ($allowedWarehouseIds === []) {
                return [];
            }
            $ph = [];
            foreach (array_values($allowedWarehouseIds) as $i => $wid) {
                $key = ":lsw_{$i}";
                $ph[] = $key;
                $params[$key] = $wid;
            }
            $where[] = 's.current_warehouse_id IN (' . implode(', ', $ph) . ')';
        }

        $stmt = $this->pdo->prepare(
            'SELECT s.tracking_code, s.status, s.current_warehouse_id, s.destination_branch_id, s.chargeable_weight_gram
             FROM shipments s
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY s.id ASC
             LIMIT 200'
        );
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param array<int, int>|null $allowedWarehouseIds
     * @return list<array<string, mixed>>
     */
    public function listSealedBagFixtures(?array $allowedWarehouseIds = null): array
    {
        $where = ["mb.status IN ('open', 'sealed', 'in_transit')"];
        $params = [];
        if ($allowedWarehouseIds !== null) {
            if ($allowedWarehouseIds === []) {
                return [];
            }
            $ph = [];
            foreach (array_values($allowedWarehouseIds) as $i => $wid) {
                $key = ":lbw_{$i}";
                $ph[] = $key;
                $params[$key] = $wid;
            }
            $where[] = 'mb.origin_warehouse_id IN (' . implode(', ', $ph) . ')';
        }

        $stmt = $this->pdo->prepare(
            'SELECT mb.id, mb.bag_code, mb.seal_number, mb.origin_warehouse_id, mb.destination_warehouse_id,
                    mb.total_weight_gram, mb.status
             FROM manifest_bags mb
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY mb.id ASC
             LIMIT 200'
        );
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listDriversByBranch(int $branchId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT DISTINCT u.id, u.public_id, u.employee_code, u.full_name, u.phone_masked,
                    u.is_active, :branch_id AS branch_id,
                    (
                        SELECT v.plate_number
                        FROM vehicles v
                        WHERE v.default_driver_id = u.id AND v.deleted_at IS NULL AND v.status <> 'retired'
                        ORDER BY v.id ASC
                        LIMIT 1
                    ) AS vehicle_plate,
                    (
                        SELECT COUNT(*)
                        FROM shipments s
                        WHERE s.assigned_driver_id = u.id
                          AND s.status = 'out_for_delivery'
                          AND s.deleted_at IS NULL
                    ) AS active_delivery_count
             FROM users u
             INNER JOIN user_has_roles uhr ON uhr.user_id = u.id
             INNER JOIN roles r ON r.id = uhr.role_id AND r.code = 'driver'
             INNER JOIN user_branch_scopes ubs ON ubs.user_id = u.id
             WHERE u.deleted_at IS NULL
               AND u.is_active = 1
               AND u.user_type = 'staff'
               AND (ubs.branch_id = :scope_branch_id OR ubs.scope_type = 'hq_all')
             ORDER BY u.full_name ASC"
        );
        $stmt->execute([
            ':branch_id' => $branchId,
            ':scope_branch_id' => $branchId,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findDriverInBranch(int $driverId, int $branchId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT DISTINCT u.id, u.public_id, u.employee_code, u.full_name, u.phone_masked, u.is_active
             FROM users u
             INNER JOIN user_has_roles uhr ON uhr.user_id = u.id
             INNER JOIN roles r ON r.id = uhr.role_id AND r.code = 'driver'
             INNER JOIN user_branch_scopes ubs ON ubs.user_id = u.id
             WHERE u.id = :driver_id
               AND u.deleted_at IS NULL
               AND u.is_active = 1
               AND u.user_type = 'staff'
               AND (ubs.branch_id = :branch_id OR ubs.scope_type = 'hq_all')
             LIMIT 1"
        );
        $stmt->execute([
            ':driver_id' => $driverId,
            ':branch_id' => $branchId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listAvailableDeliveryShipments(int $warehouseId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT s.id AS shipment_id, s.public_id AS shipment_public_id, s.tracking_code,
                    s.status, s.current_branch_id, s.current_warehouse_id, s.destination_branch_id,
                    s.recipient_name, s.recipient_phone_masked, s.recipient_address,
                    s.chargeable_weight_gram, s.parcel_count, s.cod_amount
             FROM shipments s
             WHERE s.current_warehouse_id = :warehouse_id
               AND s.status IN ('in_warehouse', 'delivery_failed')
               AND s.deleted_at IS NULL
               AND NOT EXISTS (
                   SELECT 1
                   FROM warehouse_receipt_items wri
                   INNER JOIN warehouse_receipts wr ON wr.id = wri.receipt_id
                   WHERE wri.shipment_id = s.id
                     AND wri.removed_at IS NULL
                     AND wr.receipt_type = 'outbound_delivery'
                     AND wr.status IN ('draft', 'unlocked')
               )
             ORDER BY s.is_priority DESC, s.id ASC
             LIMIT 200"
        );
        $stmt->execute([':warehouse_id' => $warehouseId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findActiveDeliveryDraftByWarehouse(int $warehouseId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT public_id
             FROM warehouse_receipts
             WHERE warehouse_id = :warehouse_id
               AND receipt_type = 'outbound_delivery'
               AND status IN ('draft', 'unlocked')
             ORDER BY id DESC
             LIMIT 1"
        );
        $stmt->execute([':warehouse_id' => $warehouseId]);
        $publicId = $stmt->fetchColumn();
        if (!is_string($publicId) || $publicId === '') {
            return null;
        }

        return $this->findReceiptByPublicId($publicId, false);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listRecentConfirmedDeliveryReceipts(int $warehouseId, int $limit = 10): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT wr.*, w.code AS warehouse_code, w.name AS warehouse_name, w.branch_id,
                    b.code AS branch_code, b.name AS branch_name,
                    tw.code AS target_warehouse_code, tw.name AS target_warehouse_name,
                    du.employee_code AS driver_code, du.full_name AS driver_name, du.phone_masked AS driver_phone_masked,
                    cu.full_name AS created_by_name,
                    cfu.full_name AS confirmed_by_name,
                    ulu.full_name AS unlocked_by_name
             FROM warehouse_receipts wr
             INNER JOIN warehouses w ON w.id = wr.warehouse_id
             INNER JOIN branches b ON b.id = w.branch_id
             LEFT JOIN warehouses tw ON tw.id = wr.target_warehouse_id
             LEFT JOIN users du ON du.id = wr.driver_id
             LEFT JOIN users cu ON cu.id = wr.created_by
             LEFT JOIN users cfu ON cfu.id = wr.confirmed_by
             LEFT JOIN users ulu ON ulu.id = wr.unlocked_by
             WHERE wr.warehouse_id = :warehouse_id
               AND wr.receipt_type = 'outbound_delivery'
               AND wr.status IN ('confirmed', 'handed_over')
             ORDER BY wr.id DESC
             LIMIT :lim"
        );
        $stmt->bindValue(':warehouse_id', $warehouseId, PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findRoutingRule(int $originWarehouseId, int $destinationBranchId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT r.id, r.origin_warehouse_id, r.destination_branch_id, r.next_hop_warehouse_id,
                    r.transport_mode, r.estimated_transit_hours, r.is_active,
                    ow.code AS origin_warehouse_code, ow.name AS origin_warehouse_name, ow.branch_id AS origin_branch_id,
                    db.code AS destination_branch_code, db.name AS destination_branch_name,
                    nw.code AS next_hop_warehouse_code, nw.name AS next_hop_warehouse_name, nw.branch_id AS next_hop_branch_id
             FROM branch_routing_rules r
             INNER JOIN warehouses ow ON ow.id = r.origin_warehouse_id
             INNER JOIN branches db ON db.id = r.destination_branch_id
             INNER JOIN warehouses nw ON nw.id = r.next_hop_warehouse_id
             WHERE r.origin_warehouse_id = :origin_warehouse_id
               AND r.destination_branch_id = :destination_branch_id
               AND r.is_active = 1
             LIMIT 1'
        );
        $stmt->execute([
            ':origin_warehouse_id' => $originWarehouseId,
            ':destination_branch_id' => $destinationBranchId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listRoutingRules(?int $originWarehouseId = null, ?int $destinationBranchId = null): array
    {
        $where = ['r.is_active = 1'];
        $params = [];
        if ($originWarehouseId !== null) {
            $where[] = 'r.origin_warehouse_id = :origin_warehouse_id';
            $params[':origin_warehouse_id'] = $originWarehouseId;
        }
        if ($destinationBranchId !== null) {
            $where[] = 'r.destination_branch_id = :destination_branch_id';
            $params[':destination_branch_id'] = $destinationBranchId;
        }

        $sql = 'SELECT r.id, r.origin_warehouse_id, r.destination_branch_id, r.next_hop_warehouse_id,
                       r.transport_mode, r.estimated_transit_hours, r.is_active,
                       ow.code AS origin_warehouse_code, ow.name AS origin_warehouse_name,
                       db.code AS destination_branch_code, db.name AS destination_branch_name,
                       nw.code AS next_hop_warehouse_code, nw.name AS next_hop_warehouse_name
                FROM branch_routing_rules r
                INNER JOIN warehouses ow ON ow.id = r.origin_warehouse_id
                INNER JOIN branches db ON db.id = r.destination_branch_id
                INNER JOIN warehouses nw ON nw.id = r.next_hop_warehouse_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY r.origin_warehouse_id ASC, r.destination_branch_id ASC';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findShipmentByTrackingCode(string $trackingCode, bool $forUpdate = false): ?array
    {
        $sql = 'SELECT s.id, s.public_id, s.tracking_code, s.shipment_type, s.status,
                       s.origin_branch_id, s.destination_branch_id, s.current_branch_id, s.current_warehouse_id,
                       s.assigned_driver_id, s.recipient_name, s.recipient_phone_masked, s.recipient_address,
                       s.parcel_count, s.chargeable_weight_gram, s.cod_amount, s.storage_deadline, s.version,
                       db.code AS destination_branch_code, db.name AS destination_branch_name
                FROM shipments s
                LEFT JOIN branches db ON db.id = s.destination_branch_id
                WHERE s.tracking_code = :tracking_code AND s.deleted_at IS NULL
                LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':tracking_code' => $trackingCode]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, int>|null $allowedWarehouseIds
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginateReceipts(array $filters, ?array $allowedWarehouseIds): array
    {
        $where = ['1 = 1'];
        $params = [];

        if ($allowedWarehouseIds !== null) {
            if ($allowedWarehouseIds === []) {
                return ['items' => [], 'total' => 0];
            }
            $placeholders = [];
            foreach (array_values($allowedWarehouseIds) as $i => $wid) {
                $key = ":aw_{$i}";
                $placeholders[] = $key;
                $params[$key] = $wid;
            }
            $where[] = 'wr.warehouse_id IN (' . implode(', ', $placeholders) . ')';
        }

        if ($filters['status'] !== null) {
            $where[] = 'wr.status = :status';
            $params[':status'] = $filters['status'];
        }
        if ($filters['receipt_type'] !== null) {
            $where[] = 'wr.receipt_type = :receipt_type';
            $params[':receipt_type'] = $filters['receipt_type'];
        }
        if ($filters['warehouse_id'] !== null) {
            $where[] = 'wr.warehouse_id = :warehouse_id';
            $params[':warehouse_id'] = $filters['warehouse_id'];
        }
        if ($filters['branch_id'] !== null) {
            $where[] = 'w.branch_id = :branch_id';
            $params[':branch_id'] = $filters['branch_id'];
        }
        if ($filters['receipt_code'] !== null) {
            $where[] = 'wr.receipt_code = :receipt_code';
            $params[':receipt_code'] = $filters['receipt_code'];
        }
        if ($filters['from'] !== null) {
            $where[] = 'wr.created_at >= :from_dt';
            $params[':from_dt'] = $filters['from'] . ' 00:00:00';
        }
        if ($filters['to'] !== null) {
            $where[] = 'wr.created_at <= :to_dt';
            $params[':to_dt'] = $filters['to'] . ' 23:59:59';
        }

        $whereSql = implode(' AND ', $where);
        $countStmt = $this->pdo->prepare(
            "SELECT COUNT(*)
             FROM warehouse_receipts wr
             INNER JOIN warehouses w ON w.id = wr.warehouse_id
             WHERE {$whereSql}"
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = ($filters['page'] - 1) * $filters['per_page'];
        $sql = "SELECT wr.public_id, wr.receipt_code, wr.receipt_type, wr.warehouse_id, wr.target_warehouse_id,
                       wr.driver_id, wr.vehicle_id, wr.partner_id, wr.total_shipments, wr.total_bags, wr.total_weight_gram, wr.status,
                       wr.confirmed_at, wr.unlocked_at, wr.unlock_reason, wr.handed_over_at,
                       wr.note, wr.version, wr.created_at, wr.updated_at,
                       w.code AS warehouse_code, w.name AS warehouse_name, w.branch_id,
                       b.name AS branch_name,
                       tw.code AS target_warehouse_code, tw.name AS target_warehouse_name,
                       du.employee_code AS driver_code, du.full_name AS driver_name, du.phone_masked AS driver_phone_masked,
                       cu.full_name AS created_by_name,
                       cfu.full_name AS confirmed_by_name,
                       ulu.full_name AS unlocked_by_name
                FROM warehouse_receipts wr
                INNER JOIN warehouses w ON w.id = wr.warehouse_id
                INNER JOIN branches b ON b.id = w.branch_id
                LEFT JOIN warehouses tw ON tw.id = wr.target_warehouse_id
                LEFT JOIN users du ON du.id = wr.driver_id
                LEFT JOIN users cu ON cu.id = wr.created_by
                LEFT JOIN users cfu ON cfu.id = wr.confirmed_by
                LEFT JOIN users ulu ON ulu.id = wr.unlocked_by
                WHERE {$whereSql}
                ORDER BY wr.id DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $filters['per_page'], PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public function insertReceipt(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO warehouse_receipts (
                public_id, receipt_code, receipt_type, warehouse_id, target_warehouse_id,
                driver_id, vehicle_id, partner_id, total_shipments, total_bags, total_weight_gram,
                status, note, version, created_by, updated_by, created_at, updated_at
            ) VALUES (
                :public_id, :receipt_code, :receipt_type, :warehouse_id, :target_warehouse_id,
                :driver_id, :vehicle_id, :partner_id, 0, 0, 0,
                :status, :note, 1, :created_by, :updated_by, NOW(), NOW()
            )'
        );
        $stmt->execute([
            ':public_id' => $data['public_id'],
            ':receipt_code' => $data['receipt_code'],
            ':receipt_type' => $data['receipt_type'],
            ':warehouse_id' => $data['warehouse_id'],
            ':target_warehouse_id' => $data['target_warehouse_id'],
            ':driver_id' => $data['driver_id'],
            ':vehicle_id' => $data['vehicle_id'],
            ':partner_id' => $data['partner_id'] ?? null,
            ':status' => $data['status'] ?? 'draft',
            ':note' => $data['note'],
            ':created_by' => $data['created_by'],
            ':updated_by' => $data['created_by'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findReceiptByPublicId(string $publicId, bool $forUpdate = false): ?array
    {
        $sql = 'SELECT wr.*, w.code AS warehouse_code, w.name AS warehouse_name, w.branch_id,
                       b.code AS branch_code, b.name AS branch_name,
                       tw.code AS target_warehouse_code, tw.name AS target_warehouse_name,
                       du.employee_code AS driver_code, du.full_name AS driver_name, du.phone_masked AS driver_phone_masked,
                       cu.full_name AS created_by_name,
                       cfu.full_name AS confirmed_by_name,
                       ulu.full_name AS unlocked_by_name
                FROM warehouse_receipts wr
                INNER JOIN warehouses w ON w.id = wr.warehouse_id
                INNER JOIN branches b ON b.id = w.branch_id
                LEFT JOIN warehouses tw ON tw.id = wr.target_warehouse_id
                LEFT JOIN users du ON du.id = wr.driver_id
                LEFT JOIN users cu ON cu.id = wr.created_by
                LEFT JOIN users cfu ON cfu.id = wr.confirmed_by
                LEFT JOIN users ulu ON ulu.id = wr.unlocked_by
                WHERE wr.public_id = :public_id
                LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':public_id' => $publicId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function hasActiveShipmentInReceipt(int $receiptId, int $shipmentId): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM warehouse_receipt_items
             WHERE receipt_id = :receipt_id AND shipment_id = :shipment_id AND removed_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([
            ':receipt_id' => $receiptId,
            ':shipment_id' => $shipmentId,
        ]);

        return $stmt->fetchColumn() !== false;
    }

    public function hasActiveBagInReceipt(int $receiptId, int $bagId): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM warehouse_receipt_items
             WHERE receipt_id = :receipt_id AND bag_id = :bag_id AND removed_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([
            ':receipt_id' => $receiptId,
            ':bag_id' => $bagId,
        ]);

        return $stmt->fetchColumn() !== false;
    }

    public function hasActiveShipmentInOpenDeliveryReceipt(int $shipmentId): bool
    {
        $stmt = $this->pdo->prepare(
            "SELECT 1
             FROM warehouse_receipt_items wri
             INNER JOIN warehouse_receipts wr ON wr.id = wri.receipt_id
             WHERE wri.shipment_id = :shipment_id
               AND wri.removed_at IS NULL
               AND wr.receipt_type = 'outbound_delivery'
               AND wr.status IN ('draft', 'unlocked')
             LIMIT 1"
        );
        $stmt->execute([':shipment_id' => $shipmentId]);

        return $stmt->fetchColumn() !== false;
    }

    public function insertReceiptItem(
        int $receiptId,
        ?int $shipmentId,
        ?string $inboundSourceType,
        bool $isWrongRoute,
        int $scannedBy,
        ?int $bagId = null,
    ): int {
        $stmt = $this->pdo->prepare(
            'INSERT INTO warehouse_receipt_items (
                receipt_id, shipment_id, bag_id, inbound_source_type, is_wrong_route, scanned_by, scanned_at
            ) VALUES (
                :receipt_id, :shipment_id, :bag_id, :inbound_source_type, :is_wrong_route, :scanned_by, NOW()
            )'
        );
        $stmt->execute([
            ':receipt_id' => $receiptId,
            ':shipment_id' => $shipmentId,
            ':bag_id' => $bagId,
            ':inbound_source_type' => $inboundSourceType,
            ':is_wrong_route' => $isWrongRoute ? 1 : 0,
            ':scanned_by' => $scannedBy,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findActiveReceiptItem(int $receiptId, ?int $itemId, ?string $trackingCode): ?array
    {
        $where = ['wri.receipt_id = :receipt_id', 'wri.removed_at IS NULL'];
        $params = [':receipt_id' => $receiptId];

        if ($itemId !== null) {
            $where[] = 'wri.id = :item_id';
            $params[':item_id'] = $itemId;
        }
        if ($trackingCode !== null) {
            $where[] = 's.tracking_code = :tracking_code';
            $params[':tracking_code'] = $trackingCode;
        }

        $stmt = $this->pdo->prepare(
            'SELECT wri.id, wri.shipment_id, wri.bag_id, s.tracking_code
             FROM warehouse_receipt_items wri
             LEFT JOIN shipments s ON s.id = wri.shipment_id
             WHERE ' . implode(' AND ', $where) . '
             LIMIT 1'
        );
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function removeReceiptItem(int $itemId, int $removedBy, string $removeReason): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE warehouse_receipt_items
             SET removed_by = :removed_by,
                 removed_at = NOW(),
                 remove_reason = :remove_reason
             WHERE id = :id AND removed_at IS NULL'
        );
        $stmt->execute([
            ':removed_by' => $removedBy,
            ':remove_reason' => $removeReason,
            ':id' => $itemId,
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listReceiptItems(int $receiptId, bool $includeRemoved = false): array
    {
        $removedCond = $includeRemoved ? '' : ' AND wri.removed_at IS NULL';
        $stmt = $this->pdo->prepare(
            "SELECT wri.id, wri.shipment_id, wri.bag_id, wri.inbound_source_type,
                    wri.is_wrong_route, wri.scanned_at, wri.removed_at, wri.remove_reason,
                    s.public_id AS shipment_public_id, s.tracking_code, s.status AS shipment_status,
                    s.recipient_name, s.recipient_phone_masked, s.recipient_address,
                    s.chargeable_weight_gram, s.parcel_count, s.cod_amount, s.destination_branch_id,
                    mb.bag_code, mb.seal_number, mb.shipment_count AS bag_shipment_count,
                    mb.total_weight_gram AS bag_weight_gram,
                    db.code AS destination_branch_code, db.name AS destination_branch_name,
                    u.full_name AS scanned_by_name,
                    ru.full_name AS removed_by_name
             FROM warehouse_receipt_items wri
             LEFT JOIN shipments s ON s.id = wri.shipment_id
             LEFT JOIN manifest_bags mb ON mb.id = wri.bag_id
             LEFT JOIN branches db ON db.id = s.destination_branch_id
             LEFT JOIN users u ON u.id = wri.scanned_by
             LEFT JOIN users ru ON ru.id = wri.removed_by
             WHERE wri.receipt_id = :receipt_id{$removedCond}
             ORDER BY wri.id ASC"
        );
        $stmt->execute([':receipt_id' => $receiptId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function sumActiveReceiptCodAmount(int $receiptId): float
    {
        $stmt = $this->pdo->prepare(
            'SELECT COALESCE(SUM(s.cod_amount), 0)
             FROM warehouse_receipt_items wri
             INNER JOIN shipments s ON s.id = wri.shipment_id
             WHERE wri.receipt_id = :receipt_id AND wri.removed_at IS NULL'
        );
        $stmt->execute([':receipt_id' => $receiptId]);

        return (float) $stmt->fetchColumn();
    }

    public function recalculateReceiptTotals(int $receiptId, int $updatedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE warehouse_receipts wr
             SET total_shipments = (
                     SELECT COUNT(*) FROM warehouse_receipt_items wri
                     WHERE wri.receipt_id = wr.id AND wri.shipment_id IS NOT NULL AND wri.removed_at IS NULL
                 ),
                 total_bags = (
                     SELECT COUNT(*) FROM warehouse_receipt_items wri
                     WHERE wri.receipt_id = wr.id AND wri.bag_id IS NOT NULL AND wri.removed_at IS NULL
                 ),
                 total_weight_gram = (
                     SELECT COALESCE(SUM(
                         CASE
                             WHEN wri.shipment_id IS NOT NULL THEN COALESCE(s.chargeable_weight_gram, 0)
                             WHEN wri.bag_id IS NOT NULL THEN COALESCE(mb.total_weight_gram, 0)
                             ELSE 0
                         END
                     ), 0)
                     FROM warehouse_receipt_items wri
                     LEFT JOIN shipments s ON s.id = wri.shipment_id
                     LEFT JOIN manifest_bags mb ON mb.id = wri.bag_id
                     WHERE wri.receipt_id = wr.id AND wri.removed_at IS NULL
                 ),
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE wr.id = :receipt_id'
        );
        $stmt->execute([
            ':updated_by' => $updatedBy,
            ':receipt_id' => $receiptId,
        ]);
    }

    public function bumpReceiptVersion(int $receiptId, int $updatedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE warehouse_receipts
             SET version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':updated_by' => $updatedBy,
            ':id' => $receiptId,
        ]);
    }

    public function confirmReceipt(int $receiptId, int $confirmedBy, ?string $note): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE warehouse_receipts
             SET status = :status,
                 confirmed_by = :confirmed_by,
                 confirmed_at = NOW(),
                 note = COALESCE(:note, note),
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':status' => 'confirmed',
            ':confirmed_by' => $confirmedBy,
            ':note' => $note,
            ':updated_by' => $confirmedBy,
            ':id' => $receiptId,
        ]);
    }

    public function unlockReceipt(int $receiptId, int $unlockedBy, string $unlockReason): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE warehouse_receipts
             SET status = :status,
                 unlocked_by = :unlocked_by,
                 unlocked_at = NOW(),
                 unlock_reason = :unlock_reason,
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':status' => 'unlocked',
            ':unlocked_by' => $unlockedBy,
            ':unlock_reason' => $unlockReason,
            ':updated_by' => $unlockedBy,
            ':id' => $receiptId,
        ]);
    }

    public function assignShipmentOutForDelivery(
        int $shipmentId,
        int $driverId,
        int $branchId,
        int $warehouseId,
        int $updatedBy,
    ): void {
        $stmt = $this->pdo->prepare(
            'UPDATE shipments
             SET assigned_driver_id = :driver_id,
                 current_branch_id = :branch_id,
                 current_warehouse_id = :warehouse_id,
                 status = :status,
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':driver_id' => $driverId,
            ':branch_id' => $branchId,
            ':warehouse_id' => $warehouseId,
            ':status' => 'out_for_delivery',
            ':updated_by' => $updatedBy,
            ':id' => $shipmentId,
        ]);
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, int>|null $allowedWarehouseIds
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginateBags(array $filters, ?array $allowedWarehouseIds): array
    {
        $where = ['1 = 1'];
        $params = [];

        if ($allowedWarehouseIds !== null) {
            if ($allowedWarehouseIds === []) {
                return ['items' => [], 'total' => 0];
            }
            $origPh = [];
            $destPh = [];
            foreach (array_values($allowedWarehouseIds) as $i => $wid) {
                $origPh[] = ":ow_{$i}";
                $destPh[] = ":dw_{$i}";
                $params[":ow_{$i}"] = $wid;
                $params[":dw_{$i}"] = $wid;
            }
            $where[] = '(mb.origin_warehouse_id IN (' . implode(', ', $origPh) . ') OR mb.destination_warehouse_id IN (' . implode(', ', $destPh) . '))';
        }

        if ($filters['status'] !== null) {
            $where[] = 'mb.status = :status';
            $params[':status'] = $filters['status'];
        }
        if ($filters['origin_warehouse_id'] !== null) {
            $where[] = 'mb.origin_warehouse_id = :origin_warehouse_id';
            $params[':origin_warehouse_id'] = $filters['origin_warehouse_id'];
        }
        if ($filters['destination_warehouse_id'] !== null) {
            $where[] = 'mb.destination_warehouse_id = :destination_warehouse_id';
            $params[':destination_warehouse_id'] = $filters['destination_warehouse_id'];
        }
        if ($filters['bag_code'] !== null) {
            $where[] = 'mb.bag_code = :bag_code';
            $params[':bag_code'] = $filters['bag_code'];
        }
        if ($filters['seal_number'] !== null) {
            $where[] = 'mb.seal_number = :seal_number';
            $params[':seal_number'] = $filters['seal_number'];
        }

        $whereSql = implode(' AND ', $where);
        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM manifest_bags mb WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = ($filters['page'] - 1) * $filters['per_page'];
        $sql = "SELECT mb.public_id, mb.bag_code, mb.seal_number,
                       mb.origin_warehouse_id, mb.destination_warehouse_id,
                       mb.shipment_count, mb.total_weight_gram, mb.status,
                       mb.sealed_at, mb.opened_at, mb.version, mb.created_at, mb.updated_at,
                       ow.code AS origin_warehouse_code, ow.name AS origin_warehouse_name,
                       dw.code AS destination_warehouse_code, dw.name AS destination_warehouse_name
                FROM manifest_bags mb
                INNER JOIN warehouses ow ON ow.id = mb.origin_warehouse_id
                INNER JOIN warehouses dw ON dw.id = mb.destination_warehouse_id
                WHERE {$whereSql}
                ORDER BY mb.id DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $filters['per_page'], PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public function insertBag(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO manifest_bags (
                public_id, bag_code, seal_number, origin_warehouse_id, destination_warehouse_id,
                shipment_count, total_weight_gram, status, version, created_by, updated_by, created_at, updated_at
            ) VALUES (
                :public_id, :bag_code, :seal_number, :origin_warehouse_id, :destination_warehouse_id,
                0, 0, :status, 1, :created_by, :updated_by, NOW(), NOW()
            )'
        );
        $stmt->execute([
            ':public_id' => $data['public_id'],
            ':bag_code' => $data['bag_code'],
            ':seal_number' => $data['seal_number'],
            ':origin_warehouse_id' => $data['origin_warehouse_id'],
            ':destination_warehouse_id' => $data['destination_warehouse_id'],
            ':status' => 'open',
            ':created_by' => $data['created_by'],
            ':updated_by' => $data['created_by'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findBagByPublicId(string $publicId, bool $forUpdate = false): ?array
    {
        $sql = 'SELECT mb.*,
                       ow.code AS origin_warehouse_code, ow.name AS origin_warehouse_name, ow.branch_id AS origin_branch_id,
                       dw.code AS destination_warehouse_code, dw.name AS destination_warehouse_name, dw.branch_id AS destination_branch_id,
                       su.full_name AS sealed_by_name, ou.full_name AS opened_by_name
                FROM manifest_bags mb
                INNER JOIN warehouses ow ON ow.id = mb.origin_warehouse_id
                INNER JOIN warehouses dw ON dw.id = mb.destination_warehouse_id
                LEFT JOIN users su ON su.id = mb.sealed_by
                LEFT JOIN users ou ON ou.id = mb.opened_by
                WHERE mb.public_id = :public_id
                LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':public_id' => $publicId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findBagBySealOrCode(string $code, bool $forUpdate = false): ?array
    {
        $sql = 'SELECT mb.*,
                       ow.code AS origin_warehouse_code, ow.name AS origin_warehouse_name, ow.branch_id AS origin_branch_id,
                       dw.code AS destination_warehouse_code, dw.name AS destination_warehouse_name, dw.branch_id AS destination_branch_id
                FROM manifest_bags mb
                INNER JOIN warehouses ow ON ow.id = mb.origin_warehouse_id
                INNER JOIN warehouses dw ON dw.id = mb.destination_warehouse_id
                WHERE mb.seal_number = :code_seal OR mb.bag_code = :code_bag
                ORDER BY mb.id DESC
                LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':code_seal' => $code,
            ':code_bag' => $code,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function hasActiveShipmentInBag(int $bagId, int $shipmentId): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM manifest_bag_items
             WHERE bag_id = :bag_id AND shipment_id = :shipment_id AND unpacked_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([
            ':bag_id' => $bagId,
            ':shipment_id' => $shipmentId,
        ]);

        return $stmt->fetchColumn() !== false;
    }

    public function insertBagItem(int $bagId, int $shipmentId, int $scannedInBy): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO manifest_bag_items (
                bag_id, shipment_id, scanned_in_by, scanned_in_at
            ) VALUES (
                :bag_id, :shipment_id, :scanned_in_by, NOW()
            )'
        );
        $stmt->execute([
            ':bag_id' => $bagId,
            ':shipment_id' => $shipmentId,
            ':scanned_in_by' => $scannedInBy,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listBagItems(int $bagId, bool $onlyPacked = false): array
    {
        $sql = 'SELECT mbi.id, mbi.scanned_in_at, mbi.unpacked_at,
                       s.id AS shipment_id, s.public_id AS shipment_public_id, s.tracking_code,
                       s.status AS shipment_status, s.chargeable_weight_gram, s.parcel_count,
                       s.destination_branch_id,
                       db.code AS destination_branch_code, db.name AS destination_branch_name,
                       su.full_name AS scanned_in_by_name, uu.full_name AS unpacked_by_name
                FROM manifest_bag_items mbi
                INNER JOIN shipments s ON s.id = mbi.shipment_id
                LEFT JOIN branches db ON db.id = s.destination_branch_id
                LEFT JOIN users su ON su.id = mbi.scanned_in_by
                LEFT JOIN users uu ON uu.id = mbi.unpacked_by
                WHERE mbi.bag_id = :bag_id' . ($onlyPacked ? ' AND mbi.unpacked_at IS NULL' : '') . '
                ORDER BY mbi.id ASC';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':bag_id' => $bagId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function recalculateBagTotals(int $bagId, int $updatedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE manifest_bags mb
             SET shipment_count = (
                     SELECT COUNT(*) FROM manifest_bag_items mbi
                     WHERE mbi.bag_id = mb.id AND mbi.unpacked_at IS NULL
                 ),
                 total_weight_gram = (
                     SELECT COALESCE(SUM(s.chargeable_weight_gram), 0)
                     FROM manifest_bag_items mbi
                     INNER JOIN shipments s ON s.id = mbi.shipment_id
                     WHERE mbi.bag_id = mb.id AND mbi.unpacked_at IS NULL
                 ),
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE mb.id = :bag_id'
        );
        $stmt->execute([
            ':updated_by' => $updatedBy,
            ':bag_id' => $bagId,
        ]);
    }

    public function sealBag(int $bagId, ?string $sealNumber, int $sealedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE manifest_bags
             SET status = :status,
                 seal_number = COALESCE(:seal_number, seal_number),
                 sealed_by = :sealed_by,
                 sealed_at = NOW(),
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':status' => 'sealed',
            ':seal_number' => $sealNumber,
            ':sealed_by' => $sealedBy,
            ':updated_by' => $sealedBy,
            ':id' => $bagId,
        ]);
    }

    public function markBagInTransit(int $bagId, int $updatedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE manifest_bags
             SET status = :status,
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':status' => 'in_transit',
            ':updated_by' => $updatedBy,
            ':id' => $bagId,
        ]);
    }

    public function markBagOpened(int $bagId, int $openedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE manifest_bags
             SET status = :status,
                 opened_by = :opened_by,
                 opened_at = NOW(),
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':status' => 'opened',
            ':opened_by' => $openedBy,
            ':updated_by' => $openedBy,
            ':id' => $bagId,
        ]);
    }

    public function markBagItemsUnpacked(int $bagId, int $unpackedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE manifest_bag_items
             SET unpacked_by = :unpacked_by,
                 unpacked_at = NOW()
             WHERE bag_id = :bag_id AND unpacked_at IS NULL'
        );
        $stmt->execute([
            ':unpacked_by' => $unpackedBy,
            ':bag_id' => $bagId,
        ]);
    }

    public function updateShipmentWarehouseLocation(
        int $shipmentId,
        int $branchId,
        ?int $warehouseId,
        string $status,
        int $updatedBy,
    ): void {
        $stmt = $this->pdo->prepare(
            'UPDATE shipments
             SET current_branch_id = :branch_id,
                 current_warehouse_id = :warehouse_id,
                 status = :status,
                 version = version + 1,
                 updated_by = :updated_by,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            ':branch_id' => $branchId,
            ':warehouse_id' => $warehouseId,
            ':status' => $status,
            ':updated_by' => $updatedBy,
            ':id' => $shipmentId,
        ]);
    }

    public function insertShipmentStatusHistory(
        int $shipmentId,
        ?string $fromStatus,
        string $toStatus,
        int $branchId,
        ?int $warehouseId,
        int $actorId,
        string $description,
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO shipment_status_history (
                shipment_id, from_status, to_status, branch_id, warehouse_id,
                actor_id, description, is_public_visible, occurred_at, created_at
            ) VALUES (
                :shipment_id, :from_status, :to_status, :branch_id, :warehouse_id,
                :actor_id, :description, 1, NOW(), NOW()
            )'
        );
        $stmt->execute([
            ':shipment_id' => $shipmentId,
            ':from_status' => $fromStatus,
            ':to_status' => $toStatus,
            ':branch_id' => $branchId,
            ':warehouse_id' => $warehouseId,
            ':actor_id' => $actorId,
            ':description' => mb_substr($description, 0, 500),
        ]);
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, int>|null $allowedWarehouseIds
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function paginateStockAudits(array $filters, ?array $allowedWarehouseIds): array
    {
        $where = ['1 = 1'];
        $params = [];

        if ($allowedWarehouseIds !== null) {
            if ($allowedWarehouseIds === []) {
                return ['items' => [], 'total' => 0];
            }
            $ph = [];
            foreach (array_values($allowedWarehouseIds) as $i => $wid) {
                $key = ":saw_{$i}";
                $ph[] = $key;
                $params[$key] = $wid;
            }
            $where[] = 'wsa.warehouse_id IN (' . implode(', ', $ph) . ')';
        }

        if ($filters['warehouse_id'] !== null) {
            $where[] = 'wsa.warehouse_id = :warehouse_id';
            $params[':warehouse_id'] = $filters['warehouse_id'];
        }
        if ($filters['status'] !== null) {
            $where[] = 'wsa.status = :status';
            $params[':status'] = $filters['status'];
        }
        if ($filters['audit_code'] !== null) {
            $where[] = 'wsa.audit_code = :audit_code';
            $params[':audit_code'] = $filters['audit_code'];
        }

        $whereSql = implode(' AND ', $where);
        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM warehouse_stock_audits wsa WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = ($filters['page'] - 1) * $filters['per_page'];
        $sql = "SELECT wsa.*, w.code AS warehouse_code, w.name AS warehouse_name, w.branch_id,
                       b.name AS branch_name, u.full_name AS auditor_name
                FROM warehouse_stock_audits wsa
                INNER JOIN warehouses w ON w.id = wsa.warehouse_id
                INNER JOIN branches b ON b.id = w.branch_id
                LEFT JOIN users u ON u.id = wsa.auditor_id
                WHERE {$whereSql}
                ORDER BY wsa.id DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $filters['per_page'], PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findStockAuditByIdentifier(string $identifier, bool $forUpdate = false): ?array
    {
        $trimmed = strtoupper(trim($identifier));
        if (ctype_digit($trimmed) && (int) $trimmed > 0) {
            $sql = 'SELECT wsa.*, w.code AS warehouse_code, w.name AS warehouse_name, w.branch_id,
                           b.name AS branch_name, u.full_name AS auditor_name
                    FROM warehouse_stock_audits wsa
                    INNER JOIN warehouses w ON w.id = wsa.warehouse_id
                    INNER JOIN branches b ON b.id = w.branch_id
                    LEFT JOIN users u ON u.id = wsa.auditor_id
                    WHERE wsa.id = :id
                    LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':id' => (int) $trimmed]);
        } else {
            $sql = 'SELECT wsa.*, w.code AS warehouse_code, w.name AS warehouse_name, w.branch_id,
                           b.name AS branch_name, u.full_name AS auditor_name
                    FROM warehouse_stock_audits wsa
                    INNER JOIN warehouses w ON w.id = wsa.warehouse_id
                    INNER JOIN branches b ON b.id = w.branch_id
                    LEFT JOIN users u ON u.id = wsa.auditor_id
                    WHERE wsa.audit_code = :audit_code
                    LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':audit_code' => $trimmed]);
        }

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function insertStockAudit(
        string $auditCode,
        int $warehouseId,
        int $auditorId,
        int $totalExpectedCount,
        ?string $note,
    ): int {
        $stmt = $this->pdo->prepare(
            "INSERT INTO warehouse_stock_audits (
                audit_code, warehouse_id, auditor_id, total_expected_count, total_scanned_count,
                missing_count, overdue_return_count, status, note, created_at, updated_at
            ) VALUES (
                :audit_code, :warehouse_id, :auditor_id, :total_expected_count, 0,
                :missing_count, 0, 'in_progress', :note, NOW(), NOW()
            )"
        );
        $stmt->execute([
            ':audit_code' => $auditCode,
            ':warehouse_id' => $warehouseId,
            ':auditor_id' => $auditorId,
            ':total_expected_count' => $totalExpectedCount,
            ':missing_count' => $totalExpectedCount,
            ':note' => $note,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listExpectedWarehouseShipmentsForAudit(int $warehouseId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT id, tracking_code, status, destination_branch_id, storage_deadline
             FROM shipments
             WHERE current_warehouse_id = :warehouse_id
               AND status IN ('in_warehouse', 'bagged', 'delivery_failed', 'pending_return')
               AND deleted_at IS NULL
             ORDER BY id ASC"
        );
        $stmt->execute([':warehouse_id' => $warehouseId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function insertStockAuditItem(
        int $auditId,
        int $shipmentId,
        string $systemStatus,
        string $scanResult,
        bool $proposeReturn,
        ?string $scannedAtSql,
        ?string $note = null,
    ): int {
        $scannedExpr = $scannedAtSql !== null ? 'NOW()' : 'NULL';
        $stmt = $this->pdo->prepare(
            "INSERT INTO warehouse_stock_audit_items (
                audit_id, shipment_id, system_status, scan_result, propose_return, scanned_at, note
            ) VALUES (
                :audit_id, :shipment_id, :system_status, :scan_result, :propose_return, {$scannedExpr}, :note
            )"
        );
        $stmt->execute([
            ':audit_id' => $auditId,
            ':shipment_id' => $shipmentId,
            ':system_status' => $systemStatus,
            ':scan_result' => $scanResult,
            ':propose_return' => $proposeReturn ? 1 : 0,
            ':note' => $note,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findStockAuditItemByShipment(int $auditId, int $shipmentId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM warehouse_stock_audit_items
             WHERE audit_id = :audit_id AND shipment_id = :shipment_id
             LIMIT 1'
        );
        $stmt->execute([
            ':audit_id' => $auditId,
            ':shipment_id' => $shipmentId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function updateStockAuditItemScan(
        int $itemId,
        string $systemStatus,
        string $scanResult,
        bool $proposeReturn,
        ?string $note,
    ): void {
        $stmt = $this->pdo->prepare(
            'UPDATE warehouse_stock_audit_items
             SET system_status = :system_status,
                 scan_result = :scan_result,
                 propose_return = :propose_return,
                 scanned_at = NOW(),
                 note = COALESCE(:note, note)
             WHERE id = :id'
        );
        $stmt->execute([
            ':system_status' => $systemStatus,
            ':scan_result' => $scanResult,
            ':propose_return' => $proposeReturn ? 1 : 0,
            ':note' => $note,
            ':id' => $itemId,
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listStockAuditItems(int $auditId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT wsai.*, s.public_id AS shipment_public_id, s.tracking_code,
                    s.recipient_name, s.chargeable_weight_gram, s.storage_deadline,
                    db.code AS destination_branch_code, db.name AS destination_branch_name
             FROM warehouse_stock_audit_items wsai
             INNER JOIN shipments s ON s.id = wsai.shipment_id
             LEFT JOIN branches db ON db.id = s.destination_branch_id
             WHERE wsai.audit_id = :audit_id
             ORDER BY wsai.id ASC'
        );
        $stmt->execute([':audit_id' => $auditId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function recalculateStockAuditSummary(int $auditId): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE warehouse_stock_audits wsa
             SET total_expected_count = (
                     SELECT COUNT(*) FROM warehouse_stock_audit_items WHERE audit_id = wsa.id
                 ),
                 total_scanned_count = (
                     SELECT COUNT(*) FROM warehouse_stock_audit_items WHERE audit_id = wsa.id AND scanned_at IS NOT NULL
                 ),
                 missing_count = (
                     SELECT COUNT(*) FROM warehouse_stock_audit_items WHERE audit_id = wsa.id AND scan_result = 'missing'
                 ),
                 overdue_return_count = (
                     SELECT COUNT(*) FROM warehouse_stock_audit_items WHERE audit_id = wsa.id AND (scan_result = 'overdue_storage' OR propose_return = 1)
                 ),
                 updated_at = NOW()
             WHERE wsa.id = :audit_id"
        );
        $stmt->execute([':audit_id' => $auditId]);
    }

    public function completeStockAudit(int $auditId, ?string $note): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE warehouse_stock_audits
             SET status = 'completed',
                 completed_at = NOW(),
                 note = COALESCE(:note, note),
                 updated_at = NOW()
             WHERE id = :id"
        );
        $stmt->execute([
            ':note' => $note,
            ':id' => $auditId,
        ]);
    }

    /**
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    public function insertAuditLog(
        int $userId,
        ?int $branchId,
        string $action,
        string $tableName,
        int $recordId,
        ?array $oldValues,
        ?array $newValues,
        ?string $ipAddress,
        ?string $userAgent,
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO audit_logs (
                user_id, branch_id, action, table_name, record_id,
                old_values, new_values, ip_address, user_agent, created_at
            ) VALUES (
                :user_id, :branch_id, :action, :table_name, :record_id,
                :old_values, :new_values, :ip_address, :user_agent, NOW()
            )'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':branch_id' => $branchId,
            ':action' => $action,
            ':table_name' => $tableName,
            ':record_id' => $recordId,
            ':old_values' => $oldValues !== null ? json_encode($oldValues, JSON_UNESCAPED_UNICODE) : null,
            ':new_values' => $newValues !== null ? json_encode($newValues, JSON_UNESCAPED_UNICODE) : null,
            ':ip_address' => $ipAddress ?: '127.0.0.1',
            ':user_agent' => $userAgent !== null ? mb_substr($userAgent, 0, 500) : null,
        ]);
    }
}