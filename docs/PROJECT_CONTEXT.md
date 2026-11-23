# PROJECT_CONTEXT.md — Kiến trúc Hệ thống & Bản đồ 55 Bảng Database (Vietstar Logistics)

> **Tài liệu ngữ cảnh kỹ thuật cốt lõi dành cho đội ngũ phát triển (`Khang`, `Minh`, `Nhân`, `Kiên`) và các AI Coding Assistant.**
> Hệ thống tập trung 100% vào nghiệp vụ **Vận chuyển & Logistics Nội địa Vietstar** (KHÔNG bao gồm sàn thương mại điện tử bán hàng).

---

## 1. Kiến trúc 4 Repository & Phân công Đội ngũ

Hệ thống được tách thành **4 GitHub Repository độc lập**, giao tiếp hoàn toàn qua RESTful JSON API:

| STT | Tên Repository           | Công nghệ & Kiến trúc                                                                                     | Phụ trách chính                           | Vai trò trong hệ thống                                                                                                                          |
| :-- | :----------------------- | :-------------------------------------------------------------------------------------------------------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `vietstar-server-api`    | **PHP 8.x OOP Vanilla** + Composer **PSR-4** + **PDO MySQL 8.0** (`InnoDB`, `utf8mb4_unicode_ci`)         | **Khang** (Leader) + Kiên (CRUD danh mục) | Backend API lõi, xác thực Token, RBAC 13 Roles, Branch Scope chống IDOR, Transaction khóa dòng, mã hóa dữ liệu nhạy cảm NĐ 13/2023.             |
| 2   | `vietstar-web-internal`  | **ReactJS** (Functional Components) + **Tailwind CSS** + **Shadcn UI** + **Lucide Icons** (Feature-based) | **Khang, Minh, Nhân, Kiên**               | Cổng vận hành nội bộ cho 11 vai trò nhân sự (Tiếp tân, Điều phối, Kho bãi, Kế toán Bưu cục/Trung tâm, Quản lý CN, Ban GĐ, Admin, Dev).          |
| 3   | `vietstar-web-customer`  | **ReactJS** (Functional Components) + **Tailwind CSS** + **Shadcn UI** + **Lucide Icons** (Feature-based) | **Minh, Nhân, Kiên**                      | Cổng dịch vụ khách hàng: Tra cứu vận đơn công khai, Tìm bưu cục trên bản đồ, Ước tính cước, Sổ địa chỉ, Tạo/Hủy yêu cầu lấy hàng & Lịch sử đơn. |
| 4   | `vietstar-driver-mobile` | _Chưa chốt tech (Khung chờ triển khai sau khi hoàn tất 3 app Web/API)_                                    | **Khang**                                 | Ứng dụng di động dành riêng cho Tài xế Lấy/Giao (First-mile / Last-mile) và Tài xế Trung chuyển (Line-haul) có hàng đợi Offline Sync.           |

---

## 2. Hệ thống Phân quyền RBAC (13 Roles) & Khóa phạm vi Chi nhánh (`user_branch_scopes`)

### 2.1. Danh sách 13 Vai trò Chuẩn (`roles.code`)

