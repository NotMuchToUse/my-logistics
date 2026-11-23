# 03_NETWORK_LOSS_AND_OFFLINE.md — Phòng ngừa Lỗi Mất Mạng, Timeout & Đồng bộ Offline (Vietstar Logistics)

> **Tài liệu bắt buộc dành cho mọi AI Coding Assistant & Thành viên Team KHA trước khi code các luồng gửi form trên Web (`vietstar-web-internal`, `vietstar-web-customer`), xử lý Idempotency trên Server (`vietstar-server-api`) và đồng bộ Offline trên Mobile (`vietstar-driver-mobile`).**

---

## Tình huống 1: Người dùng Bấm Đúp / Spam Nút "Tạo Vận Đơn" hoặc "Khóa Bảng Kê" Khi Mạng Lag (Double Submit)

#### (1) Kịch bản thực tế

- Nhân viên tiếp tân tại quầy (`receptionist`) bấm nút **"Tạo vận đơn"** hoặc Kế toán bưu cục (`branch_accountant`) bấm nút **"Khóa bảng kê thu tiền"** (`cash_collections`).
- Do đường truyền Wi-Fi bưu cục chập chờn mất 3–4 giây chưa phản hồi, người dùng tưởng chưa ăn lệnh nên bấm liên tiếp 2–3 lần vào nút lưu.

#### (2) Hậu quả nếu code ẩu

- Nếu Frontend không khóa nút khi đang gửi request và Backend không kiểm tra `Idempotency-Key`:
  - Hệ thống tạo ra **2–3 vận đơn giống hệt nhau** với các mã `tracking_code` khác nhau cho cùng 1 kiện hàng vật lý, làm lệch dải mã `tracking_number_ranges` và báo cáo doanh thu.
  - Bảng kê thu tiền COD bị xử lý lặp gây xung đột Transaction hoặc trừ sai công nợ tài xế.

#### (3) Cách xử lý chuẩn kỹ thuật

Áp dụng phòng thủ đồng thời ở cả **2 đầu (Frontend + Backend)**:

1. **Phía Frontend (ReactJS)**:
   - Khóa cứng nút bấm (`disabled={isSubmitting}`) ngay tại thời điểm hàm `onSubmit` bắt đầu chạy, chỉ mở lại khi có phản hồi hoàn tất hoặc lỗi.
   - Sinh **1 mã `Idempotency-Key` (UUID v4)** cho mỗi lượt thao tác của người dùng (lưu trong `useRef` của form submit) và gắn vào Header `Idempotency-Key`.
2. **Phía Backend (`vietstar-server-api` — `IdempotencyMiddleware`)**:
   - Băm nội dung request (`hash('sha256', $method . '|' . $uri . '|' . $rawBody)`) thành `request_hash`.
   - Kiểm tra bảng `idempotency_keys` theo cặp `(user_id, idempotency_key)`:
     - Nếu chưa tồn tại: Chèn bản ghi mới với `status = 'processing'` trước khi gọi Controller.
     - Nếu đã tồn tại và `status = 'processing'`: Trả ngay mã lỗi chuẩn **`409_IDEMPOTENCY_DUPLICATE`** (_"Giao dịch đang được xử lý, vui lòng không gửi lặp lại"_).
     - Nếu đã tồn tại, `status = 'completed'` và trùng `request_hash`: Trả về nguyên vẹn `response_status` + `response_body` đã lưu mà **không chạy lại nghiệp vụ**.
     - Nếu trùng `idempotency_key` nhưng khác `request_hash` (cố tình dùng lại key cũ cho dữ liệu khác): Trả ngay **`409_IDEMPOTENCY_DUPLICATE`**.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```javascript
// Mẫu Hook chống Double Submit & giữ nguyên Idempotency-Key khi retry (ReactJS)
import { useRef, useState } from "react";
import axiosClient from "@/core/api/axiosClient";

export function useIdempotentSubmit(apiUrl) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idempotencyKeyRef = useRef(null);

  const submit = async (payload) => {
    if (isSubmitting) {
      return null;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    setIsSubmitting(true);
    try {
      const response = await axiosClient.post(apiUrl, payload, {
        headers: {
          "Idempotency-Key": idempotencyKeyRef.current,
        },
      });
      // Thành công mới reset key để lần tạo đơn tiếp theo dùng key mới
      idempotencyKeyRef.current = null;
      return response.data;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting };
}
```

