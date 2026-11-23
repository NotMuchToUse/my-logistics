# AI_RULES.md — Quy tắc Thiết kế Offline-First & Ràng buộc Kỹ thuật (`vietstar-driver-mobile`)

> **Tài liệu đặt chờ bắt buộc dành cho mọi AI Coding Assistant (Cursor, Windsurf, Cline, Claude Code, Copilot, Web Chat AI) khi triển khai repository `vietstar-driver-mobile` ở Giai đoạn 2.**
> Luôn đọc kèm 2 tài liệu gốc dùng chung toàn hệ thống: `AI_SYNC_CONTRACT.md` và `PROJECT_CONTEXT.md`.

---

## 0. Quy tắc Khởi động Bắt buộc (Chưa chốt Framework Mobile)

1. **Xác nhận Tech Stack trước khi sinh code**:
   - Repository này hiện ở trạng thái **đặt chờ** (triển khai sau khi hoàn tất `vietstar-server-api`, `vietstar-web-internal`, `vietstar-web-customer`).
   - Trước khi khởi tạo project hoặc viết bất kỳ file UI/Native nào, AI **BẮT BUỘC hỏi lại `Khang`** để chốt framework chính thức (ví dụ: _React Native / Expo_, _Flutter_, hoặc _Android Native Kotlin_).
2. **Độc lập kiến trúc**:
   - Dù chọn framework nào, toàn bộ luồng dữ liệu, tên cột Local DB, cấu trúc hàng đợi Offline, định dạng JSON và mã lỗi **PHẢI TUÂN THỦ 100%** tài liệu này và `AI_SYNC_CONTRACT.md`.

---

## 1. Quy tắc Thiết kế Hướng Offline-First (Offline-First Architecture Rules)

Tài xế thường xuyên thao tác ở tầng hầm chung cư, thang máy, khu công nghiệp hoặc vùng sâu vùng xa (`districts.is_remote_area = 1`) bị mất sóng 4G/5G. Do đó, **mọi thao tác nghiệp vụ không bao giờ được treo chờ mạng**:

1. **Ghi cục bộ trước, đồng bộ sau (Local Write First)**:
   - Khi tài xế bấm xác nhận _(Nhận lệnh lấy, Lấy hàng thành công, Giao thành công, Giao thất bại, Thu tiền COD, Bàn giao túi trung chuyển)_, ứng dụng phải lưu ngay sự kiện vào bảng hàng đợi `offline_sync_queue` trong Local DB (`sync_status = 'pending'`), cập nhật trạng thái hiển thị trên màn hình ngay lập tức (Optimistic UI), sau đó `Sync Manager` tự động đẩy lên Server ngay khi có mạng.
2. **Đảm bảo thứ tự FIFO nghiêm ngặt (`created_at ASC`)**:
   - Hàng đợi đồng bộ bắt buộc đẩy tuần tự theo thời gian tạo trên thiết bị (`created_at ASC`) để không bao giờ vi phạm State Machine trên Server (ví dụ: không thể đẩy sự kiện `delivered` lên trước khi sự kiện `out_for_delivery` hoặc `picked_up` được Server ghi nhận).
3. **Không retry vô hạn lỗi nghiệp vụ 4xx**:
   - Lỗi mạng (`Timeout`, `Network Error`) hoặc `5xx`: Giữ trạng thái `pending` và tự động thử lại theo cơ chế lùi dần theo cấp số nhân (_Exponential Backoff_: `5s -> 15s -> 45s -> 2m`).
   - Lỗi `409_VERSION_CONFLICT` hoặc `422_VALIDATION_ERROR`: Đánh dấu bản ghi hàng đợi sang `conflict` / `failed_permanent`, **dừng retry bản ghi đó** để không làm tắc các lệnh phía sau, hiển thị cảnh báo đỏ trên màn hình _"Cần xử lý đồng bộ"_ và tải lại dữ liệu mới nhất từ Server.
   - Lỗi `401_UNAUTHORIZED`: Tạm dừng `Sync Manager`, giữ nguyên hàng đợi trong Local DB (không xóa mất dữ liệu chưa gửi) và yêu cầu tài xế đăng nhập lại.

---

## 2. Quy tắc Sinh UUID Bắt buộc Tại Thiết bị (`Idempotency-Key` & `client_event_uuid`)

