# 02_HIGH_LOAD_AND_CONCURRENCY.md — Phòng ngừa Xung đột Đồng thời & Quá tải Dữ liệu Lớn (Vietstar Logistics)

> **Tài liệu bắt buộc dành cho mọi AI Coding Assistant & Thành viên Team KHA trước khi code các luồng xử lý giao dịch đồng thời, Import hàng loạt và Truy vấn báo cáo/danh sách lớn.**

---

## Tình huống 1: Xung đột Cập nhật Đồng thời (Race Condition) Khi Chuyển Trạng thái Vận đơn, Chốt Phiếu Kho & Thu Tiền COD

#### (1) Kịch bản thực tế

- **Kịch bản A (Lost Update trên Vận đơn / Điều phối)**: Hai nhân viên điều phối cùng mở danh sách yêu cầu lấy hàng `pickup_requests` (đang ở trạng thái `pending`, `version = 1`) và gần như cùng lúc bấm gán cho 2 tài xế khác nhau (`driver_id = 15` và `driver_id = 22`).
- **Kịch bản B (Double-spend / Lệch quỹ tiền mặt COD)**: Kế toán bưu cục bấm đúp nút "Khóa bảng kê thu tiền" (`cash_collections`) hoặc hai nhân viên kho cùng bấm "Chốt phiếu xuất kho" (`warehouse_receipts`), dẫn đến hệ thống cộng dồn 2 lần số tiền thu hoặc chuyển trạng thái vận đơn sai lệch.

#### (2) Hậu quả nếu code ẩu

- Nếu cập nhật theo kiểu đọc trạng thái ở PHP rồi chạy `UPDATE shipments SET status = :new_status WHERE id = :id` mà không kiểm tra `version` và không khóa dòng:
  - Người bấm sau âm thầm ghi đè toàn bộ kết quả của người bấm trước (Lost Update), khiến 2 tài xế cùng chạy đến nhà khách lấy 1 đơn hàng.
  - Bảng kê thu tiền COD hoặc phiếu xuất kho bị xử lý lặp 2 lần gây sai lệch sổ cái tài chính `cod_transactions` và mất dấu kiểm toán.

#### (3) Cách xử lý chuẩn kỹ thuật

Áp dụng đồng thời **3 lớp kiểm soát tương tranh**:

1. **Lớp 1 — Chống bấm đúp Request (`IdempotencyMiddleware`)**: Mọi API tạo/chốt/thu tiền bắt buộc nhận header `Idempotency-Key` (UUID v4) và kiểm tra qua bảng `idempotency_keys`. Nếu request đang xử lý -> trả `409_IDEMPOTENCY_DUPLICATE`; nếu đã hoàn tất -> trả lại đúng response đã lưu.
2. **Lớp 2 — Khóa lạc quan (`version` Optimistic Locking)**: Với các thao tác chỉnh sửa từ giao diện người dùng (`shipments`, `pickup_requests`, `shipment_approval_requests`, `compensations`), client bắt buộc gửi kèm số `version` đang hiển thị. Câu lệnh `UPDATE` phải có điều kiện `WHERE id = :id AND version = :expected_version` và tăng `version = version + 1`. Nếu `rowCount() === 0` -> ném ngay ngoại lệ trả về `409_VERSION_CONFLICT`.
3. **Lớp 3 — Khóa bi quan mức dòng (`SELECT ... FOR UPDATE` trong Transaction)**: Với các thao tác tài chính và chốt sổ (`cash_collections`, `cash_remittances`, `warehouse_receipts`, `tracking_number_ranges`), bắt buộc mở `$pdo->beginTransaction()`, khóa bản ghi bằng `SELECT ... FOR UPDATE`, kiểm tra lại trạng thái hiện tại, cập nhật đồng bộ các bảng liên quan rồi mới `$pdo->commit()`.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Modules\Finance\Services;

use PDO;
use RuntimeException;

