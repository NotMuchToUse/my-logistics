# AI_RULES.md — Quy tắc Lập trình Frontend ReactJS (`vietstar-web-internal` & `vietstar-web-customer`)

> **Tài liệu bắt buộc dành cho mọi AI Coding Assistant (Cursor, Windsurf, Cline, Claude Code, Copilot, Web Chat AI) làm việc trên 2 repository Frontend của hệ thống Logistics Vietstar.**
> Luôn đối chiếu đồng thời với 2 tài liệu gốc ở thư mục root: `AI_SYNC_CONTRACT.md` và `PROJECT_CONTEXT.md`.

---

## 1. Công nghệ Bắt buộc & Quy tắc Đặt tên (Naming Conventions)

1. **Stack chuẩn**:
   - **ReactJS** (`100% Functional Components & Hooks` — cấm dùng Class Component).
   - **Tailwind CSS** + **Shadcn UI** (`src/components/ui/*`).
   - **Icons**: Chỉ dùng thư viện **`lucide-react`**. Tuyệt đối **cấm dùng Emoji** (`🚚`, `📦`, `✅`...) hoặc thẻ `<svg>` vẽ tay cho icon giao diện.
   - **Validation**: Bắt buộc dùng **Zod** + `react-hook-form`.
2. **Quy tắc đặt tên file & biến**:
   - **Component & Page**: `PascalCase.jsx` hoặc `PascalCase.tsx` (VD: `ShipmentCreatePage.jsx`, `ParcelRowItem.jsx`).
   - **Custom Hook**: `useTenHook.js` hoặc `useTenHook.ts` (VD: `useShipmentCreate.js`, `useBranchScope.js`).
   - **API Service**: `tenModule.api.js` hoặc `tenModule.api.ts` (VD: `shipment.api.js`, `warehouse.api.js`).
   - **Schema & Constants**: `tenModule.schema.js`, `tenModule.constants.js`.
   - **Hằng số (Constants)**: `UPPER_SNAKE_CASE` (VD: `SHIPMENT_STATUS_BADGES`, `DEFAULT_PAGE_SIZE = 20`).
   - **Biến & Hàm nội bộ React**: `camelCase` (`isSubmitting`, `handleSelectBranch`).
   - **Key JSON gửi/nhận API & Mock Data**: **BẮT BUỘC `snake_case`** khớp 100% cột MySQL 8.0 (`tracking_code`, `origin_branch_id`, `cod_amount`, `version`). **CẤM** tự ý đổi sang `camelCase`.

---

## 2. Quy tắc Kiến trúc Code, Axios & Mock Data (`VITE_USE_MOCK`)

### 2.1. Tách lớp Nghiêm ngặt (Separation of Concerns)

- **CẤM** import `axios` hoặc `fetch` trực tiếp bên trong Component/Page (`*.jsx` / `*.tsx`).
- Mọi gọi mạng phải đi qua file `src/features/<feature>/api/<tenModule>.api.js` và được quản lý state (`data`, `isLoading`, `error`, `refetch`) thông qua Custom Hook `src/features/<feature>/hooks/use<TenHook>.js`.
- **Comment tối giản**: Chỉ viết comment đánh dấu phân vùng UI lớn (VD: `{/* Bộ lọc tìm kiếm */}`) hoặc JSDoc mô tả tham số đầu vào/đầu ra của hàm phức tạp. Cấm comment giải thích từng dòng code hiển nhiên.

### 2.2. Chuẩn Axios Instance (`src/core/api/axiosClient.js`)

Mọi request HTTP phải đi qua `axiosClient` cấu hình sẵn các interceptor sau:

1. **Request Headers bắt buộc**:
   - `Accept: application/json`
   - `X-Client-Type`: `'web_internal'` (trên `vietstar-web-internal`) hoặc `'web_public'` (trên `vietstar-web-customer`).
   - `Authorization: Bearer <plain_token>` (tự động gắn từ `authStore` nếu người dùng đã đăng nhập).
   - `X-Branch-Id: <current_branch_id>` (**Bắt buộc trên `vietstar-web-internal`** lấy từ Branch Switcher context).
   - `Idempotency-Key: <crypto.randomUUID()>` (**Bắt buộc** với các request `POST`/`PATCH` tạo đơn, chốt phiếu kho, thu/nộp tiền COD, duyệt đền bù).
