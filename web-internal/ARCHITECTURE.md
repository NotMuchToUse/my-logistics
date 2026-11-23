# ARCHITECTURE.md — Kiến trúc Feature-Based (`vietstar-web-internal`)

> Cổng vận hành nội bộ của hệ thống **Logistics Vietstar** dành cho **11 vai trò nhân sự** (`receptionist`, `coordinator`, `warehouse_staff`, `branch_accountant`, `hq_accountant`, `branch_manager`, `board_director`, `system_admin`, `system_dev` và giám sát 2 vai trò tài xế).
> Xây dựng bằng **ReactJS (100% Functional Components & Hooks) + Tailwind CSS + Shadcn UI + Lucide Icons**.

---

## 1. Cơ chế Layout Động: Branch Switcher & Dynamic Sidebar

1. **Topbar Branch Switcher (`src/layouts/components/BranchSwitcher.jsx`)**:
   - Đọc danh sách phạm vi làm việc từ `user_branch_scopes` của user đăng nhập (`hq_all`, `region_center`, `branch`, `post_office`, `warehouse`).
   - Khi nhân viên chuyển đổi chi nhánh/kho làm việc trên Topbar, `branchScopeStore` cập nhật `activeBranchId` và tự động tiêm header `X-Branch-Id` vào mọi request của `axiosClient`.
2. **Sidebar Phân quyền Động (`src/layouts/components/DynamicSidebar.jsx`)**:
   - Chỉ render các nhóm menu và đường dẫn mà user hiện tại có mã quyền tương ứng trong mảng `permissions` trả về từ `/api/v1/auth/me`.
   - Khi `user.must_change_password === 1`, `InternalLayout` khóa toàn bộ thao tác và hiển thị bắt buộc modal đổi mật khẩu lần đầu.

---

## 2. Cây Thư mục Feature-Based Chuẩn (`vietstar-web-internal`)

