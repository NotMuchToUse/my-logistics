# PROGRESS_AND_LINEAR.md — Quản lý Tiến độ Server API & Tích hợp Linear (`my-logistics/server-php`)

> **Tài liệu theo dõi tiến độ thực thi thực tế của phân hệ `server-php/` trong Monorepo `my-logistics` (Linear Team `KHA`).**

---

## 1. Lệnh Bắt buộc Dành cho AI Agent Khi Làm Việc

1. **Khóa phạm vi thư mục (Monorepo)**:
   - AI chỉ được phép tạo/sửa code PHP bên trong `server-php/` (và cập nhật file này). Không tự ý sửa file trong `web-customer/`, `web-internal/`, `mobile-driver/`, và không tự ý đổi `docs/AI_SYNC_CONTRACT.md` hay `docs/API_CONTRACT.md` nếu chưa được `Khang` cho phép.
2. **Tự động cập nhật file tiến độ**:
   - Ngay sau khi AI hoàn thành một task hoặc hoàn thành xong một phần công việc (ví dụ: xong `DTO` + `Repository`, chưa xong `Service` + `Controller`), AI **BẮT BUỘC** cập nhật trực tiếp bảng ở **Mục 3** của file này trước khi kết thúc lượt trả lời:
     - Cập nhật cột **Trạng thái** (`Todo` -> `In Progress` -> `In Review` -> `Done`).
     - Cập nhật cột **% Đóng góp** phản ánh đúng mức độ hoàn thành thực tế.
     - Ghi chi tiết những file/class đã code xong và phần còn dang dở vào cột **Checkpoint bàn giao dở dang nếu quá giờ**.
3. **Quy tắc Bàn giao Tiếp sức (Relay Handover)**:
   - Mỗi task có **Timebox giới hạn (2–4 giờ)** gắn với ngày thực hiện cố định.
   - Nếu hết thời gian Timebox mà người nhận chính chưa hoàn thành 100%, người làm phải push code lên nhánh `wip/KHA-xx-...` và cập nhật Checkpoint. Thành viên khác (`Khang` / `Minh` / `Nhân` / `Kiên`) nhận làm nốt phần còn lại sẽ được chia phần **% Đóng góp** tương ứng.

---

## 2. Quy chuẩn Git Branch, Commit & Pull Request (Tự động hóa Linear)

Để GitHub tự động liên kết và chuyển trạng thái Issue trên **Linear Team KHA**, mọi thành viên và AI bắt buộc tuân thủ quy ước sau:

| Thành phần                     | Quy chuẩn bắt buộc                                             | Ví dụ thực tế                                                                                         |
| :----------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Tên nhánh (Feature Branch)** | `feat/KHA-<số>-<tên-ngắn-không-dấu>`                           | `feat/KHA-8-auth-token-nd13`                                                                          |
| **Tên nhánh sửa lỗi**          | `fix/KHA-<số>-<tên-ngắn-không-dấu>`                            | `fix/KHA-21-shipment-rate-rounding`                                                                   |
| **Tên nhánh bàn giao dở**      | `wip/KHA-<số>-<tên-ngắn-không-dấu>`                            | `wip/KHA-39-warehouse-seal-repo`                                                                      |
| **Commit Message**             | `feat(KHA-<số>): <mô tả ngắn gọn>` (hoặc `fix(KHA-<số>): ...`) | `feat(KHA-18): implement RBAC and BranchScopeMiddleware`                                              |
| **Pull Request Title**         | `[KHA-<số>] <Tên task ngắn gọn>`                               | `[KHA-18] Xây dựng Middleware RBAC & Branch Scope`                                                    |
| **Pull Request Description**   | Bắt buộc chứa từ khóa **`Closes KHA-<số>`** ở dòng đầu tiên    | `Closes KHA-18` _(Lưu ý: Cần merge vào nhánh mặc định hoặc bật rule cho nhánh `develop` trên Linear)_ |

---

## 3. Bảng Theo dõi Tiến độ 16 Task Server API (`KHA-02`, `KHA-5` – `KHA-55`)

_(Đã đối chiếu khớp 100% với mã Issue thực tế trên Linear Workspace `KhangDev` Team `KHA`. Tổng trọng số phần Server API = **156 điểm**.)_