2. **Response & Error Interceptor chuẩn**:
   - `401_UNAUTHORIZED`: Tự động xóa token/session cục bộ và điều hướng về `/login`.
   - `403_BRANCH_SCOPE` / `403_FORBIDDEN`: Hiển thị Toast thông báo không có quyền hoặc sai phạm vi chi nhánh.
   - `409_VERSION_CONFLICT`: Hiển thị cảnh báo _"Dữ liệu vừa được người khác cập nhật, vui lòng tải lại"_ và kích hoạt `refetch()`.
   - `422_VALIDATION_ERROR`: Trả về `error.details` để map trực tiếp vào `form.setError()` của `react-hook-form`.

### 2.3. Công tắc Chạy Độc Lập với Mock Data (`VITE_USE_MOCK`)

Để Frontend chạy và kiểm thử độc lập 100% mà không phải chờ Backend xong API, mọi hàm trong `<tenModule>.api.js` bắt buộc viết theo mẫu chuyển mạch sau:

```javascript
import axiosClient from "@/core/api/axiosClient";
import shipmentMock from "@/mocks/shipment.mock.json";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

/**
 * Lấy danh sách vận đơn có phân trang và bộ lọc.
 * @param {Object} params - Tham số lọc (page, per_page, status, tracking_code...)
 * @returns {Promise<Object>} Pagination JSON Envelope chuẩn AI_SYNC_CONTRACT.md
 */
export async function fetchShipmentsApi(params = {}) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return shipmentMock.list_response;
  }
  const response = await axiosClient.get("/api/v1/shipments", { params });
  return response.data;
}
```

- Toàn bộ file JSON giả lập trong `src/mocks/*.mock.json` **BẮT BUỘC** bọc đúng 3 định dạng `Success JSON`, `Pagination JSON`, `Error JSON` của `AI_SYNC_CONTRACT.md`.

---

## 3. Luật Chống AI Bịa Đặt & Cấm Cắt Ngang Code

1. **Cấm tự bịa (Zero Hallucination)**:
   - **CẤM** tự bịa tên field JSON, đường dẫn endpoint hoặc giá trị `ENUM` (`status`) ngoài `AI_SYNC_CONTRACT.md` và `PROJECT_CONTEXT.md`.
   - **CẤM** tự ý sửa các file trong `src/core/`, `src/layouts/` hoặc feature của thành viên khác khi chưa thống nhất với Leader (`Khang`).
   - **CẤM** import thư viện ngoài `package.json` nếu chưa được yêu cầu.
2. **Hỏi lại ngay khi thiếu thông tin**:
   - Nếu thiếu cấu trúc payload, thiếu quy tắc hiển thị theo Role hoặc chưa rõ luồng UI, AI **phải dừng lại và hỏi ngắn gọn** trước khi sinh code.
3. **Bắt buộc tự chia nhỏ từng lớp khi code Feature lớn (Không viết tắt / Không cắt ngang)**:
   - Khi được giao xây dựng một feature hoàn chỉnh, AI **KHÔNG ĐƯỢC** xuất dồn toàn bộ code trong 1 lượt trả lời dẫn đến cắt ngang file hoặc viết placeholder `// ... tương tự`.
   - AI bắt buộc chia nhỏ và xuất **100% code đầy đủ, chạy được ngay** lần lượt theo đúng **6 bước** dưới đây, **dừng lại sau mỗi bước** để người dùng xác nhận:
     - **Bước 1 — `Constants & Zod Schemas`**: Tạo `<tenModule>.constants.js` (nhãn trạng thái, màu badge) và `<tenModule>.schema.js` (validate form bằng Zod).
     - **Bước 2 — `Mock Data`**: Tạo dữ liệu mẫu chuẩn envelope JSON trong `src/mocks/<tenModule>.mock.json`.
     - **Bước 3 — `API Service`**: Tạo `api/<tenModule>.api.js` tích hợp `axiosClient` và cờ `VITE_USE_MOCK`.
     - **Bước 4 — `Custom Hook`**: Tạo `hooks/use<TenHook>.js` quản lý state, gọi API, xử lý lỗi chuẩn.
     - **Bước 5 — `Feature Components`**: Tạo các component con trong `components/` (bảng Shadcn DataTable, modal/dialog, bộ lọc).
     - **Bước 6 — `Page & Route`**: Tạo trang chính trong `pages/` ghép nối các component và khai báo route vào router chung.
