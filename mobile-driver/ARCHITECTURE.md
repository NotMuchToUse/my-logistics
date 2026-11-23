# ARCHITECTURE.md — Khung Kiến trúc Độc lập Công nghệ (`vietstar-driver-mobile`)

> Ứng dụng di động dành riêng cho đội ngũ tài xế của **Logistics Vietstar**, phục vụ 2 vai trò chuyên biệt:
>
> 1. **`pickup_delivery_driver`**: Tài xế lấy/giao hàng chặng đầu & chặng cuối (First-mile / Last-mile).
> 2. **`linehaul_driver`**: Tài xế vận chuyển trung chuyển giữa các kho/trung tâm vùng (Line-haul).
>
> Kiến trúc dưới đây được thiết kế **độc lập với framework UI** (áp dụng đồng nhất cho React Native / Expo, Flutter hoặc Android Native Kotlin).

---

## 1. Sơ đồ Luồng Dữ liệu Offline-First (Data Flow Architecture)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    SCREENS (Phân tách theo 2 Roles)                     │
│  [pickup_delivery_driver Screens]  │  [linehaul_driver Screens]         │
└───────────────┬────────────────────┴───────────────┬────────────────────┘
                │                                    │
                ▼                                    ▼
┌───────────────────────────────┐    ┌────────────────────────────────────┐
│  CAMERA & BARCODE SCANNER     │    │  GPS BACKGROUND TRACKER            │
│  - Quét tracking_code / Seal  │    │  - Ghi tọa độ theo chu kỳ/quãng    │
│  - Chụp & Nén biên lai (<=400K)│    │  - Lưu đệm khi mất sóng 4G         │
└───────────────┬───────────────┘    └───────────────┬────────────────────┘
                │                                    │
                └──────────────────┬─────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LOCAL DB / OFFLINE QUEUE (SQLite)                    │
│  - Bảng dữ liệu cached: local_pickups, local_shipments, local_linehauls │
│  - Bảng hàng đợi: offline_sync_queue (idempotency_key, client_event_uuid)│
│  - Bảng vị trí: local_gps_buffer                                        │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ (FIFO Drain khi có mạng)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              SYNC MANAGER                               │
│  - Lắng nghe Network State & Background Task                            │
│  - Bước 1: Upload ảnh biên lai đã nén -> lấy đường dẫn Server           │
│  - Bước 2: Gửi JSON tuần tự (FIFO) kèm Idempotency-Key & version        │
│  - Phân loại lỗi: Retry (5xx/Mạng) vs Cảnh báo xung đột (409/422)       │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                               API CLIENT                                │
│  - Header bắt buộc: X-Client-Type: mobile_driver, Bearer Token          │
│  - Giao tiếp RESTful JSON với vietstar-server-api                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi tiết 6 Tầng Kiến trúc Bắt buộc

### Tầng 1: `Local DB / Offline Queue` (Cơ sở dữ liệu cục bộ)

- **Công nghệ gợi ý**: SQLite (`expo-sqlite` / `WatermelonDB` nếu dùng React Native; `Drift` / `sqflite` nếu dùng Flutter; `Room` nếu dùng Kotlin).
- **Trách nhiệm**:
  - Lưu trữ danh sách công việc được phân công để tài xế xem và thao tác khi không có Internet (`local_pickup_requests`, `local_shipments`, `local_linehaul_receipts`).
  - Lưu bảng hàng đợi bất biến `offline_sync_queue` gồm các cột bắt buộc:
    - `id` (PK cục bộ)
    - `idempotency_key` (UUID v4 duy nhất cho header `Idempotency-Key`)
    - `client_event_uuid` (UUID v4 duy nhất cho `shipment_status_history.client_event_uuid`)
    - `entity_type` (`pickup_request` | `shipment` | `warehouse_receipt` | `incident`)
    - `entity_public_id` (ULID 26 ký tự)
    - `action_type` (`ACCEPT_PICKUP` | `CONFIRM_PICKED_UP` | `CONFIRM_DELIVERED` | `REPORT_DELIVERY_FAILED` | `CONFIRM_LINEHAUL_HANDOVER` | `REPORT_INCIDENT`)
    - `endpoint` & `http_method`
    - `payload_json` (chuỗi JSON `snake_case` đã đóng gói sẵn)
    - `attachment_local_uri` & `attachment_remote_url`
    - `sync_status` (`pending` | `syncing` | `synced` | `conflict` | `failed_permanent`)
    - `retry_count`, `last_error_code`, `last_error_message`, `created_at`

