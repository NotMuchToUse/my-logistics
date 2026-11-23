# PROGRESS_AND_LINEAR.md — Quản lý Tiến độ Web Nội bộ & Tích hợp Linear (`my-logistics/web-internal`)

> **Tài liệu theo dõi tiến độ thực thi thực tế của phân hệ `web-internal/` trong Monorepo `my-logistics` (Linear Team `KHA`).**

---

## 1. Lệnh Bắt buộc Dành cho AI Agent Khi Làm Việc

1. **Khóa phạm vi thư mục (Monorepo)**:
   - AI chỉ được phép tạo/sửa code React bên trong `web-internal/` (và cập nhật file này). Tuyệt đối KHÔNG tự ý sửa code trong `server-php/`, `web-customer/`, `mobile-driver/` hay sửa `docs/AI_SYNC_CONTRACT.md`, `docs/API_CONTRACT.md`.
2. **Tự động cập nhật file tiến độ**:
   - Ngay sau khi AI hoàn thành một task hoặc hoàn thành xong một phần công việc (ví dụ: xong `Schema + Mock + API + Hook`, chưa xong `Components + Page`), AI **BẮT BUỘC** cập nhật trực tiếp bảng tiến độ ở **Mục 3** trước khi kết thúc lượt trả lời:
     - Cập nhật cột **Trạng thái** (`Todo` -> `In Progress` -> `In Review` -> `Done`).
     - Cập nhật cột **% Đóng góp** phản ánh đúng mức độ hoàn thành thực tế.
     - Ghi rõ các file/component đã hoàn thành và phần còn lại vào cột **Checkpoint bàn giao dở dang nếu quá giờ**.
3. **Quy tắc Bàn giao Tiếp sức (Relay Handover)**:
   - Mỗi task có **Timebox giới hạn (2–4 giờ)** gắn với một ngày thực hiện cố định.
   - Nếu hết thời gian Timebox mà người nhận chính chưa hoàn thành 100%, người làm phải push code lên nhánh `wip/KHA-xx-...` và cập nhật Checkpoint để thành viên khác nhận làm nốt và hưởng phần **% Đóng góp** tương ứng.

---

## 2. Quy chuẩn Git Branch, Commit & Pull Request (Đồng bộ Tự động Linear)

Để GitHub tự động liên kết và chuyển trạng thái Issue trên **Linear Team KHA**, mọi thành viên (`Khang`, `Minh`, `Nhân`, `Kiên`) và AI bắt buộc tuân thủ quy ước sau:

| Thành phần                     | Quy chuẩn bắt buộc                                             | Ví dụ thực tế                                                                                         |
| :----------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Tên nhánh (Feature Branch)** | `feat/KHA-<số>-<tên-ngắn-không-dấu>`                           | `feat/KHA-14-internal-auth-sidebar`                                                                   |
| **Tên nhánh sửa lỗi**          | `fix/KHA-<số>-<tên-ngắn-không-dấu>`                            | `fix/KHA-28-parcel-weight-calc`                                                                       |
| **Tên nhánh bàn giao dở**      | `wip/KHA-<số>-<tên-ngắn-không-dấu>`                            | `wip/KHA-40-outbound-linehaul-ui`                                                                     |
| **Commit Message**             | `feat(KHA-<số>): <mô tả ngắn gọn>` (hoặc `fix(KHA-<số>): ...`) | `feat(KHA-28): build multi-parcel shipment creation form`                                             |
| **Pull Request Title**         | `[KHA-<số>] <Tên task ngắn gọn>`                               | `[KHA-28] Giao diện Tạo Vận đơn chi tiết`                                                             |
| **Pull Request Description**   | Bắt buộc chứa từ khóa **`Closes KHA-<số>`** ở dòng đầu tiên    | `Closes KHA-28` _(Lưu ý: Cần merge vào nhánh mặc định hoặc bật rule cho nhánh `develop` trên Linear)_ |

---

## 3. Bảng Theo dõi Tiến độ 30 Task `web-internal/` (`KHA-7` – `KHA-57`)

_(Đã đối chiếu khớp 100% với mã Issue thực tế trên Linear Workspace `KhangDev` Team `KHA`. Tổng trọng số phần `web-internal/` = **247 điểm** + `KHA-7` [9đ] = **256 điểm**.)_