final class CashCollectionLockService
{
    public function __construct(private readonly PDO $pdo) {}

    /**
     * Khóa bảng kê thu tiền tài xế an toàn tuyệt đối chống Race Condition.
     *
     * @param string $collectionPublicId
     * @param int $expectedVersion
     * @param int $accountantId
     * @param int $branchId
     * @return array<string, mixed>
     */
    public function lockCollection(
        string $collectionPublicId,
        int $expectedVersion,
        int $accountantId,
        int $branchId
    ): array {
        $this->pdo->beginTransaction();

        try {
            $stmt = $this->pdo->prepare(
                "SELECT id, branch_id, driver_id, total_collected_amount, status, version
                 FROM cash_collections
                 WHERE public_id = :public_id
                 FOR UPDATE"
            );
            $stmt->execute([':public_id' => $collectionPublicId]);
            $collection = $stmt->fetch();

            if ($collection === false) {
                throw new RuntimeException('404_NOT_FOUND');
            }

            if ((int) $collection['branch_id'] !== $branchId) {
                throw new RuntimeException('403_BRANCH_SCOPE');
            }

            if ((int) $collection['version'] !== $expectedVersion) {
                throw new RuntimeException('409_VERSION_CONFLICT');
            }

            if ($collection['status'] !== 'draft') {
                throw new RuntimeException('422_VALIDATION_ERROR');
            }

            $updateCollection = $this->pdo->prepare(
                "UPDATE cash_collections
                 SET status = 'locked',
                     locked_at = NOW(),
                     version = version + 1,
                     updated_at = NOW()
                 WHERE id = :id
                   AND version = :version"
            );
            $updateCollection->execute([
                ':id' => $collection['id'],
                ':version' => $expectedVersion,
            ]);

            if ($updateCollection->rowCount() === 0) {
                throw new RuntimeException('409_VERSION_CONFLICT');
            }

            $updateLedger = $this->pdo->prepare(
                "UPDATE cod_transactions
                 SET status = 'collected_by_branch',
                     collected_by_branch_at = NOW(),
                     version = version + 1,
                     updated_at = NOW()
                 WHERE collection_id = :collection_id
                   AND status = 'driver_holding'"
            );
            $updateLedger->execute([':collection_id' => $collection['id']]);

            $this->pdo->commit();

            return [
                'public_id' => $collectionPublicId,
                'status' => 'locked',
                'version' => $expectedVersion + 1,
            ];
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }
}
```

- **Quy tắc bắt buộc cho AI**:
  - Mọi API cập nhật bảng có cột `version` (`pickup_requests`, `shipments`, `shipment_approval_requests`, `manifest_bags`, `warehouse_receipts`, `compensations`, `cod_transactions`, `cash_collections`, `cash_remittances`, `customer_invoices`) **bắt buộc** kiểm tra `version` ở cả tầng `Validator` và mệnh đề `WHERE` của SQL `UPDATE`.
  - Luôn bọc `$pdo->inTransaction()` kiểm tra trước khi gọi `$pdo->rollBack()` trong khối `catch`.

---

## Tình huống 2: Quá tải & Timeout PHP Khi Import Excel Hàng Ngàn Vận đơn Cùng Lúc

#### (1) Kịch bản thực tế

- Khách hàng doanh nghiệp (`customer_corporate`) hoặc nhân viên tiếp tân upload file Excel chứa **2.000 – 5.000 dòng vận đơn** lên API `POST /api/v1/shipments/bulk-import`.
- Tại thời điểm đó, các bưu cục khác trên toàn quốc cũng đang tạo đơn lẻ và lấy mã từ bảng `tracking_number_ranges`.

#### (2) Hậu quả nếu code ẩu

- **Lỗi 1 (Hết thời gian thực thi PHP / Tràn RAM)**: Vòng lặp `foreach` 3.000 dòng, mỗi dòng gọi 4–5 câu query `SELECT` địa giới/bảng giá + 4 câu `INSERT` đơn lẻ = **30.000 câu query** trong 1 HTTP Request -> vượt quá `max_execution_time = 30s` của PHP trên Hosting, sinh lỗi `504 Gateway Timeout` và tạo dữ liệu nửa vời.
- **Lỗi 2 (Nghẽn cổ chai Lock trên `tracking_number_ranges`)**: Mở 1 Transaction khổng lồ ngay từ đầu rồi khóa dòng `tracking_number_ranges` suốt 30 giây trong lúc đang validate và tính cước từng dòng -> toàn bộ chi nhánh khác bị treo đứng khi tạo vận đơn.

#### (3) Cách xử lý chuẩn kỹ thuật

Tách quy trình Import hàng loạt thành **3 bước tối ưu hiệu năng cao**:

1. **Bước 1 — Nạp sẵn Danh mục vào RAM & Validate toàn bộ trước khi chạm DB**:
   - Đọc trước danh mục `provinces`, `districts`, `wards`, `service_types`, `pricing_tariffs` vào mảng Hash Map trong RAM (chỉ tốn 3 câu `SELECT` nhỏ).
   - Duyệt toàn bộ mảng dòng từ client gửi lên để validate dữ liệu và tính cước. Nếu có **bất kỳ dòng nào lỗi**, trả ngay `422_VALIDATION_ERROR` kèm mảng `details` chỉ rõ từng `row_index` lỗi — không mở Transaction DB.
2. **Bước 2 — Cấp phát trọn gói dải mã vận đơn trong 1 mili-giây (`Batch Range Allocation`)**:
   - Mở Transaction ngắn, khóa dòng `tracking_number_ranges` của chi nhánh bằng `SELECT ... FOR UPDATE`, cộng một lần duy nhất `current_number = current_number + :total_rows`, kiểm tra không vượt `end_number`, rồi giải phóng khóa ngay.
3. **Bước 3 — Ghi dữ liệu theo từng lô (`Chunked Multi-row Bulk INSERT` mỗi 250 dòng)**:
   - Gom 250 bản ghi vào 1 câu `INSERT INTO shipments (...) VALUES (...), (...), ...` để giảm số lần giao tiếp mạng giữa PHP và MySQL từ hàng chục ngàn lần xuống chỉ còn vài chục câu lệnh.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Repositories;

use PDO;
use RuntimeException;

final class TrackingRangeRepository
{
    public function __construct(private readonly PDO $pdo) {}

    /**
     * Cấp phát trọn gói N mã vận đơn liên tiếp trong 1 lần khóa dòng duy nhất.
     * Bắt buộc gọi bên trong PDO Transaction đang hoạt động.
     *
     * @param int $branchId
     * @param int $quantity Số lượng mã cần cấp phát (>= 1)
     * @return array<int, string> Danh sách mã vận đơn đã cấp phát
     */
    public function allocateBatch(int $branchId, int $quantity): array
    {
        if ($quantity < 1) {
            return [];
        }

        $stmt = $this->pdo->prepare(
            "SELECT id, prefix, current_number, end_number
             FROM tracking_number_ranges
             WHERE branch_id = :branch_id
               AND is_active = 1
             ORDER BY id ASC
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([':branch_id' => $branchId]);
        $range = $stmt->fetch();

        if ($range === false) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        $startNumber = (int) $range['current_number'] + 1;
        $newCurrentNumber = (int) $range['current_number'] + $quantity;

        if ($newCurrentNumber > (int) $range['end_number']) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        $updateStmt = $this->pdo->prepare(
            "UPDATE tracking_number_ranges
             SET current_number = :new_current,
                 updated_at = NOW()
             WHERE id = :id"
        );
        $updateStmt->execute([
            ':new_current' => $newCurrentNumber,
            ':id' => $range['id'],
        ]);

        $codes = [];
        for ($i = $startNumber; $i <= $newCurrentNumber; $i++) {
            $codes[] = $range['prefix'] . str_pad((string) $i, 8, '0', STR_PAD_LEFT);
        }

        return $codes;
    }
}
```

- **Quy tắc bắt buộc cho AI**:
  - **CẤM** gọi truy vấn `SELECT` danh mục (tỉnh/huyện/xã, dịch vụ, bảng giá) bên trong vòng lặp `foreach` của chức năng Import hoặc Xử lý danh sách.
  - Mọi thao tác ghi hàng loạt (`bulk-import`, `warehouse_receipt_items`, `manifest_bag_items`) bắt buộc dùng Multi-row `INSERT` theo chunk tối đa 250–500 dòng/lần.

---

## Tình huống 3: Nghẽn Cổ chai Database Do N+1 Query & Full Table Scan Khi Lọc 5.000+ Vận đơn/Ngày

#### (1) Kịch bản thực tế

- Hệ thống vận hành trung bình **5.000 vận đơn/ngày** (~150.000 vận đơn/tháng, >1.800.000 vận đơn/năm).
- Điều phối viên mở màn hình `shipment-list` lọc các đơn tại chi nhánh hiện tại (`current_branch_id = 12`), trạng thái `in_warehouse`, trong 7 ngày gần nhất, hoặc tìm kiếm nhanh theo **số điện thoại người nhận**.

#### (2) Hậu quả nếu code ẩu

- **Lỗi 1 (N+1 Query)**: Lấy 50 vận đơn ở query đầu tiên, sau đó trong vòng lặp PHP lại chạy thêm 4 câu query mỗi dòng để lấy thông tin chi nhánh đích, tên dịch vụ, tài xế giao và số kiện hàng -> tổng cộng **201 câu query** cho một lần tải trang, làm chậm phản hồi lên 3–5 giây.
- **Lỗi 2 (Full Table Scan)**: Tìm SĐT bằng `LIKE '%090123%'` hoặc lọc `WHERE status = 'in_warehouse' AND current_branch_id = 12` nhưng bảng `shipments` không có Composite Index đúng thứ tự -> MySQL phải quét tuần tự toàn bộ hàng triệu bản ghi trên ổ cứng, làm CPU Database chạm ngưỡng 100%.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Loại bỏ 100% N+1 Query**:
   - Dùng `INNER JOIN` / `LEFT JOIN` cho các bảng quan hệ `1-1` hoặc `N-1` (`branches`, `service_types`, `users`).
   - Với các quan hệ `1-N` (như danh sách kiện hàng `shipment_parcels`), gom toàn bộ `shipment_id` của trang hiện tại lại và truy vấn đúng **1 câu `WHERE shipment_id IN (...)`**, sau đó map vào kết quả bằng mảng kết hợp (`$parcelsByShipmentId[$id]`).
2. **Tìm kiếm SĐT bằng Hash Index O(log N)**:
   - Khi người dùng nhập chuỗi toàn chữ số (9–11 số) vào ô tìm kiếm, chuyển sang băm `Crypto::hashPhone()` và truy vấn bằng toán tử bằng tuyệt đối: `(s.recipient_phone_hash = :phone_hash OR s.sender_phone_hash = :phone_hash)`.
3. **Thiết kế Composite Index chuẩn quy tắc chọn lọc (Selectivity)**:
   - Đặt cột có độ chọn lọc theo chi nhánh và trạng thái trước cột thời gian sắp xếp:
     `INDEX idx_shipments_branch_status_created (current_branch_id, status, created_at DESC)`
     `INDEX idx_shipments_recipient_phone_hash (recipient_phone_hash)`
     `INDEX idx_shipments_sender_phone_hash (sender_phone_hash)`

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Repositories;

use App\Core\Crypto;
use App\Core\ScopeGuard;
use PDO;

final class ShipmentListRepository
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly string $piiHmacKey
    ) {}

    /**
     * Truy vấn danh sách vận đơn phân trang không N+1 Query và tận dụng Composite Index.
     *
     * @param array{scope_type: string, allowed_branch_ids: array<int, int>} $scopeContext
     * @param array<string, mixed> $filters
     * @param int $page
     * @param int $perPage
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateShipments(
        array $scopeContext,
        array $filters,
        int $page = 1,
        int $perPage = 20
    ): array {
        $params = [];
        $conditions = ['s.deleted_at IS NULL'];

        $conditions[] = ScopeGuard::buildBranchWhereClause(
            $scopeContext,
            's.current_branch_id',
            $params
        );

        if (!empty($filters['status'])) {
            $conditions[] = 's.status = :status';
            $params[':status'] = (string) $filters['status'];
        }

        if (!empty($filters['tracking_code'])) {
            $conditions[] = 's.tracking_code = :tracking_code';
            $params[':tracking_code'] = trim((string) $filters['tracking_code']);
        }

        if (!empty($filters['phone'])) {
            $phoneHash = Crypto::hashPhone((string) $filters['phone'], $this->piiHmacKey);
            $conditions[] = '(s.recipient_phone_hash = :recipient_phone_hash OR s.sender_phone_hash = :sender_phone_hash)';
            $params[':recipient_phone_hash'] = $phoneHash;
            $params[':sender_phone_hash'] = $phoneHash;
        }

        if (!empty($filters['from_date'])) {
            $conditions[] = 's.created_at >= :from_date';
            $params[':from_date'] = $filters['from_date'] . ' 00:00:00';
        }

        if (!empty($filters['to_date'])) {
            $conditions[] = 's.created_at <= :to_date';
            $params[':to_date'] = $filters['to_date'] . ' 23:59:59';
        }

        $whereSql = implode(' AND ', $conditions);

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM shipments s WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        if ($total === 0) {
            return ['items' => [], 'total' => 0];
        }

        $offset = max(0, ($page - 1) * $perPage);
        $dataSql = "SELECT s.id, s.public_id, s.tracking_code, s.status,
                           s.sender_name, s.sender_phone_masked,
                           s.recipient_name, s.recipient_phone_masked,
                           s.cod_amount, s.total_freight_amount, s.is_priority,
                           s.version, s.created_at,
                           ob.name AS origin_branch_name,
                           db.name AS destination_branch_name,
                           st.name AS service_type_name,
                           drv.full_name AS assigned_driver_name
                    FROM shipments s
                    INNER JOIN branches ob ON ob.id = s.origin_branch_id
                    INNER JOIN branches db ON db.id = s.destination_branch_id
                    INNER JOIN service_types st ON st.id = s.service_type_id
                    LEFT JOIN users drv ON drv.id = s.assigned_driver_id
                    WHERE {$whereSql}
                    ORDER BY s.created_at DESC
                    LIMIT :limit OFFSET :offset";

        $dataStmt = $this->pdo->prepare($dataSql);
        foreach ($params as $key => $val) {
            $dataStmt->bindValue($key, $val);
        }
        $dataStmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $dataStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $dataStmt->execute();

        $rows = $dataStmt->fetchAll();

        foreach ($rows as &$row) {
            unset($row['id']);
        }
        unset($row);

        return ['items' => $rows, 'total' => $total];
    }
}
```

- **Quy tắc bắt buộc cho AI**:
  - **CẤM** viết câu lệnh SQL nằm trong vòng lặp `for` / `foreach` / `while` dưới mọi tình huống.
  - **CẤM** dùng `SELECT *` trên các bảng lớn (`shipments`, `shipment_status_history`, `cod_transactions`, `audit_logs`); luôn liệt kê tường minh đúng các cột cần thiết để giảm băng thông truyền tải giữa MySQL và PHP.
  - Luôn giới hạn `per_page` tối đa (`min(100, max(1, $perPage))`) để chặn request kéo toàn bộ bảng về bộ nhớ.