| Nhóm ứng dụng     | STT | Mã vai trò (`roles.code`) | Tên vai trò tiếng Việt                  | Phạm vi dữ liệu mặc định (`scope_type`)                          |
| :---------------- | :-- | :------------------------ | :-------------------------------------- | :--------------------------------------------------------------- |
| **Web Nội bộ**    | 1   | `receptionist`            | Nhân viên tiếp tân tại quầy             | `post_office` / `branch`                                         |
| **Web Nội bộ**    | 2   | `coordinator`             | Nhân viên điều phối                     | `branch` / `post_office`                                         |
| **Web Nội bộ**    | 3   | `warehouse_staff`         | Nhân viên kho                           | `warehouse`                                                      |
| **Web Nội bộ**    | 4   | `branch_accountant`       | Kế toán bưu cục                         | `post_office` / `branch`                                         |
| **Web Nội bộ**    | 5   | `hq_accountant`           | Kế toán trung tâm                       | `hq_all` / `region_center`                                       |
| **Web Nội bộ**    | 6   | `branch_manager`          | Quản lý chi nhánh                       | `branch` (bao gồm các `post_office` & `warehouse` con)           |
| **Web Nội bộ**    | 7   | `board_director`          | Ban giám đốc                            | `hq_all`                                                         |
| **Web Nội bộ**    | 8   | `system_admin`            | Quản trị viên hệ thống (Admin)          | `hq_all`                                                         |
| **Web Nội bộ**    | 9   | `system_dev`              | Dev hệ thống                            | `hq_all` (xem `system_error_logs`, `system_settings`)            |
| **Mobile Driver** | 10  | `pickup_delivery_driver`  | Tài xế lấy/giao hàng                    | `branch` / `post_office` (chỉ đơn được gán `assigned_driver_id`) |
| **Mobile Driver** | 11  | `linehaul_driver`         | Tài xế trung chuyển                     | `branch` / `warehouse` (chỉ phiếu `outbound_linehaul` được gán)  |
| **Web Khách**     | 12  | `customer_individual`     | Khách hàng cá nhân                      | Dữ liệu thuộc `customers.user_id = current_user_id`              |
| **Web Khách**     | 13  | `customer_corporate`      | Khách hàng doanh nghiệp trả sau (NGTTS) | Dữ liệu thuộc `customers.user_id = current_user_id`              |

### 2.2. Cơ chế Khóa phạm vi Chi nhánh Chống IDOR (`user_branch_scopes`)

- Một nhân viên có thể được phân công làm việc tại nhiều bưu cục/kho thông qua bảng `user_branch_scopes` với 5 cấp độ `scope_type`:
  1. `hq_all`: Truy cập toàn quốc (Ban Giám đốc, Admin, Kế toán Trung tâm).
  2. `region_center`: Truy cập Trung tâm vùng (`regional_hub`) và toàn bộ chi nhánh/bưu cục trực thuộc.
  3. `branch`: Truy cập 1 Chi nhánh cấp tỉnh/thành và các bưu cục/kho trực thuộc chi nhánh đó.
  4. `post_office`: Chỉ truy cập dữ liệu của đúng 1 Bưu cục phát/nhận.
  5. `warehouse`: Chỉ truy cập dữ liệu tồn kho và phiếu nhập/xuất của đúng 1 Kho bãi (`warehouse_id`).
- **Nguyên tắc Backend**: Mọi câu truy vấn danh sách hoặc xem/sửa chi tiết trên `shipments`, `pickup_requests`, `warehouse_receipts`, `manifest_bags`, `cod_transactions`, `cash_collections`, `compensations` đều phải đi qua `BranchScopeMiddleware` + `ScopeGuard` để tiêm điều kiện lọc theo chi nhánh/kho hợp lệ của user.

### 2.3. Tuân thủ Bảo mật & Nghị định 13/2023/NĐ-CP

- **PDO Security**: Bắt buộc `PDO::ATTR_EMULATE_PREPARES => false`, `PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION`, 100% truy vấn dùng Prepared Statements (`:param`).
- **Mã hóa PII**: Số điện thoại và số tài khoản ngân hàng khách hàng được mã hóa bằng **AES-256-GCM** lưu vào cột `*_encrypted` (`VARBINARY(255)`), lưu mã băm tìm kiếm chính xác **HMAC-SHA256** vào cột `*_hash` (`CHAR(64)`), và lưu chuỗi che ký tự vào cột `*_masked` (`VARCHAR(20)`).
- **Đồng thuận dữ liệu cá nhân**: Mọi khách hàng đăng ký đều phải ghi nhận lịch sử đồng ý vào bảng `user_consents`.
- **Nhật ký bất biến**: Bảng `audit_logs` thiết kế chỉ cho phép `INSERT` (Append-only), cấm `UPDATE` và `DELETE`.

---

## 3. Cơ chế Phát triển Song song & Chống Block Giữa Các Thành Viên

1. **Công tắc Mock Data (`VITE_USE_MOCK`)**:
   - Trên `vietstar-web-internal` và `vietstar-web-customer`, tầng `src/core/api/axiosClient.ts` đọc biến môi trường `VITE_USE_MOCK`.
   - Khi `VITE_USE_MOCK=true`, giao diện đọc dữ liệu giả lập từ `src/mocks/*.json` (chuẩn 100% cấu trúc trong `AI_SYNC_CONTRACT.md`). Khi `Khang` hoàn thành API thật trên Server, chỉ cần đổi `VITE_USE_MOCK=false` mà không phải sửa code UI.