| Mã KHA   | Tên Task (`web-internal/`)                                                                   | Người nhận | Timebox (giờ) | Ngày thực hiện | Trạng thái |  % Đóng góp  | Checkpoint bàn giao dở dang nếu quá giờ                                                                             |
| :------- | :------------------------------------------------------------------------------------------- | :--------- | :-----------: | :------------: | :--------- | :----------: | :------------------------------------------------------------------------------------------------------------------ |
| `KHA-7`  | Dựng khung 2 Web React Feature-based & Mock Data (`VITE_USE_MOCK`)                           | `Khang`    |      2h       |   23/11/2026   | `Todo`     | `0%` _(9đ)_  | Push 2 thư mục React (`web-internal/`, `web-customer/`) build sạch kèm `src/mocks/` lên nhánh `develop`.            |
| `KHA-14` | Giao diện Đăng nhập Portal (Mã NV/Email), Đổi mật khẩu lần đầu & Sidebar theo Role           | `Nhân`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(8đ)_  | Đăng nhập thành công vào Portal, lưu state phân quyền và hiển thị Sidebar phân nhóm đúng 7 phân hệ.                 |
| `KHA-17` | Giao diện Quản lý Danh mục Dịch vụ chính, DVGT, Phụ phí & Bảng giá cước                      | `Kiên`     |      3h       |   23/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện giao diện 4 tab bảng dữ liệu và modal thêm/sửa kết nối API danh mục.                                     |
| `KHA-23` | Giao diện Quản lý Danh mục Trung tâm / Chi nhánh / Bưu cục / Kho bãi                         | `Minh`     |      3h       |   24/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện bảng quản lý Chi nhánh/Bưu cục và form tạo/sửa có validate tọa độ GPS.                                   |
| `KHA-24` | Giao diện Quản lý Tài khoản Nhân viên, Khách hàng & Gán Role/Phạm vi Chi nhánh               | `Minh`     |      3h       |   24/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện giao diện danh sách nhân sự và modal gán Role + Branch Scope kết nối API.                                |
| `KHA-25` | Giao diện Điều phối Lấy hàng: Danh sách yêu cầu, Cảnh báo trễ SLA & Phân lệnh tài xế         | `Nhân`     |      3h       |   24/11/2026   | `Todo`     | `0%` _(9đ)_  | Hoàn thiện bảng điều phối lấy hàng với badge cảnh báo trễ SLA và modal phân lệnh tài xế.                            |
| `KHA-26` | Giao diện Danh sách Vận đơn đa bộ lọc, Đánh dấu ưu tiên & Xuất Excel/CSV                     | `Nhân`     |      3h       |   24/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện bảng danh sách vận đơn đa bộ lọc, thao tác báo ưu tiên/hủy và xuất file CSV client-side.                 |
| `KHA-27` | Giao diện Chi tiết Vận đơn, Timeline hành trình nội bộ/public & Lịch sử in                   | `Nhân`     |      3h       |   24/11/2026   | `Todo`     | `0%` _(8đ)_  | Hiển thị đầy đủ 4 khối thông tin chi tiết vận đơn, kiện hàng, chi tiết phí và lịch sử hành trình.                   |
| `KHA-28` | Giao diện Tạo Vận đơn chi tiết (Nhập nhiều kiện DxRxC, Tính cước tự động, Thu cước tại quầy) | `Kiên`     |      4h       |   24/11/2026   | `Todo`     | `0%` _(10đ)_ | Hoàn thiện form tạo vận đơn đa kiện hàng, tự động cộng tổng trọng lượng/cước phí và gửi payload tạo đơn thành công. |
| `KHA-29` | Giao diện In Phiếu gửi A4, Tem nhãn Barcode kiện hàng & Quản lý dải mã vận đơn               | `Kiên`     |      3h       |   24/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện template xem trước & in Phiếu gửi A4 + Tem barcode kiện hàng gọi ghi nhận `print_logs`.                  |
| `KHA-30` | Giao diện Cấu hình SLA Deadline, Quy tắc định tuyến & Đối tác 3PL/Phương tiện                | `Kiên`     |      2h       |   24/11/2026   | `Todo`     | `0%` _(7đ)_  | Hoàn thiện giao diện bảng và modal thêm/sửa cho 3 danh mục cấu hình vận hành.                                       |
| `KHA-32` | Giao diện Import Vận đơn hàng loạt từ file Excel & Báo lỗi từng dòng                         | `Minh`     |      3h       |   25/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện đọc file Excel lên bảng xem trước và hiển thị danh sách lỗi trả về theo từng dòng.                       |
| `KHA-33` | Giao diện Quản lý Vận đơn chờ xử lý, Chờ chuyển hoàn & Tạo đơn chuyển tiếp                   | `Nhân`     |      3h       |   25/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện bảng danh sách đơn chờ chuyển hoàn và modal tạo đơn chuyển hoàn/chuyển tiếp.                             |
| `KHA-34` | Giao diện Báo cáo & Xử lý Vận đơn sự cố (Gán trách nhiệm & Ảnh chứng từ)                     | `Kiên`     |      3h       |   25/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện danh sách sự cố và modal tạo/cập nhật gán người chịu trách nhiệm.                                        |
| `KHA-36` | Giao diện Trình duyệt & Phê duyệt Hủy giao thành công / Duyệt hoàn cấp Chi nhánh             | `Minh`     |      3h       |   26/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện danh sách chờ duyệt cấp chi nhánh và modal xem chứng từ phê duyệt/từ chối.                               |
| `KHA-37` | Giao diện Nhập kho Barcode (Phân loại mới lấy, trung chuyển, giao lại, tại quầy)             | `Nhân`     |      3h       |   26/11/2026   | `Todo`     | `0%` _(9đ)_  | Hoàn thiện màn hình quét barcode nhập kho theo 4 phân loại và hiển thị danh sách quét tức thì.                      |
| `KHA-38` | Giao diện Đóng túi & Mở túi hàng niêm phong (Seal) tại kho                                   | `Kiên`     |      3h       |   26/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện giao diện tạo túi gắn mã Seal, quét đơn vào túi và thao tác chốt niêm phong.                             |
| `KHA-40` | Giao diện Xuất kho Trung chuyển (Xe tải/Xe máy/MAWB, Cảnh báo sai tuyến & Chốt phiếu)        | `Minh`     |      3h       |   27/11/2026   | `Todo`     | `0%` _(9đ)_  | Hoàn thiện form lập phiếu xuất kho trung chuyển, kiểm soát tải trọng và cảnh báo sai tuyến.                         |
| `KHA-41` | Giao diện Xuất kho Giao hàng (Phân công tài xế, Gỡ đơn & Chốt phiếu xuất kho)                | `Nhân`     |      3h       |   27/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện màn hình quét xuất kho giao hàng, gỡ đơn trước khi chốt và nút Chốt phiếu.                               |
| `KHA-42` | Giao diện Lịch sử Nhập/Xuất kho, In bảng kê giao hàng & Quản lý CN Mở khóa phiếu             | `Kiên`     |      3h       |   27/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện danh sách lịch sử phiếu kho, template in bảng kê và modal Mở khóa phiếu cho Quản lý CN.                  |
| `KHA-44` | Giao diện Kiểm kê hàng tồn kho (Theo trạng thái/SLA, Xuất CSV & Đề xuất duyệt hoàn)          | `Minh`     |      3h       |   28/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện màn hình thống kê tồn kho, quét kiểm kê và nút xuất file CSV.                                            |
| `KHA-45` | Giao diện Kế toán Bưu cục: Quét đơn thu tiền COD Tài xế & Khóa/Hủy bảng kê                   | `Nhân`     |      3h       |   28/11/2026   | `Todo`     | `0%` _(9đ)_  | Hoàn thiện màn hình công nợ tài xế, quét đơn lập bảng kê và thao tác Khóa/Hủy bảng kê.                              |
| `KHA-46` | Giao diện Kế toán Bưu cục: Lập bảng kê nộp tiền lên Trung tâm & Đính kèm biên lai            | `Kiên`     |      3h       |   28/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện form gom bảng kê thu tiền lập phiếu nộp lên Trung tâm kèm upload ảnh biên lai.                           |
| `KHA-48` | Giao diện Kế toán Trung tâm: Xác nhận tiền nộp từ Chi nhánh & Đối soát công nợ NGTTS         | `Minh`     |      3h       |   29/11/2026   | `Todo`     | `0%` _(9đ)_  | Hoàn thiện giao diện kiểm tra ảnh biên lai và xác nhận nhận tiền nộp từ các chi nhánh.                              |
| `KHA-49` | Giao diện Đề xuất, Phê duyệt Đền bù sự cố (Phân bổ chi phí) & Hạch toán chi trả              | `Nhân`     |      3h       |   29/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện form đề xuất đền bù và giao diện Quản lý chi nhánh phê duyệt phân bổ chi phí.                            |
| `KHA-50` | Giao diện Giám sát định vị GPS Tài xế trên bản đồ & Theo dõi ca làm việc                     | `Kiên`     |      3h       |   29/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện bản đồ hiển thị vị trí tài xế theo chi nhánh và danh sách thông tin chi tiết từng tài xế.                |
| `KHA-52` | Giao diện Báo cáo Tổng hợp vận đơn, Báo cáo Giao nhận & Công nợ COD (Xuất Excel/CSV)         | `Minh`     |      3h       |   30/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện 2 màn hình bảng số liệu Báo cáo tổng hợp vận đơn và Công nợ COD có nút xuất file CSV/Excel.              |
| `KHA-53` | Giao diện Quản trị Hệ thống: Nhật ký Audit Log, System Error Logs & Cấu hình tham số         | `Nhân`     |      3h       |   30/11/2026   | `Todo`     | `0%` _(8đ)_  | Hoàn thiện giao diện tra cứu `audit_logs`, `system_error_logs` và form cập nhật `system_settings`.                  |
| `KHA-56` | Kiểm thử tích hợp Phân quyền 13 Roles, Branch Scope & Sửa lỗi UI luồng Kho/Vận đơn           | `Minh`     |      2h       |   01/12/2026   | `Todo`     | `0%` _(7đ)_  | Hoàn tất checklist kiểm thử UI luồng Vận đơn & Kho bãi với API thật.                                                |
| `KHA-57` | Kiểm thử tích hợp Luồng Kế toán COD 2 cấp, Đền bù & Báo cáo xuất file                        | `Nhân`     |      2h       |   01/12/2026   | `Todo`     | `0%` _(7đ)_  | Xác nhận số liệu công nợ COD hiển thị khớp 100% giữa sổ cái, bảng kê thu/nộp và file Excel xuất ra.                 |
