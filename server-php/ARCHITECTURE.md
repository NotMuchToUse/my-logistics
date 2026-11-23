# ARCHITECTURE.md — Kiến trúc & Cấu trúc Thư mục (`vietstar-server-api`)

> Backend API trung tâm của hệ thống **Logistics Vietstar**, xây dựng bằng **PHP 8.x OOP Vanilla + Composer PSR-4 + PDO MySQL 8.0 (`InnoDB`, `utf8mb4_unicode_ci`)**. Kiến trúc nhẹ, tối ưu hiệu năng cao và tương thích hoàn toàn với cả Shared Hosting (DirectAdmin/cPanel) lẫn VPS/Docker.

---

## 1. Luồng Xử lý Request Chuẩn (Request Lifecycle)

Mọi HTTP Request đi vào hệ thống đều tuân theo một pipeline tuyến tính duy nhất:

```text
[Client: Web Internal / Web Customer / Mobile Driver]
       │
       ▼
public/index.php  ──► ErrorHandler (Bắt mọi Exception, ghi system_error_logs, trả JSON chuẩn)
       │
       ▼
CorsMiddleware    ──► Kiểm tra Origin & Header bắt buộc (X-Client-Type, Accept)
       │
       ▼
Router            ──► Khớp HTTP Method + URI Pattern (VD: /api/v1/shipments/{public_id})
       │
       ▼
AuthMiddleware    ──► Xác thực Bearer Token (SHA-256 hash trong personal_access_tokens)
       │
       ▼
PermissionMiddleware ► Kiểm tra mã quyền (permissions.code) qua 13 Roles RBAC
       │
       ▼
BranchScopeMiddleware ► Đọc user_branch_scopes & X-Branch-Id, khởi tạo ScopeContext
       │
       ▼
IdempotencyMiddleware ► Kiểm tra Idempotency-Key (chống trùng lặp request POST/PATCH)
       │
       ▼
Controller        ──► Parse Request -> Gọi Validator/DTO -> Gọi Service -> Trả Response::json()
       │
       ▼
Service           ──► Thực thi nghiệp vụ, State Machine, Transaction, Crypto, AuditLog
       │
       ▼
Repository        ──► Thực thi SQL thuần qua PDO Prepared Statements + ScopeGuard
       │
       ▼
[MySQL 8.0 Database: 55 Bảng InnoDB]
```

---

## 2. Cây Thư mục Chuẩn PSR-4 (`vietstar-server-api`)

```text
vietstar-server-api/
├── public/
│   ├── index.php                       # Entry point duy nhất (Front Controller)
│   └── .htaccess                       # Rewrite URL về index.php, giữ HTTP_AUTHORIZATION, chặn đọc file ẩn
├── config/
│   ├── app.php                         # Cấu hình chung (APP_ENV, APP_KEY, TIMEZONE +07:00)
│   ├── database.php                    # Cấu hình kết nối PDO MySQL 8.0
│   ├── cors.php                        # Whitelist domain của Web Internal & Web Customer
│   └── security.php                    # Cấu hình Token TTL, Rate limit đăng nhập, Encryption key
├── src/
│   ├── Core/
│   │   ├── Database.php                # Singleton PDO Wrapper + Transaction helper
│   │   ├── Router.php                  # Định tuyến RESTful hỗ trợ tham số động {public_id} & nhóm Middleware
│   │   ├── Request.php                 # Đọc JSON body, Query params, Headers, File upload
│   │   ├── Response.php                # Chuẩn hóa Success / Pagination / Error JSON Envelope
│   │   ├── Crypto.php                  # Mã hóa AES-256-GCM, băm HMAC-SHA256 (phone_hash), che SĐT
│   │   ├── UlidGenerator.php           # Sinh mã public_id ULID 26 ký tự chuẩn thời gian
│   │   ├── Validator.php               # Bộ kiểm tra dữ liệu đầu vào trả lỗi 422_VALIDATION_ERROR
│   │   ├── ScopeGuard.php              # Tự động tiêm điều kiện SQL lọc chi nhánh/kho chống IDOR
│   │   └── ErrorHandler.php            # Bắt lỗi toàn cục, ghi system_error_logs, ẩn chi tiết SQL
│   ├── Middleware/
│   │   ├── MiddlewareInterface.php     # Giao diện chuẩn cho mọi Middleware
│   │   ├── CorsMiddleware.php          # Xử lý Preflight OPTIONS & CORS headers
│   │   ├── AuthMiddleware.php          # Kiểm tra Bearer Token & trạng thái tài khoản
│   │   ├── PermissionMiddleware.php    # Kiểm tra quyền hạn RBAC (13 Roles)
│   │   ├── BranchScopeMiddleware.php   # Xác thực X-Branch-Id & nạp phạm vi dữ liệu user
│   │   └── IdempotencyMiddleware.php   # Chống trùng lặp giao dịch qua bảng idempotency_keys
│   └── Modules/
│       ├── Auth/                       # Đăng ký, Đăng nhập, Token, Đổi mật khẩu, Consent NĐ13
│       ├── MasterData/                 # Tỉnh/Huyện/Xã, Dịch vụ chính, DVGT, Phụ phí, Bảng giá, Loại hàng
│       ├── NetworkOrg/                 # Quản lý Trụ sở/Chi nhánh/Bưu cục/Kho, Nhân sự, Role, Branch Scope
│       ├── Customer/                   # Hồ sơ khách hàng, Sổ địa chỉ gửi/nhận, Tra cứu công khai
│       ├── Pickup/                     # Yêu cầu lấy hàng, Điều phối phân lệnh tài xế, Cảnh báo trễ SLA
│       ├── Shipment/                   # Tạo vận đơn (đơn lẻ & Excel), Kiện hàng, Hành trình, Chuyển hoàn, Duyệt hủy giao
│       ├── Warehouse/                  # Nhập kho, Đóng/Mở túi Seal, Xuất trung chuyển/giao, Mở khóa phiếu, Kiểm kê
│       ├── Finance/                    # Sổ cái COD, Thu tiền tài xế, Nộp tiền 2 cấp, Đối soát NGTTS
│       ├── IncidentCompensation/       # Báo cáo sự cố vận đơn, Đề xuất & Phê duyệt đền bù phân bổ chi phí
│       └── ReportsAdmin/               # Báo cáo tổng hợp/COD, GPS tài xế, Audit Log, Error Log, Print Log, Settings
├── database/
│   ├── migrations/
│   │   └── 001_init_vietstar_55_tables.sql   # Full DDL 55 bảng MySQL 8.0 InnoDB
│   └── seeds/
│       ├── 001_seed_rbac_and_master.sql      # 13 Roles, Permissions, Dev/Admin accounts, Địa giới, Bảng giá
│       └── 002_seed_demo_operations.sql      # Bưu cục, Kho, Tài xế, 50 Vận đơn mẫu, Túi Seal, Sổ cái COD
├── docs/
│   ├── AI_SYNC_CONTRACT.md             # Hợp đồng đồng bộ chung 4 Repo
│   ├── PROJECT_CONTEXT.md              # Ngữ cảnh hệ thống & Bản đồ 55 bảng
│   └── incidents/                      # Báo cáo rà soát bảo mật & sự cố kỹ thuật
├── storage/
│   ├── logs/                           # File log dự phòng khi lỗi kết nối DB
│   └── uploads/                        # Lưu trữ ảnh biên lai trắng/hồng, ủy nhiệm chi, ảnh sự cố
├── .env.example                        # Mẫu biến môi trường (DB, APP_KEY, CORS)
├── .gitignore                          # Bỏ qua vendor/, .env, storage/logs/*, storage/uploads/*
├── composer.json                       # Khai báo PSR-4 autoload ("App\\": "src/")
├── AI_RULES.md                         # Quy tắc lập trình & bảo mật cho AI
├── ARCHITECTURE.md                     # Tài liệu kiến trúc (file này)
└── PROGRESS_AND_LINEAR.md              # Bảng theo dõi tiến độ task KHA-xx
```