### Tầng 2: `Sync Manager` (Bộ điều phối đồng bộ nền)

- **Trách nhiệm**:
  - Tự động kích hoạt ngay khi thiết bị có kết nối mạng trở lại, khi tài xế mở App, hoặc khi tài xế bấm nút _"Đồng bộ ngay"_.
  - Đọc các bản ghi `sync_status = 'pending'` theo thứ tự `created_at ASC` (FIFO).
  - Nếu bản ghi có `attachment_local_uri` nhưng chưa có `attachment_remote_url`: gọi API upload ảnh trước; thành công mới cập nhật `attachment_remote_url` vào `payload_json` rồi gọi API nghiệp vụ.
  - Cập nhật lại `version` và `status` mới từ phản hồi của Server xuống bảng dữ liệu cached cục bộ.

### Tầng 3: `Camera & Barcode Scanner` (Quét mã & Nén chứng từ)

- **Trách nhiệm**:
  - **Quét mã vạch liên tục (Continuous Scan)**: Hỗ trợ quét nhanh mã vận đơn (`tracking_code`), mã từng kiện hàng (`shipment_parcels.parcel_code`) và mã niêm phong túi hàng (`manifest_bags.seal_code`), kèm phản hồi rung/âm thanh khi quét trùng hoặc quét sai danh sách được gán.
  - **Chụp & Nén ảnh biên lai trắng/hồng**: Cắt gọn khung hình, resize cạnh tối đa `1280px–1600px`, nén JPEG `75%–80%` (`<= 400 KB`) trước khi lưu đường dẫn vào `offline_sync_queue`.

### Tầng 4: `GPS Background Tracker` (Giám sát định vị hành trình)

- **Trách nhiệm**:
  - Hoạt động ở chế độ dịch vụ nền (Foreground/Background Location Service) trong suốt ca làm việc của tài xế.
  - Thu thập tọa độ (`latitude`, `longitude`, `speed`, `battery_level`, `recorded_at`) mỗi `30–60 giây` hoặc khi di chuyển đủ `100 mét`.
  - Lưu vào `local_gps_buffer` và gửi theo lô (`batch`) lên endpoint `POST /api/v1/driver/gps-logs` để phục vụ màn hình `driver-gps-monitor` trên `vietstar-web-internal`.

### Tầng 5: `API Client` (Giao tiếp HTTP chuẩn Contract)

- **Trách nhiệm**:
  - Đóng gói HTTP Client tự động tiêm 4 header bắt buộc:
    - `X-Client-Type: mobile_driver`
    - `Accept: application/json`
    - `Authorization: Bearer <plain_token>`
    - `Idempotency-Key: <idempotency_key>`
  - Chuẩn hóa phân tích Response Envelope (`success`, `data`, `error.code`, `error.details`) theo đúng `AI_SYNC_CONTRACT.md`.

### Tầng 6: `Screens` (Giao diện Phân tách Rạch ròi Theo 2 Vai trò)

#### 6.1. Nhóm màn hình dùng chung (`Shared Screens`)