2. **Cô lập Thư mục Feature (`src/features/<feature_name>/`)**:
   - Mỗi task giao cho `Minh`, `Nhân`, `Kiên` đều gói gọn trong một thư mục feature độc lập. Tuyệt đối không sửa chéo file trong feature của người khác để tránh xung đột Git Merge.
3. **Database Seeder Sẵn Dữ liệu Mẫu**:
   - Database MySQL 8.0 được nạp sẵn dữ liệu mẫu (13 roles, tài khoản test cho từng vai trò, địa giới hành chính, mạng lưới bưu cục/kho, bảng giá, 50 vận đơn ở đủ các trạng thái, túi hàng Seal và công nợ COD) giúp kiểm thử ngay lập tức mà không cần chờ tạo dữ liệu thủ công.
4. **Quy tắc Timebox & Bàn giao Tiếp sức**:
   - Mỗi task giới hạn trong **2–4 giờ** và gắn với một ngày thực hiện cố định trên Linear Team **KHA**. Nếu hết thời gian mà chưa hoàn tất, người làm push code lên nhánh `wip/<task-code>` kèm ghi chú Checkpoint để người khác tiếp nhận.

---

## 4. Sơ đồ Kiến trúc, Use Case & DB Diagram (Khung Đính Kèm)

> _Ghi chú: Dán đường dẫn thực tế và ảnh chụp sơ đồ của nhóm vào khung dưới đây để đồng bộ tài liệu._

- **Sơ đồ Use Case Tổng thể (13 Roles, 7 Phân hệ)**:
  - Link thiết kế (Draw.io / Figma / Google Drive): `[DÁN_LINK_USE_CASE_DIAGRAM_TẠI_ĐÂY]`
  - Ảnh sơ đồ: `![Use Case Diagram](./docs/images/use-case-diagram.png)`
- **Sơ đồ Thiết kế Cơ sở Dữ liệu (DBML / ERD 55 Bảng)**:
  - Link `dbdiagram.io`: `[DÁN_LINK_DBDIAGRAM_55_BANG_TẠI_ĐÂY]`
  - Ảnh ERD tổng thể: `![Database ERD](./docs/images/db-erd-diagram.png)`
- **Tài nguyên Quản trị Dự án**:
  - Linear Workspace (Team KHA): `[DÁN_LINK_LINEAR_TEAM_KHA_TẠI_ĐÂY]`
  - Hosting / phpMyAdmin Database: `bcalhqzjhosting_siucapvippro`

---

## 5. Bản đồ Tổng hợp Toàn bộ 55 Bảng Database (MySQL 8.0)

> **Hướng dẫn tra cứu cho AI Agent**: Trước khi viết bất kỳ câu lệnh SQL, Model PHP hay TypeScript Interface nào, hãy đối chiếu đúng **Tên bảng**, **Khóa chính**, **Khóa ngoại** và các cờ cột đặc biệt (`public_id`, `version`, `phone_hash`) dưới đây.

### Nhóm 1: Định danh, Phân quyền RBAC (13 Roles), Branch Scope & Mạng lưới Kho (15 Bảng)