| Mã KHA   | Tên Task (`server-php/`)                                                             | Người nhận | Timebox (giờ) | Ngày thực hiện | Trạng thái |  % Đóng góp  | Checkpoint bàn giao dở dang nếu quá giờ                                                                                                       |
| :------- | :----------------------------------------------------------------------------------- | :--------- | :-----------: | :------------: | :--------- | :----------: | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `KHA-02` | Khởi tạo khung PHP 8.x PSR-4, Core, Middleware & kiểm tra kết nối MySQL                | `Khang`    |       —       |   23/11/2026   | `Done`     | `100%`        | Composer PSR-4, Core, middleware, 10 module và `php -l` hoàn tất; `scripts/test_db.php` kết nối thành công, xác nhận MariaDB 10.6.24 với 55 bảng. |
| `KHA-5`  | Triển khai MySQL 8.0, 3 user phân quyền & Seed dữ liệu mẫu Vietstar                  | `Khang`    |      2h       |   23/11/2026   | `Todo`     | `0%` _(10đ)_ | Xuất file `.sql` đã dump kèm danh sách tài khoản test vào `docs/SEED_CREDENTIALS.md`.                                                         |
| `KHA-6`  | Dựng khung PHP 8.x OOP PSR-4, PDO Security, API_CONTRACT.md & Mẫu CRUD               | `Khang`    |      3h       |   23/11/2026   | `Todo`     | `0%` _(10đ)_ | Push khung `src/Core` + `.env.example` + `API_CONTRACT.md` + endpoint mẫu `cargo_categories` chạy thông trên Postman.                         |
| `KHA-8`  | Xây dựng Auth Đăng nhập/Đăng ký, Token Hash, Brute-force & Consent NĐ13              | `Khang`    |      3h       |   23/11/2026   | `In Review` | `100%` _(10đ)_ | Hoàn tất 5 endpoint Auth, DTO/validator/repository/service/controller, token hash, khóa brute-force, consent NĐ13 và Idempotency đăng ký; seed 13 roles/admin; lint và `scripts/test_auth.php` pass (register/replay, login, lockout, đổi mật khẩu, logout, token cũ bị 401). |
| `KHA-16` | CRUD Danh mục Dịch vụ chính, Dịch vụ gia tăng, Phụ phí & Địa giới hành chính         | `Kiên`     |      3h       |   23/11/2026   | `In Progress` | `85%` _(8đ)_ | Hoàn tất Bước 1–5 trong phạm vi MasterData: DTO/Validator, PDO Repository, Service, Controller, Routes và 6 endpoint GET địa giới với phân trang/lọc. Đã triển khai GET/POST/PUT/DELETE cho service_types, value_added_services, surcharges, pricing_tariffs, weight_conversion_rules; soft delete đặt is_active=0; ghi dữ liệu yêu cầu Auth và role system_admin/system_dev; POST gắn IdempotencyMiddleware. Test PASS: validation 5 DTO/3 nhóm invalid, geography 12 scenarios, repository create/find/update/soft-delete cho 5 tài nguyên, controller POST/PUT/DELETE/401/403/404 và PHP syntax toàn src/scripts. Còn BLOCKED: Composer không có trong PATH, thiếu server-php/vendor và .env nên chưa chạy Composer autoload/Auth/MySQL integration; chưa xác nhận API Contract endpoint vì tài liệu chưa có contract endpoint MasterData chính thức. |
| `KHA-18` | Xây dựng Middleware RBAC (13 Roles) & Khóa phạm vi Chi nhánh (Branch Scope)          | `Khang`    |      2h       |   24/11/2026   | `Done`     | `100%` _(10đ)_ | Hoàn tất Auth/Permission/BranchScope middleware, ScopeGuard và BaseRepository filters, permission matrix cho 13 roles, admin `hq_all`, đồng bộ quyền `shipment.*`. Seed chạy idempotent; PHP lint, xác thực token/AuthContext/last_used_at/đổi mật khẩu bắt buộc, ALL/ANY, bypass admin, post-office allow/deny, filter 5 scope types và `scripts/test_shipment.php` đều pass trên DB thực tế. File: `src/Middleware/{AuthMiddleware,PermissionMiddleware,BranchScopeMiddleware}.php`, `src/Core/{ScopeGuard,BaseRepository}.php`, `src/Modules/Shipment/routes.php`, `database/seeds/003_seed_rbac_permissions.sql`. |
| `KHA-19` | API Public (Tra cứu, Bưu cục GPS, Tính cước) & API Khách hàng (Sổ địa chỉ, Lấy hàng) | `Khang`    |      3h       |   24/11/2026   | `Todo`     | `0%` _(10đ)_ | Hoàn thành API tra cứu vận đơn, tính cước và tạo yêu cầu lấy hàng trả đúng JSON contract.                                                     |
| `KHA-20` | API Quản lý Nhân sự, Gán Role/Branch Scope, Chi nhánh/Kho & Điều phối Lấy hàng       | `Khang`    |      2h       |   24/11/2026   | `Todo`     | `0%` _(10đ)_ | Hoàn thành CRUD `branches`/`warehouses`, gán scope nhân viên và API phân lệnh tài xế lấy hàng.                                                |
| `KHA-21` | API Tạo & Quản lý Vận đơn chi tiết, Cấp dải mã & Snapshot giá cước (Transaction)     | `Khang`    |      3h       |   24/11/2026   | `In Review` | `100%` _(12đ)_ | Hoàn tất DTO/Validator, 3 Repository, PricingService, ShipmentService, Controller, 7 route và permission middleware; `public/index.php` đã nạp module. Đã nạp/idempotency-check `002_seed_shipment_master.sql` và `003_seed_shipment_permissions.sql` (6 quyền, 28 grants theo role đã chốt). `scripts/test_shipment.php` pass middleware, create/replay, cấp mã, trọng lượng, snapshot giá, COD/history, list/detail, priority conflict, print, cancel, forward; lint toàn module và script pass, fixture được dọn. |
| `KHA-31` | API Import Vận đơn hàng loạt từ Excel (Validate từng dòng & Transaction)             | `Khang`    |      3h       |   25/11/2026   | `Todo`     | `0%` _(10đ)_ | Hoàn thành API validate danh sách dòng Excel và trả về mảng lỗi chi tiết theo từng chỉ số dòng (`row_index`).                                 |
| `KHA-35` | API Sự cố vận đơn, Quy trình Chuyển hoàn & Phê duyệt Hủy giao thành công             | `Khang`    |      3h       |   26/11/2026   | `Todo`     | `0%` _(10đ)_ | Hoàn thành API xử lý sự cố `shipment_incidents` và API Quản lý chi nhánh phê duyệt `shipment_approval_requests`.                              |
| `KHA-39` | API Kho bãi: Nhập kho, Đóng/Mở túi Seal & Cảnh báo sai tuyến định tuyến              | `Khang`    |      3h       |   27/11/2026   | `Todo`     | `0%` _(10đ)_ | Hoàn thành API tạo/chốt phiếu nhập kho và API đóng/mở túi hàng Seal cập nhật đúng trạng thái vận đơn.                                         |
| `KHA-43` | API Chốt/Mở khóa phiếu xuất kho (Transaction khóa dòng) & Kiểm kê tồn kho            | `Khang`    |      3h       |   28/11/2026   | `Todo`     | `0%` _(12đ)_ | Hoàn thành Transaction Chốt phiếu xuất kho và Mở khóa phiếu xuất kho có ghi nhận `audit_logs`.                                                |
| `KHA-47` | API Dòng tiền COD 2 cấp (Thu tiền tài xế, Nộp về Trung tâm & Đối soát NGTTS)         | `Khang`    |      4h       |   29/11/2026   | `Todo`     | `0%` _(12đ)_ | Hoàn thành luồng API khóa `cash_collections` và Kế toán Trung tâm duyệt xác nhận `cash_remittances`.                                          |
| `KHA-51` | API Phê duyệt Đền bù, Báo cáo Tổng hợp/COD & Giám sát GPS/Audit/Error Logs           | `Khang`    |      3h       |   30/11/2026   | `Todo`     | `0%` _(10đ)_ | Hoàn thành API phê duyệt/chi trả đền bù và 2 API xuất số liệu báo cáo tổng hợp/công nợ COD.                                                   |
| `KHA-55` | Kiểm thử Bảo mật (IDOR đa chi nhánh, Race Condition, SQLi/XSS) & E2E 3 App           | `Khang`    |      3h       |   01/12/2026   | `Todo`     | `0%` _(12đ)_ | Ghi nhận kết quả test vào `docs/incidents/SECURITY_TEST_REPORT.md` và vá triệt để nếu phát hiện lỗ hổng phân quyền.                           |
