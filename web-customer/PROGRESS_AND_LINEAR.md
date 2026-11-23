# PROGRESS_AND_LINEAR.md — Quản lý Tiến độ Web Khách & Tích hợp Linear (`my-logistics/web-customer`)

> **Tài liệu theo dõi tiến độ thực thi thực tế của phân hệ `web-customer/` trong Monorepo `my-logistics` (Linear Team `KHA`).**

---

## 1. Lệnh Bắt buộc Dành cho AI Agent Khi Làm Việc

1. **Khóa phạm vi thư mục (Monorepo)**:
   - AI chỉ được phép tạo/sửa code React bên trong `web-customer/` (và cập nhật file này). Tuyệt đối KHÔNG tự ý sửa code trong `server-php/`, `web-internal/`, `mobile-driver/` hay sửa `docs/AI_SYNC_CONTRACT.md`, `docs/API_CONTRACT.md`.
2. **Tự động cập nhật file tiến độ**:
   - Ngay sau khi AI hoàn thành một task hoặc hoàn thành xong một phần công việc (ví dụ: xong `Schema + Mock + API + Hook`, chưa xong `Components + Page`), AI **BẮT BUỘC** cập nhật trực tiếp bảng tiến độ ở **Mục 3** trước khi kết thúc lượt trả lời:
     - Cập nhật cột **Trạng thái** (`Todo` -> `In Progress` -> `In Review` -> `Done`).
     - Cập nhật cột **% Đóng góp** phản ánh đúng mức độ hoàn thành thực tế.
     - Ghi rõ các file/component đã hoàn thành và phần còn lại vào cột **Checkpoint bàn giao dở dang nếu quá giờ**.
3. **Quy tắc Bàn giao Tiếp sức (Relay Handover)**:
   - Mỗi task có **Timebox giới hạn (2–3 giờ)** gắn với một ngày thực hiện cố định.
   - Nếu hết thời gian Timebox mà người nhận chính chưa hoàn thành 100%, người làm phải push code lên nhánh `wip/KHA-xx-...` và cập nhật Checkpoint để thành viên khác nhận làm nốt và hưởng phần **% Đóng góp** tương ứng.

---

## 2. Quy chuẩn Git Branch, Commit & Pull Request (Đồng bộ Tự động Linear)

Để GitHub tự động liên kết và chuyển trạng thái Issue trên **Linear Team KHA**, mọi thành viên (`Khang`, `Minh`, `Nhân`, `Kiên`) và AI bắt buộc tuân thủ quy ước sau:

| Thành phần                     | Quy chuẩn bắt buộc                                             | Ví dụ thực tế                                                                                         |
| :----------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Tên nhánh (Feature Branch)** | `feat/KHA-<số>-<tên-ngắn-không-dấu>`                           | `feat/KHA-10-tracking-timeline`                                                                       |
| **Tên nhánh sửa lỗi**          | `fix/KHA-<số>-<tên-ngắn-không-dấu>`                            | `fix/KHA-12-rate-calculator-ui`                                                                       |
| **Tên nhánh bàn giao dở**      | `wip/KHA-<số>-<tên-ngắn-không-dấu>`                            | `wip/KHA-15-pickup-create-map`                                                                        |
| **Commit Message**             | `feat(KHA-<số>): <mô tả ngắn gọn>` (hoặc `fix(KHA-<số>): ...`) | `feat(KHA-10): build multi-code tracking search and timeline`                                         |
| **Pull Request Title**         | `[KHA-<số>] <Tên task ngắn gọn>`                               | `[KHA-10] Màn hình Tra cứu trạng thái & Timeline vận đơn`                                             |
| **Pull Request Description**   | Bắt buộc chứa từ khóa **`Closes KHA-<số>`** ở dòng đầu tiên    | `Closes KHA-10` _(Lưu ý: Cần merge vào nhánh mặc định hoặc bật rule cho nhánh `develop` trên Linear)_ |

---

## 3. Bảng Theo dõi Tiến độ `web-customer/` (`KHA-9` – `KHA-58`)

_(Đã đối chiếu khớp 100% với mã Issue thực tế trên Linear Workspace `KhangDev` Team `KHA`. Tổng trọng số riêng `web-customer/` = **74 điểm**; task dựng khung chung `KHA-7` [9đ] theo dõi chính bên `web-internal/PROGRESS_AND_LINEAR.md`.)_