| STT | Tên bảng SQL             | Khóa chính (PK)            | `public_id` | `version` |              PII Hash / Encrypted               | Khóa ngoại chính (FK)                                                                 | Chức năng nghiệp vụ                                                                                              |
| :-- | :----------------------- | :------------------------- | :---------: | :-------: | :---------------------------------------------: | :------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| 1   | `users`                  | `id`                       |     Có      |   Không   | `phone_encrypted`, `phone_hash`, `phone_masked` | `created_by`, `updated_by -> users(id)`                                               | Tài khoản người dùng toàn hệ thống (nhân viên, khách hàng, dev)                                                  |
| 2   | `roles`                  | `id`                       |    Không    |   Không   |                      Không                      | —                                                                                     | Danh mục 13 vai trò chuẩn của hệ thống                                                                           |
| 3   | `permissions`            | `id`                       |    Không    |   Không   |                      Không                      | —                                                                                     | Danh mục quyền hạn chi tiết theo phân hệ                                                                         |
| 4   | `role_has_permissions`   | `(role_id, permission_id)` |    Không    |   Không   |                      Không                      | `role_id -> roles(id)`, `permission_id -> permissions(id)`                            | Bảng trung gian gán quyền cho từng vai trò                                                                       |
| 5   | `user_has_roles`         | `(user_id, role_id)`       |    Không    |   Không   |                      Không                      | `user_id -> users(id)`, `role_id -> roles(id)`                                        | Bảng trung gian gán một hoặc nhiều vai trò cho người dùng                                                        |
| 6   | `provinces`              | `id`                       |    Không    |   Không   |                      Không                      | —                                                                                     | Danh mục Tỉnh / Thành phố trực thuộc Trung ương                                                                  |
| 7   | `districts`              | `id`                       |    Không    |   Không   |                      Không                      | `province_id -> provinces(id)`                                                        | Danh mục Quận / Huyện (kèm cờ `is_remote_area` vùng sâu vùng xa)                                                 |
| 8   | `wards`                  | `id`                       |    Không    |   Không   |                      Không                      | `district_id -> districts(id)`                                                        | Danh mục Phường / Xã                                                                                             |
| 9   | `branches`               | `id`                       |     Có      |   Không   |                      Không                      | `parent_branch_id -> branches(id)`, `province_id`, `district_id`, `ward_id`           | Cây phân cấp Trụ sở (`hq`) -> Trung tâm vùng (`regional_hub`) -> Chi nhánh (`branch`) -> Bưu cục (`post_office`) |
| 10  | `warehouses`             | `id`                       |     Có      |   Không   |                      Không                      | `branch_id -> branches(id)`                                                           | Danh mục Kho khai thác tổng, kho chi nhánh và kho lưu trữ bưu cục                                                |
| 11  | `user_branch_scopes`     | `id`                       |    Không    |   Không   |                      Không                      | `user_id -> users(id)`, `branch_id -> branches(id)`, `warehouse_id -> warehouses(id)` | Phân quyền phạm vi truy cập dữ liệu đa chi nhánh/kho chống IDOR                                                  |
| 12  | `personal_access_tokens` | `id`                       |    Không    |   Không   |                  `token_hash`                   | `user_id -> users(id)`                                                                | Quản lý phiên đăng nhập Bearer Token đã băm SHA-256                                                              |
| 13  | `password_reset_tokens`  | `id`                       |    Không    |   Không   |                  `token_hash`                   | `user_id -> users(id)`                                                                | Lưu mã xác thực đặt lại mật khẩu dùng một lần                                                                    |
| 14  | `login_attempts`         | `id`                       |    Không    |   Không   |                      Không                      | —                                                                                     | Nhật ký thử đăng nhập chống tấn công dò mật khẩu (Brute-force)                                                   |
| 15  | `user_consents`          | `id`                       |    Không    |   Không   |                      Không                      | `user_id -> users(id)`                                                                | Lưu bằng chứng đồng ý xử lý dữ liệu cá nhân theo NĐ 13/2023/NĐ-CP                                                |

### Nhóm 2: Dịch vụ, Bảng giá, Khách hàng, Lấy hàng, Vận đơn, Hành trình, Sự cố & GPS (19 Bảng)

