# UI_STYLE_GUIDE.md — Quy chuẩn Giao diện Shadcn Mặc định & Responsive Đa thiết bị (Vietstar Logistics)

> **Tài liệu bắt buộc dành cho mọi AI Coding Assistant (Copilot, Cursor, Windsurf, Cline, Web Chat AI) khi xây dựng UI cho cả 2 repository Frontend (`web-customer` và `web-internal`).**
> Mục tiêu: Giữ giao diện đồng nhất, sạch sẽ theo **hệ thống mặc định của Shadcn UI**, tối ưu tốc độ thao tác nghiệp vụ Logistics và hiển thị chuẩn xác trên **Mobile (`375px`), Tablet (`768px`) và Desktop (`1280px+`)**.

---

## 1. Hệ thống Theme, Màu sắc & Typography (Shadcn UI Default)

1. **Giữ nguyên 100% Theme Mặc định của Shadcn UI**:
   - Sử dụng bộ màu trung tính mặc định của Shadcn UI (**Zinc** hoặc **Slate**, chế độ Light Mode mặc định).
   - **CẤM** tự ý ghi đè các biến CSS gốc trong `index.css` (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--radius`).
   - **CẤM** tự chế bảng màu thương hiệu sặc sỡ hay đổ nền gradient loè loẹt cho nút bấm, card hoặc sidebar.
2. **Quy chuẩn Font chữ & Kích thước (`Typography`)**:
   - Giữ font sans-serif mặc định của Tailwind CSS / Shadcn UI.
   - **Cỡ chữ theo ngữ cảnh sử dụng**:
     - `web-internal` (màn hình vận hành nhiều dữ liệu): Mặc định `text-sm` (`14px`) cho bảng dữ liệu, form nhập liệu, sidebar; tiêu đề trang `text-xl sm:text-2xl font-semibold tracking-tight`.
     - `web-customer` (cổng khách hàng): Nội dung đọc `text-sm sm:text-base` (`14px–16px`); tiêu đề trang `text-2xl sm:text-3xl font-bold tracking-tight`.
   - **Dữ liệu mã & số tiền (Bắt buộc)**:
     - Các mã định danh (`tracking_code`, `public_id`, `seal_code`, `receipt_code`): Bắt buộc dùng class **`font-mono text-xs sm:text-sm font-medium`** để dễ đọc và phân biệt ký tự (`0` vs `O`, `1` vs `I`).
     - Các cột số tiền (`cod_amount`, `total_freight_amount`) và trọng lượng (`chargeable_weight_gram`): Bắt buộc dùng **`tabular-nums text-right`** để thẳng hàng cột dọc.
3. **Khoảng cách & Bo góc (`Spacing & Radius`)**:
   - Giữ nguyên `--radius: 0.5rem` mặc định của Shadcn.
   - Khoảng cách chuẩn: `p-4 sm:p-6` cho khung trang và nội dung `Card`; `gap-4` cho lưới form/card; `gap-2` cho nhóm nút bấm.

---

## 2. Quy chuẩn Icon & Màu Trạng thái Nghiệp vụ (Semantic Badges)

1. **Icon (`lucide-react` 100%)**:
   - Chỉ sử dụng icon từ thư viện `lucide-react`. **CẤM** dùng Emoji (`📦`, `🚚`, `✅`, `⚠️`) hoặc thẻ `<svg>` vẽ tay.
   - Kích thước chuẩn: `h-4 w-4` (`16px`) bên trong `Button`, `Input`, `Badge`, `Table`; `h-5 w-5` (`20px`) trong menu điều hướng `Sidebar` / `Header`.
2. **Màu sắc Trạng thái (`StatusBadge`)**:
   - Chỉ dùng màu ngữ nghĩa nhẹ (`50` background + `700` text + `200` border) cho các nhãn trạng thái nghiệp vụ, tuyệt đối không dùng màu nền đậm chói mắt:

| Nhóm trạng thái (`snake_case`)         | Class Tailwind chuẩn                                | Ví dụ áp dụng                                                                                         |
| :------------------------------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Chờ xử lý / Nháp**                   | `bg-slate-100 text-slate-700 border-slate-200`      | `draft`, `pending`, `pending_pickup`                                                                  |
| **Đang xử lý / Đang luân chuyển**      | `bg-blue-50 text-blue-700 border-blue-200`          | `picked_up`, `in_warehouse`, `bagged`, `in_transit`, `out_for_delivery`, `assigned`, `accepted`       |
| **Thành công / Đã chốt / Đã tất toán** | `bg-emerald-50 text-emerald-700 border-emerald-200` | `delivered`, `locked`, `verified`, `settled_to_customer`, `returned`                                  |
| **Cảnh báo / Chờ duyệt / Giữ tiền**    | `bg-amber-50 text-amber-700 border-amber-200`       | `driver_holding`, `collected_by_branch`, `remitted_to_hq`, `pending_return`, `returning`, `submitted` |
| **Lỗi / Thất bại / Sự cố / Hủy**       | `bg-red-50 text-red-700 border-red-200`             | `delivery_failed`, `pickup_failed`, `incident`, `cancelled`, `rejected`                               |

---

## 3. Quy chuẩn Responsive Bắt buộc (Mobile-First & Multi-Device)

Mọi giao diện sinh ra bắt buộc kiểm tra hiển thị tốt trên cả 3 mốc kích thước: **Mobile (`375px`)**, **Tablet (`768px`)** và **Desktop (`1280px+`)**.

### 3.1. Bố cục Khung Trang & Điều hướng (`Layouts & Navigation`)

- **Web Khách hàng (`web-customer`)**:
  - `PublicLayout`: Trên Desktop (`md:flex`) hiển thị thanh menu ngang; trên Mobile (`< 768px`) ẩn menu ngang và dùng nút Hamburger mở Shadcn **`<Sheet side="left">`** chứa toàn bộ liên kết điều hướng và nút Đăng nhập/Đăng ký.
  - `CustomerLayout`: Trên Desktop (`lg:grid-cols-[240px_1fr]`) hiển thị Sidebar trái; trên Mobile/Tablet (`< 1024px`) chuyển thành thanh tab cuộn ngang (`overflow-x-auto`) hoặc `<Sheet>` để không chiếm diện tích nội dung.
- **Web Nội bộ (`web-internal`)**:
  - `InternalLayout`: Trên Desktop (`lg:pl-64`) cố định `DynamicSidebar` rộng `256px` (`w-64`); trên Tablet/Mobile (`< 1024px`) ẩn Sidebar cố định và mở qua `<Sheet side="left">` từ nút menu trên `Topbar`.
  - `Topbar`: `BranchSwitcher` bắt buộc hiển thị ở mọi kích thước màn hình với độ rộng linh hoạt (`max-w-[170px] sm:max-w-[260px] truncate`) để không đẩy tràn tiêu đề trên màn hình nhỏ.

### 3.2. Lưới Bố cục & Form Nhập liệu (`Grids & Forms`)

- **Cấm chia cột cứng không có fallback Mobile**:
  - Luôn viết theo thứ tự Mobile trước: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (không bao giờ viết `grid-cols-4` đơn lẻ).
- **Thanh nút bấm hành động của Form (`Form Footer`)**:
  - Trên Mobile xếp dọc đảo ngược để nút Chính nằm trên cùng và bấm dễ bằng ngón cái; trên Desktop xếp ngang căn phải:
    ```tsx
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
      <Button className="w-full sm:w-auto" type="button" variant="outline">
        Hủy
      </Button>
      <Button className="w-full sm:w-auto" type="submit">
        Lưu thông tin
      </Button>
    </div>
    ```
- **Chống zoom tự động trên Mobile Safari**:
  - Input dùng `text-base sm:text-sm` (`16px` trên mobile, `14px` trên desktop).

### 3.3. Bảng Dữ liệu Lớn (`Data Tables`)

- **Bắt buộc bọc cuộn ngang cho mọi `<Table>`**:
  - Không bao giờ đặt `<Table>` trần trực tiếp ra ngoài khiến vỡ khung trang trên Mobile/Tablet. Luôn bọc trong container chuẩn:
    ```tsx
    <div className="w-full overflow-x-auto rounded-md border">
      <Table>
        {/* Các cột quan trọng như tracking_code, số tiền, nút hành động phải thêm className="whitespace-nowrap" */}
      </Table>
    </div>
    ```
- **Chế độ hiển thị kép trên `web-customer` (`my-shipments`, `address-book`)**:
  - Khuyến khích hiển thị dạng danh sách `Card` gọn gàng trên Mobile (`block md:hidden`) và dạng `<Table>` đầy đủ cột trên Tablet/Desktop (`hidden md:block`).

### 3.4. Hộp thoại & Ngăn kéo (`Dialog & Sheet`)

- Mọi `<DialogContent>` bắt buộc giới hạn chiều rộng và chiều cao kèm thanh cuộn dọc để form dài không bị cắt mất nút Lưu trên màn hình laptop nhỏ hoặc điện thoại:
  ```tsx
  <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
  ```

---

## 4. Mẫu Cấu trúc Trang Chuẩn (Standard Page Skeleton)

Mọi trang danh sách/nghiệp vụ trên cả 2 Web phải tuân theo cấu trúc 3 khối dọc thống nhất (`space-y-6`):

1. **Page Header**:
   ```tsx
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
     <div>
       <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
         Tiêu đề trang
       </h1>
       <p className="text-sm text-muted-foreground">
         Mô tả ngắn gọn chức năng trang
       </p>
     </div>
     <div className="flex flex-wrap items-center gap-2">
       {/* Các nút hành động chính: Tạo mới, Xuất CSV... */}
     </div>
   </div>
   ```
2. **Filter & Search Bar** (nằm trong `<Card className="p-4">`):
   - Dùng `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3` cho ô tìm kiếm mã vận đơn/SĐT, select trạng thái, khoảng ngày.
3. **Content Area (Loading -> Empty -> Data)**:
   - Khi `isLoading === true`: Hiển thị Shadcn `<Skeleton />` khớp chiều cao bảng/card (cấm chỉ hiện chữ `"Loading..."` trần).
   - Khi `data.length === 0`: Hiển thị `<EmptyState />` kèm icon Lucide, thông báo rõ ràng và nút xóa bộ lọc / tạo mới.
   - Khi có dữ liệu: Hiển thị bảng/card kèm thanh phân trang Responsive (`flex flex-col sm:flex-row items-center justify-between gap-4 pt-4`).
