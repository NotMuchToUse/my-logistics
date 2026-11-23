# PROGRESS_AND_LINEAR.md — Kế hoạch Đặt chờ & Backlog Linear (`my-logistics/mobile-driver`)

> **Tài liệu theo dõi tiến độ dành cho phân hệ `mobile-driver/` trong Monorepo `my-logistics` trên Linear Team KHA.**
> **Trạng thái hiện tại**: **Đặt chờ (Backlog Giai đoạn 2)** — Do `Khang` phụ trách thực hiện sau khi hoàn tất 3 phân hệ nền tảng (`server-php/`, `web-internal/`, `web-customer/`).

---

## 1. Lệnh Bắt buộc Dành cho AI Agent Khi Bắt đầu Triển khai Giai đoạn 2

1. **Hỏi chốt Tech Stack trước tiên**:
   - Khi `Khang` mở thư mục `mobile-driver/` và ra lệnh bắt đầu code, AI **PHẢI hỏi lại `Khang` chốt công nghệ Mobile** (React Native / Expo, Flutter hay Kotlin) trước khi tạo cấu trúc project.
   - Tuyệt đối chỉ tạo/sửa code bên trong `mobile-driver/`, không tự ý sửa code của `server-php/`, `web-internal/`, `web-customer/` hay `docs/AI_SYNC_CONTRACT.md`.
2. **Tự động cập nhật bảng tiến độ**:
   - Ngay sau khi hoàn thành một task hoặc hoàn thành xong một phần công việc (ví dụ: xong `Local DB + Sync Manager`, chưa xong `Screens`), AI **BẮT BUỘC** cập nhật trực tiếp bảng ở **Mục 3** của file này trước khi kết thúc lượt trả lời:
     - Cập nhật cột **Trạng thái** (`Backlog` -> `Todo` -> `In Progress` -> `In Review` -> `Done`).
     - Cập nhật cột **% Đóng góp** phản ánh đúng tiến độ hoàn thành.
     - Ghi rõ các file/tầng đã hoàn thành và phần còn lại vào cột **Checkpoint bàn giao / Ghi chú kỹ thuật**.

---

## 2. Quy chuẩn Git Branch, Commit & Pull Request (Đồng bộ Tự động Linear)

Khi triển khai `mobile-driver/` trong repo `my-logistics`, mọi nhánh và PR bắt buộc tuân thủ quy ước sau để tự động cập nhật trạng thái Issue trên **Linear Team KHA**:

| Thành phần                     | Quy chuẩn bắt buộc                                             | Ví dụ thực tế                                                                                         |
| :----------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Tên nhánh (Feature Branch)** | `feat/KHA-<số>-<tên-ngắn-không-dấu>`                           | `feat/KHA-59-mobile-driver-scaffold`                                                                  |
| **Tên nhánh sửa lỗi**          | `fix/KHA-<số>-<tên-ngắn-không-dấu>`                            | `fix/KHA-61-pod-image-compression`                                                                    |
| **Tên nhánh bàn giao dở**      | `wip/KHA-<số>-<tên-ngắn-không-dấu>`                            | `wip/KHA-63-offline-queue-sync`                                                                       |
| **Commit Message**             | `feat(KHA-<số>): <mô tả ngắn gọn>` (hoặc `fix(KHA-<số>): ...`) | `feat(KHA-60): implement first-mile pickup and white receipt photo`                                   |
| **Pull Request Title**         | `[KHA-<số>] <Tên task ngắn gọn>`                               | `[KHA-61] Nghiệp vụ Tài xế Giao hàng, Thu COD & Biên lai hồng`                                        |
| **Pull Request Description**   | Bắt buộc chứa từ khóa **`Closes KHA-<số>`** ở dòng đầu tiên    | `Closes KHA-61` _(Lưu ý: Cần merge vào nhánh mặc định hoặc bật rule cho nhánh `develop` trên Linear)_ |

---

## 3. Bảng 5 Task Backlog trên Linear (`KHA-59` – `KHA-63`)

_(Đã đối chiếu khớp 100% với mã Issue thực tế trong `Backlog` trên Linear Workspace `KhangDev` Team `KHA`.)_

| Mã KHA   | Tên Task (`mobile-driver/`)                                                                          | Người nhận | Timebox (giờ) | Trạng thái |  % Đóng góp  | Checkpoint bàn giao / Ghi chú kỹ thuật                                                                                                                                                                                                           |
| :------- | :--------------------------------------------------------------------------------------------------- | :--------- | :-----------: | :--------: | :----------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KHA-59` | Dựng khung ứng dụng Driver, Đăng nhập thiết bị & Quản lý ca làm việc                                 | `Khang`    |      3h       | `Backlog`  | `0%` _(10đ)_ | Chốt framework Mobile; tích hợp `POST /api/v1/auth/login` (`device_type = mobile_driver`), lưu token an toàn và điều hướng đúng màn hình chính theo vai trò `pickup_delivery_driver` / `linehaul_driver`.                                        |
| `KHA-60` | Chức năng Tài xế Lấy hàng (First-mile): Nhận/Từ chối lệnh, Tạo đơn nhanh & Chụp biên lai trắng       | `Khang`    |      4h       | `Backlog`  | `0%` _(12đ)_ | Hoàn thành luồng nhận/từ chối lệnh lấy hàng (`pickup_requests`), tạo nhanh vận đơn tại điểm lấy, chụp/nén ảnh biên lai trắng (`white_receipt_image_url`) và xác nhận `picked_up` / `pickup_failed`.                                              |
| `KHA-61` | Chức năng Tài xế Giao hàng (Last-mile): Nhận bàn giao kho, Giao thành công thu COD & Biên lai hồng   | `Khang`    |      4h       | `Backlog`  | `0%` _(12đ)_ | Hoàn thành màn hình nhận bàn giao từ kho (`outbound_delivery -> handed_over`), xác nhận giao thành công (`actual_recipient_name`, thu COD -> `cod_transactions`, ảnh `pink_receipt_image_url`), giao thất bại/giao lại và theo dõi COD phải nộp. |
| `KHA-62` | Chức năng Tài xế Trung chuyển (Line-haul): Nhận lệnh trung chuyển, Bàn giao kho nhận & Báo cáo sự cố | `Khang`    |      3h       | `Backlog`  | `0%` _(10đ)_ | Hoàn thành luồng nhận lệnh & bàn giao trung chuyển (`outbound_linehaul`, `manifest_bags`) tại `target_warehouse_id` và màn hình gửi báo cáo sự cố kèm ảnh (`shipment_incidents`).                                                                |
| `KHA-63` | Xây dựng Hàng đợi Offline Queue, Đồng bộ Idempotency & Gửi định                                      |