- **Màn hình Đăng nhập & Đổi mật khẩu lần đầu**: Đăng nhập bằng Mã nhân viên/SĐT, lưu Token an toàn (Keychain/EncryptedSharedPreferences), bắt buộc đổi mật khẩu nếu `must_change_password === 1`.
- **Thanh trạng thái Ca làm việc & Đồng bộ (`Sync & Shift Header`)**: Hiển thị trạng thái Online/Offline, số lượng bản ghi đang chờ đồng bộ (`pending`) và số bản ghi lỗi xung đột (`conflict`) để tài xế kiểm tra trước khi kết thúc ca.

#### 6.2. Nhóm màn hình dành riêng cho `pickup_delivery_driver` (Tài xế Lấy/Giao hàng)

1. **Danh sách Lệnh Lấy hàng (`Pickup Tasks`)**:
   - Xem các `pickup_requests` được điều phối gán (`assigned`), bấm **Nhận lệnh** (`accepted`) hoặc từ chối kèm lý do.
   - Gọi điện nhanh cho người gửi (sử dụng số điện thoại đã được Server giải mã cho tài xế phụ trách đơn), mở chỉ đường GPS.
2. **Xác nhận Lấy hàng & Chụp Biên lai Trắng/Hồng (`Pickup Confirmation`)**:
   - Quét barcode từng kiện hàng, kiểm tra trọng lượng/số kiện thực tế, chụp ảnh **biên lai trắng/hồng** có chữ ký người gửi và xác nhận `picked_up` (hoặc báo `pickup_failed` kèm ảnh/lý do).
3. **Danh sách Đơn Xuất kho Đi giao (`Delivery Tasks`)**:
   - Hiển thị danh sách vận đơn `out_for_delivery` thuộc phiếu xuất kho giao hàng (`outbound_delivery`) của tài xế trong ngày, lọc theo tuyến đường/ưu tiên (`is_priority`).
4. **Xác nhận Giao hàng & Thu tiền COD (`Delivery & COD Collection`)**:
   - Giao thành công (`delivered`): Chụp ảnh chứng từ giao hàng (`POD` / biên lai hồng), xác nhận đã thu đúng tổng số tiền `cod_amount` + cước người nhận trả (`ngttn`). Hệ thống tự động ghi nhận vào ví công nợ cục bộ (`cod_transactions.status = 'driver_holding'`).
   - Giao thất bại (`delivery_failed`) hoặc Báo sự cố (`incident`): Chọn lý do chuẩn, chụp ảnh minh chứng hiện trường.
5. **Ví Tiền COD Đang Giữ (`My COD Wallet`)**:
   - Thống kê tổng tiền mặt COD và cước thu hộ đang giữ (`driver_holding`) theo từng ngày/từng đơn để tài xế đối chiếu trực tiếp khi nộp tiền cho Kế toán Bưu cục (`cash_collections`).

#### 6.3. Nhóm màn hình dành riêng cho `linehaul_driver` (Tài xế Trung chuyển)

1. **Danh sách Chuyến Trung chuyển (`Linehaul Trips`)**:
   - Hiển thị các phiếu xuất kho trung chuyển (`warehouse_receipts` loại `outbound_linehaul`) được gán cho tài xế và biển số xe (`vehicles`), hiển thị rõ Kho xuất phát -> Kho đích kế tiếp (`target_warehouse_id`).
2. **Quét Barcode Bàn giao Túi Seal & Vận đơn (`Linehaul Scan & Handover`)**:
   - Quét mã niêm phong túi hàng (`manifest_bags.seal_code`) và mã vận đơn lẻ (`tracking_code`) đối chiếu khớp 100% với danh sách `warehouse_receipt_items` trên phiếu trước khi rời kho và khi cập bến kho đích.
3. **Báo cáo Sự cố Dọc đường (`Linehaul Incident Report`)**:
   - Ghi nhận sự cố kẹt xe, hỏng phương tiện hoặc hư hỏng niêm phong túi hàng kèm tọa độ GPS và ảnh chụp hiện trường (`shipment_incidents`).
