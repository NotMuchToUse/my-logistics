# AI_SYNC_CONTRACT.md — Hợp đồng Đồng bộ Kỹ thuật 4 Repository (Vietstar Logistics)

> **CẢNH BÁO BẮT BUỘC DÀNH CHO MỌI AI AGENT (Cursor, Windsurf, Cline, Claude Code, Copilot, Web Chat AI):**
> Tài liệu này là **Nguồn chân lý duy nhất (Single Source of Truth)** về giao tiếp API, cấu trúc JSON, Header, Mã lỗi và Trạng thái nghiệp vụ giữa 4 repository của hệ thống **Logistics Vietstar**:
>
> 1. `vietstar-server-api` (PHP 8.x OOP Vanilla + PSR-4 + PDO MySQL 8.0)
> 2. `vietstar-web-internal` (ReactJS Functional Components + Tailwind CSS + Shadcn UI)
> 3. `vietstar-web-customer` (ReactJS Functional Components + Tailwind CSS + Shadcn UI)
> 4. `vietstar-driver-mobile` (Mobile Driver App — Khung chờ triển khai giai đoạn 2)
>
> Mọi mã nguồn sinh ra ở bất kỳ repo nào **PHẢI TUÂN THỦ 100%** các quy ước dưới đây.

---

## 1. Quy tắc Bất biến Chống AI Tự Bịa (Zero-Hallucination Rules)

1. **Cấm tự ý đổi tên trường (Field Naming Lock)**:
   - Toàn bộ key trong JSON Request/Response **BẮT BUỘC dùng `snake_case`** khớp 100% với tên cột trong MySQL 8.0 (ví dụ: `tracking_code`, `origin_branch_id`, `cod_amount`, `total_freight_amount`).
   - **TUYỆT ĐỐI KHÔNG** tự ý chuyển đổi sang `camelCase` (`trackingCode`, `codAmount`) ở tầng API payload hoặc Mock JSON.
2. **Cấm tự bịa Endpoint hoặc Bảng/Cột DB**:
   - Không được tự tạo endpoint ngoài danh sách đã chốt trong contract.
   - Không được tự bịa tên bảng hoặc tên cột SQL không có trong 55 bảng của `PROJECT_CONTEXT.md`.
3. **Quy tắc Định danh Công khai (`public_id`) vs Khóa nội bộ (`id`)**:
   - Với các thực thể nghiệp vụ có cột `public_id` (`users`, `branches`, `warehouses`, `customers`, `customer_addresses`, `pickup_requests`, `shipments`, `shipment_approval_requests`, `shipment_incidents`, `manifest_bags`, `warehouse_receipts`, `compensations`, `cod_transactions`, `cash_collections`, `cash_remittances`, `customer_invoices`), tham số trên URL path (`GET /api/v1/shipments/{public_id}`) và định danh đối tượng phải ưu tiên dùng `public_id` (ULID 26 ký tự) để chống dò quét ID tuần tự (IDOR).
   - Các bảng danh mục tĩnh/địa giới (`provinces`, `districts`, `wards`, `service_types`, `cargo_categories`, `value_added_services`, `surcharges`, `vehicles`, `third_party_partners`) dùng `id` (`BIGINT UNSIGNED`) cho các trường khóa ngoại (`province_id`, `service_type_id`...).
4. **Quy tắc Khóa lạc quan (`version` — Optimistic Locking)**:
   - Mọi API cập nhật trạng thái hoặc chỉnh sửa trên các bảng có cột `version` (`pickup_requests`, `shipments`, `shipment_approval_requests`, `manifest_bags`, `warehouse_receipts`, `compensations`, `cod_transactions`, `cash_collections`, `cash_remittances`, `customer_invoices`) **BẮT BUỘC** nhận trường `version` hiện tại từ client trong Request Body và kiểm tra `WHERE id = :id AND version = :version`. Nếu không khớp phải trả về lỗi `409_VERSION_CONFLICT`.
5. **Quy tắc Bảo vệ Dữ liệu Cá nhân (Nghị định 13/2023/NĐ-CP)**:
   - Các cột lưu dưới dạng mã hóa nhị phân `VARBINARY(255)` (`phone_encrypted`, `sender_phone_encrypted`, `recipient_phone_encrypted`, `bank_account_no_encrypted`) **KHÔNG BAO GIỜ** được trả thẳng ra JSON.
   - API tra cứu công khai (`web_public`) chỉ trả về trường đã che (`phone_masked`, `sender_phone_masked`, `recipient_phone_masked`, ví dụ: `090***6789`). Chỉ API nội bộ có quyền hợp lệ mới được giải mã trả về trường `phone` / `sender_phone` / `recipient_phone` dạng plaintext.