| STT | Tên bảng SQL                 | Khóa chính (PK) | `public_id` | `version` | PII Hash / Encrypted                                                         | Khóa ngoại chính (FK)                                                                                                                                                                                            | Chức năng nghiệp vụ                                                                    |
| :-- | :--------------------------- | :-------------- | :---------: | :-------: | :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| 16  | `cargo_categories`           | `id`            |    Không    |   Không   | Không                                                                        | —                                                                                                                                                                                                                | Danh mục loại hàng hóa (tài liệu, hàng dễ vỡ, điện tử, chất lỏng...)                   |
| 17  | `service_types`              | `id`            |    Không    |   Không   | Không                                                                        | —                                                                                                                                                                                                                | Danh mục dịch vụ chuyển phát chính (Hỏa tốc, Nhanh, Tiết kiệm...)                      |
| 18  | `value_added_services`       | `id`            |    Không    |   Không   | Không                                                                        | —                                                                                                                                                                                                                | Danh mục dịch vụ gia tăng (Bảo hiểm khai giá, Đồng kiểm, Báo phát...)                  |
| 19  | `surcharges`                 | `id`            |    Không    |   Không   | Không                                                                        | —                                                                                                                                                                                                                | Danh mục phụ phí vận chuyển (Vùng sâu vùng xa, Quá khổ, Nhiên liệu...)                 |
| 20  | `weight_conversion_rules`    | `id`            |    Không    |   Không   | Không                                                                        | `service_type_id -> service_types(id)`                                                                                                                                                                           | Quy tắc chia quy đổi trọng lượng thể tích `(Dài x Rộng x Cao) / divisor`               |
| 21  | `pricing_tariffs`            | `id`            |    Không    |   Không   | Không                                                                        | `service_type_id -> service_types(id)`                                                                                                                                                                           | Bảng giá cước chính theo vùng (`zone_type`) và nấc trọng lượng                         |
| 22  | `sla_deadlines`              | `id`            |    Không    |   Không   | Không                                                                        | `service_type_id -> service_types(id)`                                                                                                                                                                           | Cấu hình thời gian cam kết lấy hàng, toàn trình giao và hạn lưu kho                    |
| 23  | `tracking_number_ranges`     | `id`            |    Không    |   Không   | Không                                                                        | `branch_id -> branches(id)`                                                                                                                                                                                      | Quản lý dải cấp phát mã vận đơn tuần tự theo chi nhánh (`FOR UPDATE`)                  |
| 24  | `customers`                  | `id`            |     Có      |   Không   | `phone_encrypted`, `phone_hash`, `phone_masked`, `bank_account_no_encrypted` | `user_id -> users(id)`                                                                                                                                                                                           | Hồ sơ khách hàng cá nhân (`individual`) và doanh nghiệp trả sau (`corporate_postpaid`) |
| 25  | `customer_addresses`         | `id`            |     Có      |   Không   | `phone_encrypted`, `phone_hash`, `phone_masked`                              | `customer_id -> customers(id)`, `province_id`, `district_id`, `ward_id`                                                                                                                                          | Sổ địa chỉ gửi/nhận lưu sẵn của khách hàng                                             |
| 26  | `pickup_requests`            | `id`            |     Có      |  **Có**   | `sender_phone_encrypted`, `sender_phone_hash`, `sender_phone_masked`         | `customer_id`, `branch_id`, `assigned_driver_id -> users(id)`                                                                                                                                                    | Yêu cầu lấy hàng tận nhà (`driver_pickup`) hoặc mang ra quầy (`counter_dropoff`)       |
| 27  | `shipments`                  | `id`            |     Có      |  **Có**   | `sender_phone_*`, `recipient_phone_*` (đủ 3 cột)                             | `parent_shipment_id`, `pickup_request_id`, `customer_id`, `origin_branch_id`, `destination_branch_id`, `current_branch_id`, `current_warehouse_id`, `assigned_driver_id`, `service_type_id`, `cargo_category_id` | Bảng trung tâm lưu trữ vận đơn, snapshot giá cước bất biến, COD và trạng thái hiện tại |
| 28  | `shipment_parcels`           | `id`            |    Không    |   Không   | Không                                                                        | `shipment_id -> shipments(id)`                                                                                                                                                                                   | Chi tiết từng kiện hàng (kích thước DxRxC, TL thực/quy đổi, mã barcode kiện)           |
| 29  | `shipment_vas`               | `id`            |    Không    |   Không   | Không                                                                        | `shipment_id -> shipments(id)`, `vas_id -> value_added_services(id)`                                                                                                                                             | Snapshot phí các dịch vụ gia tăng áp dụng trên từng vận đơn                            |
| 30  | `shipment_surcharges`        | `id`            |    Không    |   Không   | Không                                                                        | `shipment_id -> shipments(id)`, `surcharge_id -> surcharges(id)`                                                                                                                                                 | Snapshot các khoản phụ phí áp dụng trên từng vận đơn                                   |
| 31  | `shipment_status_history`    | `id`            |    Không    |   Không   | Không                                                                        | `shipment_id -> shipments(id)`, `branch_id`, `warehouse_id`, `actor_id`                                                                                                                                          | Nhật ký lịch sử hành trình vận đơn (có `client_event_uuid` chống trùng offline)        |
| 32  | `shipment_approval_requests` | `id`            |     Có      |  **Có**   | Không                                                                        | `shipment_id`, `branch_id`, `requested_by`, `reviewed_by`                                                                                                                                                        | Luồng Quản lý chi nhánh phê duyệt Hủy giao thành công, Duyệt hoàn, Giao lại            |
| 33  | `driver_gps_logs`            | `id`            |    Không    |   Không   | Không                                                                        | `driver_id -> users(id)`, `branch_id -> branches(id)`                                                                                                                                                            | Dữ liệu tọa độ GPS, tốc độ, pin của tài xế phục vụ bản đồ giám sát                     |
| 34  | `shipment_incidents`         | `id`            |     Có      |   Không   | Không                                                                        | `shipment_id`, `branch_id`, `responsible_user_id`, `reported_by`                                                                                                                                                 | Hồ sơ sự cố vận đơn (hư hỏng, mất mát, ướt bẩn) và quy trách nhiệm                     |