```text
vietstar-web-internal/
├── public/
│   └── favicon.ico
├── src/
│   ├── core/
│   │   ├── api/
│   │   │   └── axiosClient.js              # Axios instance gắn Bearer Token, X-Branch-Id, Idempotency-Key, VITE_USE_MOCK
│   │   ├── stores/
│   │   │   ├── useAuthStore.js             # Lưu user, token, roles (11 roles), permissions
│   │   │   └── useBranchScopeStore.js      # Lưu danh sách user_branch_scopes & activeBranchId cho X-Branch-Id
│   │   ├── guards/
│   │   │   ├── ProtectedRoute.jsx          # Chặn truy cập khi chưa đăng nhập
│   │   │   └── PermissionGuard.jsx         # Ẩn/hiện nút bấm hoặc chặn route theo permissions.code
│   │   ├── router/
│   │   │   └── AppRouter.jsx               # Cấu hình React Router v6 gom route từ các features
│   │   └── utils/
│   │       ├── formatters.js               # Định dạng tiền VND, trọng lượng gram/kg, ngày giờ +07:00
│   │       └── exportCsv.js                # Tiện ích xuất dữ liệu bảng ra file CSV/Excel
│   ├── components/
│   │   ├── ui/                             # Bộ Shadcn UI gốc (Button, Input, Table, Dialog, Badge, Select, Tabs...)
│   │   └── shared/                         # Component dùng chung (DataTable, StatusBadge, BarcodeSvg, ConfirmDialog)
│   ├── layouts/
│   │   ├── InternalLayout.jsx              # Khung giao diện chính gồm DynamicSidebar + Topbar + Outlet
│   │   └── components/
│   │       ├── Topbar.jsx                  # Thanh trên cùng chứa BranchSwitcher & thông tin tài khoản
│   │       ├── BranchSwitcher.jsx          # Bộ chọn Chi nhánh/Bưu cục/Kho đang thao tác
│   │       └── DynamicSidebar.jsx          # Menu 7 phân hệ render động theo RBAC permissions
│   ├── mocks/                              # Dữ liệu JSON giả lập chuẩn AI_SYNC_CONTRACT.md (chạy khi VITE_USE_MOCK=true)
│   │   ├── auth.mock.json
│   │   ├── masterData.mock.json
│   │   ├── networkOrg.mock.json
│   │   ├── pickup.mock.json
│   │   ├── shipment.mock.json
│   │   ├── warehouse.mock.json
│   │   ├── finance.mock.json
│   │   ├── incidentCompensation.mock.json
│   │   └── reportsAdmin.mock.json
│   ├── features/                           # 27 MODULE NGHIỆP VỤ CÔ LẬP HOÀN TOÀN
│   │   ├── auth/                           # Đăng nhập Portal (Mã NV/Email), Đổi mật khẩu lần đầu
│   │   ├── network-org/                    # Quản lý Trung tâm / Chi nhánh / Bưu cục / Kho bãi (branches, warehouses)
│   │   ├── user-management/                # Quản lý Nhân viên, Khách hàng, Gán Role & user_branch_scopes
│   │   ├── pricing-catalog/                # Quản lý Dịch vụ chính, DVGT, Phụ phí, Bảng giá & Quy đổi trọng lượng
│   │   ├── ops-config/                     # Cấu hình SLA Deadline, Ma trận định tuyến kho, Đối tác 3PL & Phương tiện
│   │   ├── pickup-dispatch/                # Điều phối lấy hàng, Cảnh báo trễ SLA, Phân lệnh tài xế
│   │   ├── shipment-create/                # Tạo vận đơn chi tiết đa kiện DxRxC, Tính cước tự động, Thu cước tại quầy
│   │   ├── shipment-list/                  # Danh sách vận đơn đa bộ lọc, Đánh dấu ưu tiên, Xuất Excel/CSV
│   │   ├── shipment-detail/                # Chi tiết vận đơn, Kiện hàng, Snapshot phí, Timeline & Lịch sử in
│   │   ├── shipment-bulk-import/           # Import vận đơn hàng loạt từ file Excel & Báo lỗi từng dòng
│   │   ├── shipment-exceptions/            # Vận đơn chờ xử lý, Chờ chuyển hoàn (pending_return) & Tạo đơn chuyển tiếp
│   │   ├── shipment-incidents/             # Báo cáo & Xử lý vận đơn sự cố (damaged/lost/wet_contaminated)
│   │   ├── branch-approvals/               # Trình duyệt & Quản lý CN phê duyệt Hủy giao thành công / Duyệt hoàn
│   │   ├── waybill-print/                  # In Phiếu gửi A4, Tem nhãn Barcode kiện hàng & Quản lý dải mã vận đơn
│   │   ├── warehouse-inbound/              # Nhập kho Barcode (4 nguồn: mới lấy, trung chuyển, giao lại, tại quầy)
│   │   ├── warehouse-bags/                 # Đóng túi & Mở túi hàng niêm phong (Seal) tại kho
│   │   ├── warehouse-outbound-linehaul/    # Xuất kho trung chuyển (Xe tải/Xe máy/MAWB, Cảnh báo sai tuyến & Chốt phiếu)
│   │   ├── warehouse-outbound-delivery/    # Xuất kho giao hàng (Phân công tài xế, Gỡ đơn trước chốt & Chốt phiếu)
│   │   ├── warehouse-history/              # Lịch sử Nhập/Xuất kho, In bảng kê & Quản lý CN Mở khóa phiếu xuất kho
│   │   ├── warehouse-audit/                # Kiểm kê hàng tồn kho (Theo trạng thái/SLA, Xuất CSV & Đề xuất duyệt hoàn)
│   │   ├── branch-cod-collection/          # Kế toán Bưu cục: Quét đơn thu tiền COD Tài xế & Khóa/Hủy bảng kê
│   │   ├── branch-remittance/              # Kế toán Bưu cục: Lập bảng kê nộp tiền lên Trung tâm & Đính kèm biên lai
│   │   ├── hq-finance/                     # Kế toán Trung tâm: Xác nhận tiền nộp Chi nhánh & Đối soát công nợ NGTTS
│   │   ├── compensations/                  # Đề xuất, Quản lý CN phê duyệt Đền bù (phân bổ chi phí) & Kế toán TT chi trả
│   │   ├── driver-gps-monitor/             # Giám sát định vị GPS Tài xế trên bản đồ & Theo dõi ca làm việc
│   │   ├── reports-analytics/              # Báo cáo Tổng hợp vận đơn, Báo cáo Giao nhận & Công nợ COD (Xuất file)
│   │   └── system-logs-settings/           # Nhật ký Audit Log, System Error Logs (Dev) & Cấu hình tham số hệ thống
│   ├── App.jsx
│   └── main.jsx
├── .env.example                            # VITE_API_BASE_URL, VITE_USE_MOCK=true
├── package.json
├── AI_SYNC_CONTRACT.md
├── PROJECT_CONTEXT.md
├── AI_RULES.md
├── ARCHITECTURE.md
└── PROGRESS_AND_LINEAR.md
```

### Cấu trúc chuẩn bên trong mỗi thư mục `src/features/<feature-name>/`:

```text
src/features/<feature-name>/
├── api/            # <feature>.api.js (Hỗ trợ chuyển đổi VITE_USE_MOCK)
├── components/     # Các UI component nhỏ dùng riêng cho feature này
├── constants/      # <feature>.constants.js (Nhãn trạng thái, cấu hình cột)
├── hooks/          # use<Feature>.js (Quản lý state & gọi API)
├── pages/          # <Feature>Page.jsx (Trang chính gắn vào Router)
└── schemas/        # <feature>.schema.js (Zod validation schema)
```
