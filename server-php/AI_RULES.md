# AI_RULES.md — Quy tắc Kỹ thuật & Bảo mật Bắt buộc (`vietstar-server-api`)

> **Tài liệu bắt buộc dành cho mọi AI Coding Assistant (Cursor, Windsurf, Cline, Claude Code, Copilot, Web Chat AI) làm việc trên repository `vietstar-server-api`.**
> Luôn đọc kèm 2 file gốc ở thư mục root: `AI_SYNC_CONTRACT.md` và `PROJECT_CONTEXT.md`.

---

## 1. Chuẩn Mã nguồn PSR-12 & Quy tắc Đặt tên

1. **Khai báo kiểu nghiêm ngặt**: Mọi file `.php` bắt buộc mở đầu bằng:
   ```php
   <?php

   declare(strict_types=1);
   ```
2. **Chuẩn Autoload PSR-4 (`"App\\": "src/"`)**:
   - Core hệ thống: `App\Core\...` (ví dụ: `App\Core\Database`, `App\Core\Router`, `App\Core\Crypto`)
   - Middleware: `App\Middleware\...` (ví dụ: `App\Middleware\AuthMiddleware`, `App\Middleware\BranchScopeMiddleware`)
   - Nghiệp vụ theo Module: `App\Modules\<ModuleName>\<Layer>\...`
     - Các `<Layer>` hợp lệ: `Controllers`, `Services`, `Repositories`, `DTOs`, `Validators`.
3. **Quy ước đặt tên (Naming Conventions)**:
   - **Tên File & Class**: `PascalCase`, trùng khớp 100% tên class (`ShipmentController.php`, `CreateShipmentDto.php`).
   - **Biến & Method trong PHP**: `camelCase` (`$originBranchId`, `findByPublicId()`).
   - **Hằng số (Constants)**: `UPPER_SNAKE_CASE` (`MAX_LOGIN_ATTEMPTS = 5`).
   - **JSON Request/Response & Cột SQL**: `snake_case` (`tracking_code`, `origin_branch_id`, `cod_amount`) — **CẤM** tự ý đổi sang `camelCase`.
4. **Quy chuẩn Comment tối giản**:
   - Chỉ viết comment phân tách khối cấu trúc lớn hoặc DocBlock mô tả `@param` / `@return` cho các hàm nghiệp vụ phức tạp.
   - **CẤM** comment giải thích từng dòng code hiển nhiên.

---

## 2. Luật Bảo mật & Toàn vẹn Dữ liệu Bắt buộc

### 2.1. PDO Prepared Statements 100% (Chống SQL Injection)
- Kết nối PDO bắt buộc bật:
  ```php
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES => false,
  ```
- **CẤM** nối chuỗi trực tiếp biến đầu vào vào câu SQL dưới mọi hình thức.
- Với mệnh đề `ORDER BY` hoặc `LIMIT`: bắt buộc đối chiếu qua mảng `whitelist` cột hợp lệ. Với mệnh đề `IN (...)`: phải sinh động danh sách placeholder `?, ?, ?` và bind từng phần tử.

### 2.2. RBAC & Khóa phạm vi Chi nhánh (`BranchScopeMiddleware` / `ScopeGuard`)
- Mọi endpoint nội bộ bắt buộc đi qua chuỗi: `AuthMiddleware` -> `PermissionMiddleware` -> `BranchScopeMiddleware`.
- Mọi câu truy vấn đọc/cập nhật dữ liệu vận hành (`shipments`, `pickup_requests`, `warehouse_receipts`, `manifest_bags`, `cod_transactions`, `cash_collections`, `compensations`, `shipment_incidents`) **BẮT BUỘC** gọi `ScopeGuard::applyBranchFilter()` dựa trên bảng `user_branch_scopes` (`hq_all`, `region_center`, `branch`, `post_office`, `warehouse`).
- Nếu request cố tình truy xuất bản ghi ngoài phạm vi chi nhánh/kho được gán -> ném ngoại lệ trả về `403_BRANCH_SCOPE`.

### 2.3. Định danh Công khai (`public_id`) vs Khóa nội bộ (`id`)
- Mọi URL API và JSON trả về cho các thực thể có cột `public_id` (`shipments`, `pickup_requests`, `warehouse_receipts`, `manifest_bags`, `cash_collections`, `cash_remittances`, `compensations`, `customers`, `users`...) **BẮT BUỘC** dùng `public_id` (ULID 26 ký tự) hoặc mã nghiệp vụ (`tracking_code`, `receipt_code`). Không lộ `id` tự tăng ra ngoài API.