| Mã KHA   | Tên Task (`web-customer/`)                                                      | Người nhận | Timebox (giờ) | Ngày thực hiện | Trạng thái | % Đóng góp  | Checkpoint bàn giao dở dang nếu quá giờ                                                                |
| :------- | :------------------------------------------------------------------------------ | :--------- | :-----------: | :------------: | :--------- | :---------: | :----------------------------------------------------------------------------------------------------- |
| `KHA-7`  | _(Tham chiếu chung)_ Dựng khung 2 Web React Feature-based & Mock Data           | `Khang`    |      2h       |   23/11/2026   | `In Review` | `100%` _(9đ)_ | Hoàn tất mock login, mock data và luồng Zustand cho cả hai web; 15 mock JSON hợp lệ; `npm run build` thành công ở `web-customer` và `web-internal`, sẵn sàng review/push lên `develop`. |
| `KHA-9`  | Giao diện Đăng ký, Đăng nhập & Xác nhận đồng ý dữ liệu cá nhân NĐ13             | `Minh`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(8đ)_ | Hoàn thiện UI form Đăng ký/Đăng nhập validate bằng Zod và chạy thông với Mock/API login.               |
| `KHA-10` | Màn hình Tra cứu trạng thái & Timeline hành trình vận đơn công khai             | `Minh`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(9đ)_ | Hiển thị đầy đủ thẻ thông tin vận đơn và timeline hành trình chạy mượt với dữ liệu Mock/API.           |
| `KHA-11` | Màn hình Tìm kiếm vị trí Bưu cục/Chi nhánh trên bản đồ & Chỉ đường              | `Minh`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(8đ)_ | Hoàn thiện bộ lọc khu vực, danh sách bưu cục và nút chỉ đường tọa độ GPS chính xác.                    |
| `KHA-12` | Màn hình Ước tính cước phí vận chuyển (Trọng lượng thực & Quy đổi DxRxC)        | `Nhân`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(9đ)_ | Hoàn thiện form nhập thông số và bảng hiển thị kết quả tính cước theo JSON mẫu.                        |
| `KHA-13` | Màn hình Quản lý Sổ địa chỉ gửi/nhận của Khách hàng thành viên                  | `Nhân`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(8đ)_ | Hoàn thành danh sách sổ địa chỉ và form thêm mới chọn đủ 3 cấp Tỉnh/Huyện/Xã.                          |
| `KHA-15` | Màn hình Tạo yêu cầu gửi hàng (Lấy tận nhà hoặc Mang ra bưu cục chọn bản đồ)    | `Kiên`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(9đ)_ | Hoàn thiện form tạo yêu cầu cho cả 2 chế độ `driver_pickup` và `counter_dropoff` với dữ liệu Mock/API. |
| `KHA-16` | Khởi tạo khung React + TypeScript Feature-based cho Web Khách                  | `AI`       |      2h       |   23/11/2026   | `Done`     | `100%` | Hoàn tất Vite, Tailwind/Shadcn, contracts, Axios/store/router/layouts, shared UI, 7 feature pages và 6 mock; build và lint thành công. |
| `KHA-22` | Màn hình Lịch sử vận đơn của tôi, Chi tiết hành trình & Hủy đơn chưa lấy        | `Minh`     |      3h       |   24/11/2026   | `Todo`     | `0%` _(9đ)_ | Hoàn thiện danh sách vận đơn khách hàng, modal chi tiết và luồng xác nhận hủy đơn hợp lệ.              |
| `KHA-54` | Hoàn thiện trang Chủ, Tối ưu Responsive & Kiểm thử luồng khách hàng đầu cuối    | `Kiên`     |      2h       |   30/11/2026   | `Todo`     | `0%` _(7đ)_ | Hoàn thiện trang chủ `Web Khách` và sửa xong toàn bộ lỗi hiển thị responsive trên màn hình nhỏ.        |
| `KHA-58` | Kiểm thử tích hợp Tra cứu, Bản đồ bưu cục, Tính cước & Tạo/Hủy yêu cầu gửi hàng | `Kiên`     |      2h       |   01/12/2026   | `Todo`     | `0%` _(7đ)_ | Đảm bảo 100% màn hình trên `Web Khách` hoạt động ổn định với API thật và không còn dùng dữ liệu Mock.  |