_(Lưu ý: Bên trong mỗi thư mục con của `src/Modules/<ModuleName>/` đều chia thống nhất 5 thư mục: `Controllers/`, `Services/`, `Repositories/`, `DTOs/`, `Validators/` và file `routes.php` khai báo các endpoint của riêng module đó.)_

---

## 3. Trách nhiệm Rạch ròi Từng Tầng (Separation of Concerns)

| Tầng (Layer)          | Trách nhiệm được phép                                                                                                                                                     | Điều cấm tuyệt đối                                                                                                    |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| **`Middleware`**      | Kiểm tra HTTP headers, xác thực token, kiểm tra quyền RBAC, nạp ngữ cảnh chi nhánh (`ScopeContext`), kiểm tra `Idempotency-Key`.                                          | Không chứa logic nghiệp vụ đặc thù của từng module; không tự thực hiện ghi dữ liệu nghiệp vụ.                         |
| **`Controller`**      | Nhận dữ liệu từ `Request`, gọi `Validator` / `DTO`, truyền dữ liệu sạch xuống `Service`, nhận kết quả và trả về qua `Response::json()`.                                   | **CẤM** viết câu lệnh SQL; **CẤM** trực tiếp khởi tạo `PDO`; **CẤM** viết logic tính cước hay kiểm tra State Machine. |
| **`Service`**         | Điều phối luồng nghiệp vụ, kiểm tra chuyển đổi trạng thái hợp lệ (State Machine), quản lý `beginTransaction()` / `commit()`, gọi `Crypto` mã hóa PII và ghi `audit_logs`. | **CẤM** đọc trực tiếp biến toàn cục `$_GET`, `$_POST`, `$_SERVER`, `$_FILES`; **CẤM** viết chuỗi SQL thô.             |
| **`Repository`**      | Đóng gói mọi câu lệnh SQL (`SELECT`, `INSERT`, `UPDATE`) bằng PDO Prepared Statements, gọi `ScopeGuard::applyBranchFilter()` và khóa dòng `FOR UPDATE`.                   | **CẤM** gọi `Response::json()` hoặc `exit()`; **CẤM** tự ý thay đổi trạng thái nghiệp vụ mà `Service` không yêu cầu.  |
| **`DTO / Validator`** | Định nghĩa cấu trúc dữ liệu đầu vào/đầu ra rõ kiểu (`strict_types=1`), kiểm tra định dạng trường và trả về mảng lỗi chuẩn `422_VALIDATION_ERROR`.                         | **CẤM** truy vấn DB phức tạp (chỉ nhận dữ liệu đã có hoặc kiểm tra định dạng cú pháp).                                |