### Nhóm 3: Nhập kho, Đóng/Mở túi Seal, Xuất kho, Kiểm kho & Lịch sử Kho (9 Bảng)

| STT | Tên bảng SQL                  | Khóa chính (PK) | `public_id` | `version` | PII Hash / Encrypted | Khóa ngoại chính (FK)                                                                                         | Chức năng nghiệp vụ                                                                                    |
| :-- | :---------------------------- | :-------------- | :---------: | :-------: | :------------------- | :------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------- |
| 35  | `branch_routing_rules`        | `id`            |    Không    |   Không   | Không                | `origin_warehouse_id`, `destination_branch_id`, `next_hop_warehouse_id`                                       | Ma trận định tuyến trạm kế tiếp để bật cảnh báo sai tuyến khi xuất kho                                 |
| 36  | `third_party_partners`        | `id`            |    Không    |   Không   | Không                | —                                                                                                             | Danh mục nhà xe trung chuyển, đại lý hàng không (MAWB) và đối tác 3PL                                  |
| 37  | `vehicles`                    | `id`            |    Không    |   Không   | Không                | `branch_id`, `partner_id`, `default_driver_id -> users(id)`                                                   | Danh mục phương tiện vận tải và tải trọng tối đa `max_payload_kg`                                      |
| 38  | `manifest_bags`               | `id`            |     Có      |  **Có**   | Không                | `origin_warehouse_id`, `destination_warehouse_id`, `sealed_by`, `opened_by`                                   | Quản lý đóng túi và cắt seal mở túi hàng kèm mã niêm phong vật lý                                      |
| 39  | `manifest_bag_items`          | `id`            |    Không    |   Không   | Không                | `bag_id -> manifest_bags(id)`, `shipment_id -> shipments(id)`                                                 | Danh sách các vận đơn được đóng gói bên trong từng túi hàng                                            |
| 40  | `warehouse_receipts`          | `id`            |     Có      |  **Có**   | Không                | `warehouse_id`, `target_warehouse_id`, `driver_id`, `vehicle_id`, `partner_id`, `confirmed_by`, `unlocked_by` | Phiếu nhập kho (`inbound`), xuất trung chuyển (`outbound_linehaul`) và xuất giao (`outbound_delivery`) |
| 41  | `warehouse_receipt_items`     | `id`            |    Không    |   Không   | Không                | `receipt_id`, `shipment_id`, `bag_id`, `scanned_by`, `removed_by`                                             | Chi tiết từng vận đơn hoặc túi hàng được quét trong phiếu kho (kèm cờ `is_wrong_route`)                |
| 42  | `warehouse_stock_audits`      | `id`            |    Không    |   Không   | Không                | `warehouse_id -> warehouses(id)`, `auditor_id -> users(id)`                                                   | Phiếu kiểm kê hàng tồn kho định kỳ tại từng kho                                                        |
| 43  | `warehouse_stock_audit_items` | `id`            |    Không    |   Không   | Không                | `audit_id -> warehouse_stock_audits(id)`, `shipment_id -> shipments(id)`                                      | Chi tiết đối chiếu từng vận đơn khi kiểm kho và đề xuất duyệt hoàn quá hạn                             |