- **Quy tắc bắt buộc cho AI**:
  - Mọi nút Submit tạo dữ liệu, chốt phiếu kho, khóa bảng kê COD hoặc duyệt đền bù trên React bắt buộc ràng buộc `disabled={isSubmitting}`.
  - Chỉ xóa/tạo mới `Idempotency-Key` sau khi nhận được phản hồi thành công (`2xx`) hoặc lỗi dữ liệu (`422`); nếu gặp lỗi mạng/timeout phải giữ nguyên `Idempotency-Key` cũ cho lần bấm "Thử lại".

---

## Tình huống 2: Request Timeout (Client Báo Lỗi Mạng Nhưng MySQL Đã Ghi Thành Công)

#### (1) Kịch bản thực tế

- Khách hàng doanh nghiệp (`customer_corporate`) hoặc nhân viên tiếp tân bấm gửi yêu cầu tạo vận đơn.
- Gói tin đã đến được `vietstar-server-api`, PHP đã thực thi xong `COMMIT` vào MySQL và cập nhật `idempotency_keys.status = 'completed'`, nhưng đúng khoảnh khắc Server gửi phản hồi về thì mạng của Client bị đứt/timeout (Axios báo `ECONNABORTED` hoặc `Network Error`).
- Người dùng không thấy đơn hiện lên màn hình nên bấm nút **"Thử lại"** lần thứ 2.

#### (2) Hậu quả nếu code ẩu

- Nếu lần bấm "Thử lại" gửi đi không có `Idempotency-Key` (hoặc sinh `Idempotency-Key` mới), hệ thống sẽ tạo thêm một vận đơn trùng lặp thứ 2.
- Ngược lại, nếu Backend gặp trùng `Idempotency-Key` đã `completed` mà lại trả về lỗi `409` thay vì trả lại kết quả cũ, người dùng sẽ bị kẹt vĩnh viễn ở màn hình báo lỗi trong khi thực tế đơn hàng đã nằm trong Database.
- Ngoài ra, nếu lần gửi đầu tiên bị sập tiến trình PHP giữa chừng (Fatal Error / hết RAM) trước khi kịp cập nhật `completed`, bản ghi trong `idempotency_keys` bị kẹt mãi ở `processing` khiến người dùng không bao giờ retry được với key đó.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Replay nguyên vẹn Response khi `status = 'completed'`**:
   - Khi Backend tìm thấy bản ghi `idempotency_keys` có `status = 'completed'` và `request_hash` khớp 100% với request đang gọi lại, Server trả về đúng HTTP status code (`200`/`201`) và nội dung JSON đã lưu trong `response_body`. Phía Frontend nhận kết quả như một lần gọi thành công bình thường và chuyển hướng sang trang chi tiết đơn.
2. **Cơ chế thu hồi khóa treo (`Stale Processing Recovery`)**:
   - Nếu bản ghi trong `idempotency_keys` đang ở `status = 'processing'` nhưng thời gian tạo (`created_at`) đã quá **60 giây** (dấu hiệu tiến trình PHP trước đó bị crash ngang), cho phép tiến trình mới chiếm lại quyền xử lý với khóa dòng `FOR UPDATE` để thực hiện lại giao dịch an toàn.
3. **Dọn dẹp tự động (`TTL 24 giờ`)**:
   - Mỗi bản ghi `idempotency_keys` có cột `expires_at = NOW() + INTERVAL 24 HOUR` để tối ưu dung lượng bảng.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Middleware;

use PDO;
use RuntimeException;

final class IdempotencyMiddleware
{
    private const STALE_PROCESSING_SECONDS = 60;

    public function __construct(private readonly PDO $pdo) {}