---

## 2. Chuẩn HTTP Headers Bắt buộc

Mọi HTTP Request gửi tới `vietstar-server-api` phải tuân thủ bảng Header sau:

| Header Name       | Bắt buộc                                                         | Giá trị hợp lệ / Định dạng                                              | Mục đích & Quy tắc xử lý                                                                                                                  |
| :---------------- | :--------------------------------------------------------------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Type`    | Có (với `POST`/`PUT`/`PATCH`)                                    | `application/json` (hoặc `multipart/form-data` khi upload ảnh chứng từ) | Định dạng dữ liệu gửi lên Server.                                                                                                         |
| `Accept`          | Có                                                               | `application/json`                                                      | Bắt buộc Server luôn trả JSON (kể cả khi lỗi 4xx/5xx, không trả HTML).                                                                    |
| `X-Client-Type`   | **Có (Mọi request)**                                             | `web_public` \| `web_internal` \| `mobile_driver`                       | Phân loại nguồn ứng dụng gọi API để áp dụng chính sách CORS, thời hạn Token và che dữ liệu nhạy cảm.                                      |
| `Authorization`   | Có (trừ `/api/v1/public/*` và `/api/v1/auth/login`, `/register`) | `Bearer <plain_token>`                                                  | Token xác thực phiên làm việc; Server băm SHA-256 đối chiếu với `personal_access_tokens.token_hash`.                                      |
| `X-Branch-Id`     | Có (với `web_internal` khi thao tác nghiệp vụ chi nhánh/kho)     | Số nguyên `id` của chi nhánh/bưu cục đang chọn trên Topbar              | Xác định ngữ cảnh chi nhánh đang làm việc; Backend đối chiếu chặt chẽ với bảng `user_branch_scopes` (sai phạm vi trả `403_BRANCH_SCOPE`). |
| `Idempotency-Key` | **Có (Mọi thao tác tạo/chốt/thu tiền/đồng bộ offline)**          | Chuỗi `UUID v4` duy nhất do Client sinh cho mỗi lần bấm nút             | Chống tạo trùng đơn, chốt trùng phiếu kho hoặc thu trùng COD khi mạng chập chờn/retry; lưu kiểm soát trong bảng `idempotency_keys`.       |

---

## 3. Chuẩn Response Envelope Thống nhất

Mọi endpoint của `vietstar-server-api` (và mọi file giả lập trong `src/mocks/*.json` của Frontend) **BẮT BUỘC** bọc dữ liệu trong 1 trong 3 cấu trúc JSON dưới đây:

### 3.1. Success JSON (Trả về 1 đối tượng hoặc kết quả thao tác — HTTP `200` / `201`)

```json
{
  "success": true,
  "message": "Tạo vận đơn thành công",
  "data": {
    "public_id": "01JDC9X8K2M4N6P8Q0R2S4T6V8",
    "tracking_code": "VS26112300001",
    "status": "pending_pickup",
    "total_freight_amount": 35000.0,
    "cod_amount": 250000.0,
    "version": 1,
    "created_at": "2026-11-23 09:30:00"
  },
  "meta": {
    "timestamp": "2026-11-23T09:30:00+07:00"
  }
}
```

### 3.2. Pagination JSON (Trả về danh sách có phân trang — HTTP `200`)

```json
{
  "success": true,
  "message": "Lấy danh sách vận đơn thành công",
  "data": [
    {
      "public_id": "01JDC9X8K2M4N6P8Q0R2S4T6V8",
      "tracking_code": "VS26112300001",
      "status": "in_warehouse",
      "version": 3
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 145,
      "total_pages": 8
    },
    "timestamp": "2026-11-23T09:35:00+07:00"
  }
}
```

### 3.3. Error JSON (Mọi lỗi 4xx / 5xx — Không bao giờ trả stack trace SQL ra ngoài)

```json
{
  "success": false,
  "error": {
    "code": "422_VALIDATION_ERROR",
    "message": "Dữ liệu đầu vào không hợp lệ",
    "details": {
      "recipient_phone": [
        "Số điện thoại người nhận không đúng định dạng Việt Nam"
      ],
      "chargeable_weight_gram": ["Trọng lượng tính cước phải lớn hơn 0"]
    },
    "trace_id": "ERR-20261123-9A8B7C"
  }
}
```

### 3.4. Danh mục Mã lỗi Chuẩn (`error.code`)

| HTTP Status | Mã lỗi chuẩn (`error.code`) | Khi nào Backend trả về & Cách Frontend xử lý                                                                                                                         |
| :---------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`       | `400_BAD_REQUEST`           | JSON sai cú pháp, thiếu header `X-Client-Type` hoặc `Idempotency-Key` ở endpoint bắt buộc.                                                                           |
| `401`       | `401_UNAUTHORIZED`          | Thiếu Bearer Token, token không tồn tại, đã bị thu hồi (`revoked_at`) hoặc hết hạn (`expires_at`). Frontend tự xóa phiên đăng nhập và đẩy về trang Login.            |
| `403`       | `403_FORBIDDEN`             | Vai trò hiện tại không có `permission` thực hiện chức năng này (VD: Nhân viên kho gọi API duyệt đền bù).                                                             |
| `403`       | `403_BRANCH_SCOPE`          | Vi phạm phạm vi dữ liệu chi nhánh/kho (`user_branch_scopes`) — cố tình truy cập/sửa bản ghi của bưu cục/kho khác hoặc gửi `X-Branch-Id` không được cấp quyền.        |
| `404`       | `404_NOT_FOUND`             | Không tìm thấy tài nguyên theo `public_id` / `tracking_code` (hoặc bản ghi đã `deleted_at IS NOT NULL`).                                                             |
| `409`       | `409_VERSION_CONFLICT`      | Xung đột cập nhật đồng thời (`version` gửi lên khác `version` hiện tại trong DB). Frontend thông báo dữ liệu vừa được người khác cập nhật và tải lại bản mới nhất.   |
| `409`       | `409_IDEMPOTENCY_DUPLICATE` | Trùng `Idempotency-Key` đang trong trạng thái `processing` hoặc gửi lại cùng key nhưng khác `request_hash` (nội dung payload bị thay đổi).                           |
| `422`       | `422_VALIDATION_ERROR`      | Lỗi kiểm tra dữ liệu đầu vào hoặc vi phạm điều kiện chuyển trạng thái nghiệp vụ (State Machine). Frontend hiển thị lỗi chi tiết theo từng key trong `error.details`. |
| `429`       | `429_TOO_MANY_REQUESTS`     | Đăng nhập sai quá số lần cho phép (`login_attempts`) hoặc vượt giới hạn tần suất gọi API.                                                                            |
| `500`       | `500_INTERNAL_ERROR`        | Lỗi hệ thống nội bộ (đã ghi vào `system_error_logs` kèm `trace_id`, tuyệt đối ẩn chi tiết câu lệnh SQL).                                                             |

---

## 4. Bảng State Machine Chuẩn (`snake_case` khớp 100% SQL)

Mọi repo phải dùng **đúng từng ký tự chữ thường `snake_case`** dưới đây khi kiểm tra điều kiện hiển thị nút bấm trên UI hoặc kiểm tra chuyển trạng thái ở Backend.

### 4.1. Trạng thái Vận đơn (`shipments.status`)

| Giá trị ENUM trong DB | Ý nghĩa nghiệp vụ                                            | Trạng thái kế tiếp hợp lệ                                               | Vai trò được phép chuyển                             |
| :-------------------- | :----------------------------------------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------- |
| `draft`               | Vận đơn nháp chưa phát hành                                  | `pending_pickup`, `cancelled`                                           | Tiếp tân, Điều phối                                  |
| `pending_pickup`      | Chờ tài xế đến lấy hàng                                      | `picked_up`, `in_warehouse`, `cancelled`                                | Tài xế lấy/giao, Nhân viên kho, Tiếp tân, Điều phối  |
| `picked_up`           | Tài xế đã lấy hàng từ người gửi                              | `in_warehouse`, `incident`                                              | Nhân viên kho, Tài xế                                |
| `in_warehouse`        | Hàng đang lưu tại kho/bưu cục                                | `bagged`, `in_transit`, `out_for_delivery`, `returning`, `incident`     | Nhân viên kho                                        |
| `bagged`              | Đã đóng vào túi hàng niêm phong Seal                         | `in_transit`, `in_warehouse` (khi mở túi tại kho đích)                  | Nhân viên kho                                        |
| `in_transit`          | Đang vận chuyển trung chuyển giữa các kho                    | `in_warehouse`, `incident`                                              | Nhân viên kho đích, Tài xế trung chuyển              |
| `out_for_delivery`    | Đã xuất kho cho tài xế đi giao chặng cuối                    | `delivered`, `delivery_failed`, `incident`                              | Tài xế lấy/giao                                      |
| `delivered`           | Giao hàng thành công                                         | `in_warehouse` _(Chỉ khi Quản lý CN duyệt yêu cầu Hủy giao thành công)_ | Quản lý chi nhánh (qua `shipment_approval_requests`) |
| `delivery_failed`     | Giao hàng thất bại (khách hẹn lại / không nghe máy)          | `out_for_delivery`, `in_warehouse`, `pending_return`                    | Tài xế, Nhân viên kho, Điều phối                     |
| `pending_return`      | Chờ điều phối duyệt chuyển hoàn hoặc giao lại                | `out_for_delivery`, `returning`, `in_warehouse`                         | Điều phối viên, Quản lý chi nhánh                    |
| `returning`           | Đang luân chuyển hoàn trả về người gửi                       | `returned`, `in_warehouse`, `incident`                                  | Nhân viên kho, Tài xế                                |
| `returned`            | Đã hoàn trả thành công cho người gửi _(Trạng thái kết thúc)_ | _(Không chuyển tiếp)_                                                   | —                                                    |
| `incident`            | Đang xử lý sự cố (hư hỏng, mất mát, ướt bẩn)                 | `in_warehouse`, `returning`, `cancelled`                                | Điều phối viên, Quản lý chi nhánh                    |
| `cancelled`           | Đã hủy vận đơn _(Trạng thái kết thúc)_                       | _(Không chuyển tiếp)_                                                   | —                                                    |

### 4.2. Trạng thái Sổ cái Tiền COD & Cước thu hộ (`cod_transactions.status`)

| Giá trị ENUM trong DB | Ý nghĩa nghiệp vụ                                                        | Trạng thái kế tiếp hợp lệ                                                             | Vai trò được phép chuyển                                                     |
| :-------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------- |
| `pending`             | Chờ thu tiền (đơn đang giao hoặc chờ thu tại quầy)                       | `driver_holding`, `collected_by_branch`, `cancelled`                                  | Tài xế (khi giao thành công), Tiếp tân (khi thu `ngttn` tại quầy), Điều phối |
| `driver_holding`      | Tài xế đã thu tiền từ khách và đang giữ tiền mặt                         | `collected_by_branch`, `cancelled` _(nếu hủy giao thành công trước khi khóa bảng kê)_ | Kế toán bưu cục, Quản lý chi nhánh                                           |
| `collected_by_branch` | Kế toán Bưu cục đã khóa bảng kê thu tiền từ tài xế                       | `remitted_to_hq`                                                                      | Kế toán Trung tâm (khi duyệt bảng kê nộp tiền)                               |
| `remitted_to_hq`      | Kế toán Trung tâm đã xác nhận nhận tiền nộp từ bưu cục                   | `settled_to_customer`                                                                 | Kế toán Trung tâm (khi tất toán đối soát khách hàng)                         |
| `settled_to_customer` | Đã hoàn trả tiền COD cho khách hàng _(Trạng thái kết thúc)_              | _(Không chuyển tiếp)_                                                                 | —                                                                            |
| `cancelled`           | Giao dịch thu tiền bị hủy (do hủy đơn/hoàn hàng) _(Trạng thái kết thúc)_ | _(Không chuyển tiếp)_                                                                 | —                                                                            |

### 4.3. Trạng thái Yêu cầu Lấy hàng (`pickup_requests.status`)

| Giá trị ENUM trong DB | Ý nghĩa nghiệp vụ                                              | Trạng thái kế tiếp hợp lệ                                                   | Vai trò được phép chuyển                      |
| :-------------------- | :------------------------------------------------------------- | :-------------------------------------------------------------------------- | :-------------------------------------------- |
| `pending`             | Yêu cầu mới tạo (từ Web Khách hoặc Hotline), chờ điều phối     | `assigned`, `picked_up` _(nếu `counter_dropoff` mang ra quầy)_, `cancelled` | Điều phối viên, Tiếp tân, Khách hàng (tự hủy) |
| `assigned`            | Điều phối đã gán tài xế lấy hàng                               | `accepted`, `pending` _(nếu tài xế từ chối lệnh)_, `cancelled`              | Tài xế lấy/giao, Điều phối viên               |
| `accepted`            | Tài xế đã bấm nhận lệnh và đang trên đường đến lấy             | `picked_up`, `pickup_failed`, `cancelled`                                   | Tài xế lấy/giao, Điều phối viên               |
| `picked_up`           | Tài xế hoặc Tiếp tân quầy đã nhận hàng thành công _(Kết thúc)_ | _(Không chuyển tiếp)_                                                       | —                                             |
| `pickup_failed`       | Lấy hàng thất bại (khách vắng nhà / sai địa chỉ)               | `assigned`, `cancelled`                                                     | Điều phối viên                                |
| `cancelled`           | Yêu cầu lấy hàng đã bị hủy _(Trạng thái kết thúc)_             | _(Không chuyển tiếp)_                                                       | —                                             |

### 4.4. Trạng thái Bảng kê Thu tiền Tài xế (`cash_collections.status`)

| Giá trị ENUM trong DB | Ý nghĩa nghiệp vụ                                                                     | Trạng thái kế tiếp hợp lệ                                   | Vai trò được phép chuyển |
| :-------------------- | :------------------------------------------------------------------------------------ | :---------------------------------------------------------- | :----------------------- |
| `draft`               | Bảng kê đang quét mã vận đơn, chưa chốt                                               | `locked`, `cancelled`                                       | Kế toán bưu cục          |
| `locked`              | Đã khóa bảng kê, chính thức xóa công nợ giữ tiền của tài xế _(Không thể mở khóa lại)_ | _(Không chuyển tiếp — chỉ được đưa vào `cash_remittances`)_ | Kế toán bưu cục          |
| `cancelled`           | Bảng kê nháp đã bị hủy để lập lại _(Trạng thái kết thúc)_                             | _(Không chuyển tiếp)_                                       | —                        |

### 4.5. Trạng thái Bảng kê Nộp tiền về Trung tâm (`cash_remittances.status`)

| Giá trị ENUM trong DB | Ý nghĩa nghiệp vụ                                                  | Trạng thái kế tiếp hợp lệ                            | Vai trò được phép chuyển |
| :-------------------- | :----------------------------------------------------------------- | :--------------------------------------------------- | :----------------------- |
| `draft`               | Phiếu nộp tiền đang lập tại bưu cục, chưa gửi                      | `submitted`                                          | Kế toán bưu cục          |
| `submitted`           | Bưu cục đã gửi bảng kê kèm ảnh biên lai/ủy nhiệm chi chờ duyệt     | `verified`, `rejected`                               | Kế toán Trung tâm        |
| `verified`            | Kế toán Trung tâm xác nhận đã nhận đủ tiền _(Trạng thái kết thúc)_ | _(Không chuyển tiếp)_                                | —                        |
| `rejected`            | Kế toán Trung tâm từ chối do sai lệch số tiền/chứng từ             | `submitted` _(sau khi Kế toán BC chỉnh sửa bổ sung)_ | Kế toán bưu cục          |

---

## 5. Quy trình Bắt buộc Khi Cần Thay đổi API Contract hoặc Schema DB

Khi bất kỳ thành viên nào (`Khang`, `Minh`, `Nhân`, `Kiên`) phát hiện thiếu trường dữ liệu, cần thêm filter hoặc đổi cấu trúc endpoint trong lúc code:

1. **Bước 1 — Dừng tự sửa cục bộ**: Không tự ý đổi tên field trong code React hoặc PHP mà chưa cập nhật hợp đồng.
2. **Bước 2 — Đề xuất trên Linear**: Bình luận trực tiếp vào Issue liên quan trên **Linear Team KHA** ghi rõ: `Endpoint bị ảnh hưởng` + `Field cũ/mới` + `Lý do nghiệp vụ`.
3. **Bước 3 — Leader (`Khang`) chốt Schema & Contract**:
   - Nếu đụng Database: `Khang` chạy `ALTER TABLE` trên MySQL 8.0 và cập nhật bảng trong `PROJECT_CONTEXT.md`.
   - Cập nhật `AI_SYNC_CONTRACT.md` (và `API_CONTRACT.md`).
4. **Bước 4 — Cập nhật Mock Data**: Cập nhật file JSON tương ứng trong `src/mocks/` của `vietstar-web-internal` và `vietstar-web-customer` để các thành viên khác không bị gãy build khi chạy `VITE_USE_MOCK=true`.
5. **Bước 5 — Đồng bộ 4 Repo**: Push file `AI_SYNC_CONTRACT.md` mới nhất lên nhánh `develop` của cả 4 repo và thông báo trên nhóm chat trước khi AI Agent tiếp tục sinh code.