### Nhóm 4: Đền bù Sự cố, Sổ cái COD 2 Cấp, Đối soát Khách hàng & Nhật ký Hệ thống (12 Bảng)

| STT | Tên bảng SQL             | Khóa chính (PK) | `public_id` | `version` | PII Hash / Encrypted                       | Khóa ngoại chính (FK)                                                                      | Chức năng nghiệp vụ                                                            |
| :-- | :----------------------- | :-------------- | :---------: | :-------: | :----------------------------------------- | :----------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| 44  | `compensations`          | `id`            |     Có      |  **Có**   | Không                                      | `shipment_id`, `incident_id`, `branch_id`, `responsible_user_id`, `approved_by`, `paid_by` | Hồ sơ phê duyệt đền bù, phân bổ chi phí Công ty/Nhân viên và hạch toán chi trả |
| 45  | `cod_transactions`       | `id`            |     Có      |  **Có**   | Không                                      | `shipment_id`, `driver_id`, `branch_id`, `collection_id`, `customer_invoice_id`            | Sổ cái công nợ tiền thu hộ COD và cước thu hộ trên từng vận đơn                |
| 46  | `cash_collections`       | `id`            |     Có      |  **Có**   | Không                                      | `branch_id`, `driver_id`, `accountant_id`, `cancelled_by`                                  | Bảng kê Kế toán Bưu cục quét thu tiền COD/cước từ Tài xế để xóa công nợ        |
| 47  | `cash_remittances`       | `id`            |     Có      |  **Có**   | Không                                      | `from_branch_id`, `to_branch_id`, `submitted_by`, `verified_by`                            | Bảng kê nộp tiền từ Bưu cục về Trung tâm kèm ảnh biên lai đối soát 2 cấp       |
| 48  | `cash_remittance_items`  | `id`            |    Không    |   Không   | Không                                      | `remittance_id -> cash_remittances(id)`, `collection_id -> cash_collections(id)`           | Liên kết các bảng kê thu tiền bưu cục thuộc một đợt nộp tiền lên Trung tâm     |
| 49  | `customer_invoices`      | `id`            |     Có      |  **Có**   | Không                                      | `customer_id -> customers(id)`, `settled_by -> users(id)`                                  | Bảng kê đối soát công nợ cước trả sau (`ngtts`) và hoàn trả COD cho khách hàng |
| 50  | `customer_invoice_items` | `id`            |    Không    |   Không   | Không                                      | `invoice_id -> customer_invoices(id)`, `shipment_id -> shipments(id)`                      | Chi tiết từng vận đơn được quyết toán trong kỳ đối soát khách hàng             |
| 51  | `system_settings`        | `id`            |    Không    |   Không   | `setting_value` (mã hóa khi `is_secret=1`) | `updated_by -> users(id)`                                                                  | Cấu hình tham số hạ tầng, khóa API bên ngoài và tham số vận hành               |
| 52  | `idempotency_keys`       | `id`            |    Không    |   Không   | Không                                      | `user_id -> users(id)`                                                                     | Kiểm soát tính lũy đẳng chống trùng lặp giao dịch và đồng bộ Offline App       |
| 53  | `audit_logs`             | `id`            |    Không    |   Không   | Không                                      | `user_id -> users(id)`, `branch_id -> branches(id)`                                        | Nhật ký kiểm toán bất biến (Append-only) mọi thao tác nhạy cảm trong hệ thống  |
| 54  | `system_error_logs`      | `id`            |    Không    |   Không   | Không                                      | `user_id -> users(id)`, `resolved_by -> users(id)`                                         | Nhật ký lỗi kỹ thuật phục vụ Dev hệ thống giám sát và khắc phục sự cố          |
| 55  | `print_logs`             | `id`            |    Không    |   Không   | Không                                      | `user_id -> users(id)`, `branch_id -> branches(id)`                                        | Nhật ký kiểm soát lịch sử in phiếu gửi A4, tem barcode và bảng kê kho/COD      |