    /**
     * Kiểm tra và khởi tạo khóa Idempotency trước khi thực thi Controller.
     * Trả về mảng response đã lưu nếu request là bản retry hợp lệ của giao dịch đã hoàn tất.
     *
     * @param int $userId
     * @param string|null $idempotencyKey
     * @param string $method
     * @param string $uri
     * @param string $rawBody
     * @return array{replayed: bool, status_code?: int, body?: string, record_id?: int}
     */
    public function handleBefore(
        int $userId,
        ?string $idempotencyKey,
        string $method,
        string $uri,
        string $rawBody
    ): array {
        if ($idempotencyKey === null \vert{}\vert{} trim($idempotencyKey) === '') {
            throw new RuntimeException('400_BAD_REQUEST');
        }

        $requestHash = hash('sha256', strtoupper($method) . '|' . $uri . '\vert{}' .$rawBody);

        $this->pdo->beginTransaction();
        try {
            $stmt =$this->pdo->prepare(
                "SELECT id, request_hash, status, response_status, response_body,
                        TIMESTAMPDIFF(SECOND, created_at, NOW()) AS elapsed_seconds
                 FROM idempotency_keys
                 WHERE user_id = :user_id
                   AND idempotency_key = :idempotency_key
                 FOR UPDATE"
            );
            $stmt->execute([
                ':user_id' => $userId,
                ':idempotency_key' => trim($idempotencyKey),
            ]);
            $existing =$stmt->fetch();

            if ($existing !== false) {
                if ($existing['request_hash'] !== $requestHash) {$this->pdo->commit();
                    throw new RuntimeException('409_IDEMPOTENCY_DUPLICATE');
                }

                if ($existing['status'] === 'completed') {$this->pdo->commit();
                    return [
                        'replayed' => true,
                        'status_code' => (int) $existing['response_status'],
                        'body' => (string) $existing['response_body'],
                    ];
                }

                if ((int) $existing['elapsed_seconds'] < self::STALE_PROCESSING_SECONDS) {$this->pdo->commit();
                    throw new RuntimeException('409_IDEMPOTENCY_DUPLICATE');
                }

                // Thu hồi bản ghi processing bị treo quá 60s do crash tiến trình trước
                $resetStmt =$this->pdo->prepare(
                    "UPDATE idempotency_keys SET created_at = NOW() WHERE id = :id"
                );
                $resetStmt->execute([':id' => $existing['id']]);$this->pdo->commit();

                return [
                    'replayed' => false,
                    'record_id' => (int) $existing['id'],
                ];
            }

            $insertStmt =$this->pdo->prepare(
                "INSERT INTO idempotency_keys
                    (user_id, idempotency_key, endpoint, request_hash, status, expires_at, created_at)
                 VALUES
                    (:user_id, :idempotency_key, :endpoint, :request_hash, 'processing', DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW())"
            );
            $insertStmt->execute([
                ':user_id' => $userId,
                ':idempotency_key' => trim($idempotencyKey),
                ':endpoint' => strtoupper($method) . ' ' .$uri,
                ':request_hash' => $requestHash,
            ]);
            $recordId = (int) $this->pdo->lastInsertId();$this->pdo->commit();

            return [
                'replayed' => false,
                'record_id' => $recordId,
            ];
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {$this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Lưu kết quả JSON sau khi nghiệp vụ hoàn tất để phục vụ replay khi retry.
     *
     * @param int $recordId
     * @param int $statusCode
     * @param string $jsonBody
     * @return void
     */
    public function markCompleted(int $recordId, int $statusCode, string$jsonBody): void
    {
        $stmt =$this->pdo->prepare(
            "UPDATE idempotency_keys
             SET status = 'completed',
                 response_status = :status_code,
                 response_body = :response_body
             WHERE id = :id"
        );
        $stmt->execute([
            ':status_code' => $statusCode,
            ':response_body' => $jsonBody,
            ':id' => $recordId,
        ]);
    }
}
```

- **Quy tắc bắt buộc cho AI**: Mọi endpoint `POST`/`PATCH` có gắn `IdempotencyMiddleware` phải gọi `markCompleted()` ngay sau khi Service trả kết quả thành công và trước khi xuất JSON ra client.

---

## Tình huống 3: Tài xế Mất Sóng 4G Dưới Hầm Chung Cư Khi Giao Hàng, Lên Mặt Đất Đồng Bộ Thì Điều Phối Ở Nhà Đã Lỡ Hủy Đơn

#### (1) Kịch bản thực tế

- Tài xế lấy/giao (`pickup_delivery_driver`) mang vận đơn `VS26112300088` (đang ở trạng thái `out_for_delivery`, `version = 4`) xuống tầng hầm B2 tòa nhà chung cư giao cho khách.
- Dưới hầm mất hoàn toàn sóng 4G: Tài xế giao hàng cho khách, thu `350.000đ` COD, chụp ảnh POD và bấm **"Giao thành công"**. Ứng dụng Mobile lưu sự kiện vào `offline_sync_queue` với `client_event_uuid` và `Idempotency-Key`.
- 10 phút sau, ở văn phòng bưu cục, Điều phối viên tưởng khách hủy nên chuyển vận đơn này sang trạng thái `cancelled` (`version = 5`).
- 5 phút tiếp theo, tài xế chạy xe lên mặt đất có sóng 4G, `Sync Manager` tự động đẩy gói tin `delivered` lên `vietstar-server-api`.

#### (2) Hậu quả nếu code ẩu

- **Nếu Server ghi đè mù quáng (`UPDATE shipments SET status = 'delivered'`)**: Vận đơn đang ở trạng thái kết thúc `cancelled` bị nhảy ngược sang `delivered`, làm sai lệch toàn bộ báo cáo hủy đơn và tạo ra công nợ COD `driver_holding` trên một đơn đã bị hủy.
- **Nếu Mobile cứ retry vô hạn khi Server báo lỗi**: Hàng đợi `offline_sync_queue` chạy theo cơ chế FIFO sẽ bị tắc nghẽn tại đơn lỗi này, khiến 20 đơn giao thành công phía sau của tài xế không thể đồng bộ lên hệ thống.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Phía Server (`vietstar-server-api` — Kiểm tra kép `client_event_uuid` + State Machine)**:
   - Bước 1: Kiểm tra `client_event_uuid` trong bảng `shipment_status_history`. Nếu đã tồn tại -> trả ngay `200 OK` (chống gửi trùng gói tin offline).
   - Bước 2: Mở Transaction, khóa dòng `SELECT id, status, version, cod_amount FROM shipments WHERE public_id = :public_id FOR UPDATE`.
   - Bước 3: Kiểm tra chuyển đổi trạng thái theo **Bảng State Machine chuẩn (`AI_SYNC_CONTRACT.md`)**: chỉ cho phép chuyển sang `delivered` nếu trạng thái hiện tại là `out_for_delivery`. Vì DB đang là `cancelled`, Server từ chối ngay với mã **`422_VALIDATION_ERROR`** và đính kèm `current_status: "cancelled"` trong `error.details`.
2. **Phía Mobile (`vietstar-driver-mobile` — Cô lập Xung đột & Không chặn Hàng đợi FIFO)**:
   - Khi `Sync Manager` nhận mã lỗi `422_VALIDATION_ERROR` hoặc `409_VERSION_CONFLICT`:
     - Chuyển trạng thái bản ghi trong `offline_sync_queue` sang `conflict`, lưu lại `last_error_code` và `last_error_message`.
     - **Không dừng hàng đợi FIFO**: Tiếp tục đẩy các bản ghi `pending` kế tiếp của các vận đơn khác.
     - Hiển thị thông báo cảnh báo đỏ nổi bật trên App để tài xế báo ngay cho Điều phối/Quản lý chi nhánh xử lý ngoại lệ thực tế (vì hàng đã giao tận tay khách).

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Services;

use PDO;
use RuntimeException;

final class DriverDeliverySyncService
{
    private const VALID_TRANSITIONS_TO_DELIVERED = ['out_for_delivery'];

    public function __construct(private readonly PDO $pdo) {}

    /**
     * Xử lý đồng bộ sự kiện giao hàng thành công từ Mobile Driver (hỗ trợ Offline Sync).
     *
     * @param string $shipmentPublicId
     * @param int $driverId
     * @param string $clientEventUuid
     * @param string|null $podPhotoUrl
     * @return array<string, mixed>
     */
    public function confirmDeliveredFromDriver(
        string $shipmentPublicId,
        int $driverId,
        string $clientEventUuid,
        ?string $podPhotoUrl
    ): array {
        // 1. Chống trùng sự kiện offline qua client_event_uuid
        $dupStmt =$this->pdo->prepare(
            "SELECT id FROM shipment_status_history WHERE client_event_uuid = :uuid LIMIT 1"
        );
        $dupStmt->execute([':uuid' =>$clientEventUuid]);
        if ($dupStmt->fetch() !== false) {
            return [
                'public_id' => $shipmentPublicId,
                'status' => 'delivered',
                'already_synced' => true,
            ];
        }

        $this->pdo->beginTransaction();
        try {
            $stmt =$this->pdo->prepare(
                "SELECT id, current_branch_id, assigned_driver_id, status, cod_amount, version
                 FROM shipments
                 WHERE public_id = :public_id
                   AND deleted_at IS NULL
                 FOR UPDATE"
            );
            $stmt->execute([':public_id' =>$shipmentPublicId]);
            $shipment =$stmt->fetch();

            if ($shipment === false) {
                throw new RuntimeException('404_NOT_FOUND');
            }

            if ((int) $shipment['assigned_driver_id'] !==$driverId) {
                throw new RuntimeException('403_FORBIDDEN');
            }

            // 2. Kiểm tra nghiêm ngặt State Machine (chặn nếu Điều phối ở nhà đã hủy/hoàn đơn)
            if (!in_array($shipment['status'], self::VALID_TRANSITIONS_TO_DELIVERED, true)) {
                throw new RuntimeException('422_VALIDATION_ERROR');
            }

            $newVersion = (int)$shipment['version'] + 1;

            $updateShipment =$this->pdo->prepare(
                "UPDATE shipments
                 SET status = 'delivered',
                     delivered_at = NOW(),
                     version = :new_version,
                     updated_at = NOW()
                 WHERE id = :id"
            );
            $updateShipment->execute([
                ':new_version' => $newVersion,
                ':id' => $shipment['id'],
            ]);

            $insertHistory =$this->pdo->prepare(
                "INSERT INTO shipment_status_history
                    (shipment_id, branch_id, actor_id, old_status, new_status, client_event_uuid, attachment_url, created_at)
                 VALUES
                    (:shipment_id, :branch_id, :actor_id, :old_status, 'delivered', :client_event_uuid, :attachment_url, NOW())"
            );
            $insertHistory->execute([
                ':shipment_id' => $shipment['id'],
                ':branch_id' => $shipment['current_branch_id'],
                ':actor_id' => $driverId,
                ':old_status' => $shipment['status'],
                ':client_event_uuid' => $clientEventUuid,
                ':attachment_url' => $podPhotoUrl,
            ]);

            $this->pdo->commit();

            return [
                'public_id' => $shipmentPublicId,
                'status' => 'delivered',
                'version' => $newVersion,
                'already_synced' => false,
            ];
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {$this->pdo->rollBack();
            }
            throw $e;
        }
    }
}
```

- **Quy tắc bắt buộc cho AI**:
  - Server **KHÔNG BAO GIỜ** được tin tưởng dữ liệu offline gửi trễ mà bỏ qua kiểm tra bảng State Machine; nếu trạng thái hiện tại trong DB đã chuyển sang `cancelled`, `returned` hoặc `in_warehouse` không hợp lệ thì bắt buộc từ chối bằng `422_VALIDATION_ERROR`.
  - Mobile `Sync Manager` khi gặp lỗi `409` hoặc `422` phải đánh dấu `conflict` để cảnh báo người dùng và tiếp tục đẩy các gói tin kế tiếp trong hàng đợi FIFO.