Để chống trùng lặp đơn hàng, trùng lịch sử hành trình hoặc cộng đúp tiền COD giữ hộ (`cod_transactions.status = 'driver_holding'`) khi mạng chập chờn:

1. **Sinh đồng thời 2 mã UUID v4 ngay tại thời điểm bấm nút**:
   - **`Idempotency-Key`**: Gửi trong HTTP Header `Idempotency-Key` để Server đối chiếu qua bảng `idempotency_keys`.
   - **`client_event_uuid`**: Gửi bên trong JSON Request Body để Server lưu vào cột `shipment_status_history.client_event_uuid` (ràng buộc `UNIQUE`), đảm bảo mỗi thao tác ngoài hiện trường chỉ tạo đúng **1 mốc hành trình** và chỉ ghi nhận **1 lần thu tiền COD**.
2. **Bất biến khi Retry (Immutable Retry Keys)**:
   - Cả `Idempotency-Key` và `client_event_uuid` phải được lưu cứng trong bản ghi của `offline_sync_queue`.
   - Khi `Sync Manager` thử gửi lại một gói tin bị rớt mạng trước đó, **BẮT BUỘC dùng lại nguyên vẹn 2 mã UUID cũ** — tuyệt đối **CẤM** sinh mã UUID mới khi retry.

---

## 3. Quy tắc Xử lý Ảnh Biên lai Trắng/Hồng & Chứng từ Hiện trường

Tài xế chụp ảnh **biên lai trắng/hồng** (phiếu gửi hàng có chữ ký), ảnh kiện hàng lúc giao (`POD`) và ảnh hàng hóa hư hỏng (`shipment_incidents`). Mạng 4G yếu sẽ làm treo luồng đồng bộ nếu gửi ảnh gốc 5MB–12MB:

1. **Nén & Giảm kích thước bắt buộc trên thiết bị trước khi đưa vào hàng đợi**:
   - Resize cạnh dài nhất về tối đa **`1280px`** (hoặc `1600px` đối với biên lai trắng/hồng có nhiều chữ nhỏ).
   - Nén định dạng **JPEG** chất lượng **`75% – 80%`**, đảm bảo dung lượng tệp sau nén **`<= 400 KB`** (tuyệt đối không vượt quá giới hạn `5 MB` của `vietstar-server-api`).
   - Giữ đủ độ tương phản để đọc rõ mã vận đơn `tracking_code` và chữ ký trên liên trắng/hồng.
2. **Tách bước Upload ảnh & Đồng bộ trạng thái**:
   - Ảnh sau khi nén được lưu vào thư mục bộ nhớ cục bộ của App (`attachment_local_uri`).
   - Khi có mạng, `Sync Manager` upload file ảnh qua endpoint `multipart/form-data` để nhận về `file_url` / `file_path` từ Server, lưu lại đường dẫn này vào bản ghi hàng đợi rồi mới gửi request `POST`/`PATCH` cập nhật trạng thái vận đơn/sự cố.

---

## 4. Quy tắc Chống AI Tự Bịa & Chuẩn Giao tiếp API

1. **Cấm tự bịa API, Field JSON hoặc Trạng thái**:
   - **CẤM** tự bịa endpoint ngoài `AI_SYNC_CONTRACT.md`.
   - **CẤM** đổi tên trường JSON sang `camelCase` khi gửi/nhận API (`tracking_code`, `public_id`, `cod_amount`, `client_event_uuid`, `version` phải giữ nguyên `snake_case` 100%).
   - **CẤM** tự bịa giá trị `status` ngoài bảng State Machine chuẩn của `shipments`, `pickup_requests`, `cod_transactions`, `warehouse_receipts`.
2. **Header bắt buộc mọi Request từ Mobile App**:
   - `X-Client-Type: mobile_driver`
   - `Accept: application/json`
   - `Authorization: Bearer <plain_token>`
   - `Idempotency-Key: <uuid_v4_tu_local_queue>` (với mọi request ghi dữ liệu/đồng bộ).
3. **Chia nhỏ từng lớp khi sinh code (Không cắt ngang)**:
   - Khi triển khai một tính năng cho Mobile App, AI bắt buộc chia nhỏ từng phần (`Local DB Schema -> Offline Queue & Sync Service -> API Client -> State Management -> Screen UI`), xuất code hoàn chỉnh 100% từng phần và dừng lại chờ xác nhận, tuyệt đối không viết tắt `// ... tương tự`.