### 2.4. Transaction, Khóa dòng & Optimistic Locking (`version`)
- Các nghiệp vụ tranh chấp dữ liệu đồng thời bắt buộc bọc trong `$pdo->beginTransaction()` ... `$pdo->commit()` (kèm `rollBack()` trong `catch`), sử dụng `SELECT ... FOR UPDATE` trên bản ghi đích:
  1. Cấp phát dải mã vận đơn (`tracking_number_ranges`).
  2. Chốt hoặc mở khóa phiếu xuất kho (`warehouse_receipts`).
  3. Khóa bảng kê thu tiền tài xế (`cash_collections`) và duyệt nộp tiền (`cash_remittances`).
  4. Phê duyệt đền bù (`compensations`) và hủy giao thành công (`shipment_approval_requests`).
- Mọi thao tác cập nhật trên bảng có cột `version` bắt buộc kiểm tra điều kiện `WHERE id = :id AND version = :version`. Nếu `rowCount() === 0` -> ném lỗi `409_VERSION_CONFLICT`.

### 2.5. Mã hóa Dữ liệu Cá nhân (Tuân thủ Nghị định 13/2023/NĐ-CP)
- Không lưu số điện thoại hoặc số tài khoản ngân hàng dạng văn bản thuần vào cột nhạy cảm. Bắt buộc xử lý qua `App\Core\Crypto`:
  - `phone_encrypted` / `bank_account_no_encrypted`: Mã hóa **AES-256-GCM** (`VARBINARY(255)`).
  - `phone_hash`: Băm **HMAC-SHA256** với `APP_KEY` (`CHAR(64)`) để phục vụ tìm kiếm chính xác `WHERE phone_hash = :phone_hash`.
  - `phone_masked`: Chuỗi che ký tự hiển thị công khai (VD: `090***6789`).

### 2.6. Idempotency & Nhật ký Kiểm toán (`audit_logs`)
- Các API tạo mới, thu tiền, chốt phiếu hoặc đồng bộ offline Mobile bắt buộc qua `IdempotencyMiddleware` kiểm tra bảng `idempotency_keys`.
- Các hành động nhạy cảm (`UNLOCK_RECEIPT`, `CANCEL_DELIVERED`, `LOCK_COLLECTION`, `VERIFY_REMITTANCE`, `APPROVE_COMPENSATION`, `ASSIGN_ROLE`) bắt buộc ghi bản ghi vào `audit_logs` (chỉ `INSERT`, đã loại bỏ mật khẩu/token/PII nhạy cảm).

---

## 3. Luật Giao tiếp & Sinh Code Bắt buộc dành cho AI

1. **Cấm tự bịa (Zero Hallucination)**:
   - **CẤM** tự bịa tên bảng, tên cột SQL hoặc giá trị `ENUM` không có trong 55 bảng của `PROJECT_CONTEXT.md` và `AI_SYNC_CONTRACT.md`.
   - **CẤM** tự thêm thư viện ngoài không có trong `composer.json`.
2. **Hỏi lại ngay khi thiếu thông tin**:
   - Nếu mô tả task thiếu quy tắc nghiệp vụ, thiếu tham số đầu vào hoặc chưa rõ trường hợp biên, AI **phải dừng lại và đặt câu hỏi ngắn gọn** cho lập trình viên trước khi viết code.
3. **Bắt buộc chia nhỏ từng lớp khi code Module lớn (Không viết tắt / Không cắt ngang)**:
   - Khi triển khai một module hoặc tính năng lớn, AI **KHÔNG ĐƯỢC** sinh dồn tất cả file cùng lúc dẫn đến cắt ngang code hoặc viết placeholder kiểu `// ... các hàm khác viết tương tự`.
   - AI bắt buộc chia nhỏ và xuất **100% code hoàn chỉnh** lần lượt theo đúng 5 bước sau, **dừng lại sau mỗi bước** để người dùng xác nhận rồi mới chuyển sang bước kế tiếp:
     - **Bước 1**: `DTO & Validator` (Kiểm tra dữ liệu đầu vào + ép kiểu chuẩn).
     - **Bước 2**: `Repository` (Truy vấn PDO Prepared Statements + `ScopeGuard` + `FOR UPDATE`).
     - **Bước 3**: `Service` (Logic nghiệp vụ, Transaction, State Machine, Crypto, Audit Log).
     - **Bước 4**: `Controller` (Nhận `Request`, gọi `Service`, trả `Response::json()`).
     - **Bước 5**: `Routes` (Đăng ký endpoint vào Router kèm `Middleware` tương ứng).