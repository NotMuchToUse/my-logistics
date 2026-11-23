# ARCHITECTURE.md — Kiến trúc Feature-Based (`vietstar-web-customer`)

> Cổng dịch vụ khách hàng của hệ thống **Logistics Vietstar** phục vụ **Khách vãng lai (Public)**, **Khách hàng cá nhân (`customer_individual`)** và **Khách hàng doanh nghiệp trả sau (`customer_corporate`)**.
> Xây dựng bằng **ReactJS (100% Functional Components & Hooks) + Tailwind CSS + Shadcn UI + Lucide Icons**.

---

## 1. Luồng Trải nghiệm & Phân tách Layout

1. **Public Layout (`src/layouts/PublicLayout.jsx`)**:
   - Dành cho mọi khách truy cập (không bắt buộc đăng nhập): Trang chủ giới thiệu dịch vụ, Tra cứu hành trình vận đơn công khai (`tracking`), Tìm kiếm bưu cục/chi nhánh trên bản đồ (`branch-locator`) và Ước tính cước phí vận chuyển (`rate-calculator`).
2. **Customer Workspace Layout (`src/layouts/CustomerLayout.jsx`)**:
   - Dành cho khách hàng đã đăng nhập (`ProtectedRoute`): Quản lý Sổ địa chỉ gửi/nhận (`address-book`), Tạo yêu cầu gửi hàng lấy tận nhà hoặc mang ra bưu cục (`pickup-create`), và Theo dõi lịch sử vận đơn / hủy yêu cầu chưa lấy (`my-shipments`).

---

## 2. Cây Thư mục Feature-Based Chuẩn (`vietstar-web-customer`)

```text
vietstar-web-customer/
├── public/
│   └── favicon.ico
├── src/
│   ├── core/
│   │   ├── api/
│   │   │   └── axiosClient.js              # Axios instance gắn X-Client-Type: 'web_public', Bearer Token, Idempotency-Key
│   │   ├── stores/
│   │   │   └── useCustomerAuthStore.js     # Lưu phiên đăng nhập khách hàng (user, customer profile, token)
│   │   ├── guards/
│   │   │   └── ProtectedRoute.jsx          # Yêu cầu đăng nhập trước khi vào Sổ địa chỉ / Tạo đơn / Lịch sử đơn
│   │   ├── router/
│   │   │   └── AppRouter.jsx               # Cấu hình React Router v6 cho Public & Customer routes
│   │   └── utils/
│   │       └── formatters.js               # Định dạng tiền VND, trọng lượng gram/kg, khoảng cách km
│   ├── components/
│   │   ├── ui/                             # Bộ Shadcn UI gốc (Button, Input, Card, Table, Dialog, Badge, Select...)
│   │   └── shared/                         # Component dùng chung (StatusBadge, EmptyState, ConfirmDialog)
│   ├── layouts/
│   │   ├── PublicLayout.jsx                # Header điều hướng công khai + Nút Đăng nhập/Đăng ký + Footer Vietstar
│   │   └── CustomerLayout.jsx              # Layout khu vực khách hàng thành viên (Sidebar điều hướng + Outlet)
│   ├── mocks/                              # Dữ liệu JSON giả lập chuẩn AI_SYNC_CONTRACT.md (chạy khi VITE_USE_MOCK=true)
│   │   ├── auth.mock.json
│   │   ├── tracking.mock.json
│   │   ├── branches.mock.json
│   │   ├── rateCalculator.mock.json
│   │   ├── addressBook.mock.json
│   │   └── customerShipments.mock.json
│   ├── features/                           # 7 MODULE NGHIỆP VỤ KHÁCH HÀNG CÔ LẬP HOÀN TOÀN
│   │   ├── auth/                           # Đăng ký (kèm checkbox đồng ý NĐ 13/2023), Đăng nhập, Quên mật khẩu
│   │   ├── tracking/                       # Tra cứu trạng thái nhiều mã vận đơn & Timeline hành trình công khai
│   │   ├── branch-locator/                 # Tìm kiếm vị trí Bưu cục/Chi nhánh theo Tỉnh/Huyện, Bản đồ & Chỉ đường
│   │   ├── rate-calculator/                # Ước tính cước phí vận chuyển (Trọng lượng thực & Quy đổi DxRxC)
│   │   ├── address-book/                   # Quản lý Sổ địa chỉ gửi/nhận 3 cấp Tỉnh -> Huyện -> Xã (customer_addresses)
│   │   ├── pickup-create/                  # Tạo yêu cầu gửi hàng (Lấy tận nhà driver_pickup hoặc Mang ra quầy counter_dropoff)
│   │   └── my-shipments/                   # Lịch sử vận đơn & yêu cầu lấy hàng của tôi, Chi tiết & Hủy đơn chưa lấy
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
├── constants/      # <feature>.constants.js (Nhãn trạng thái công khai, bước quy trình)
├── hooks/          # use<Feature>.js (Quản lý state & gọi API)
├── pages/          # <Feature>Page.jsx (Trang chính gắn vào Router)
└── schemas/        # <feature>.schema.js (Zod validation schema)
```
