export const MOCK_LOGIN_CREDENTIALS = {
  email: "khachhang@vietstar.test",
  password: "Vietstar123!",
} as const;

export const AUTH_FORM_LABELS = {
  fullName: "Họ và tên",
  email: "Email",
  phone: "Số điện thoại",
  password: "Mật khẩu",
  emailOrPhone: "Email hoặc số điện thoại",
  privacyConsent:
    "Tôi đồng ý với Chính sách bảo mật và việc xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.",
} as const;

export const ND13_CONSENT_TITLE =
  "Thông tin về xử lý dữ liệu cá nhân";

export const ND13_CONSENT_SUMMARY = [
  "Thông tin bạn cung cấp được dùng để tạo và quản lý tài khoản, liên hệ hỗ trợ và cung cấp dịch vụ chuyển phát.",
  "Dữ liệu có thể được xử lý bởi Vietstar và các bên cung cấp dịch vụ liên quan trong phạm vi cần thiết để thực hiện các mục đích đã nêu.",
  "Bạn có quyền được biết, đồng ý hoặc rút lại sự đồng ý, truy cập và yêu cầu chỉnh sửa, xóa, hạn chế xử lý dữ liệu, phản đối việc xử lý và thực hiện các quyền khác theo quy định pháp luật.",
  "Việc đồng ý là tự nguyện. Bạn có thể liên hệ Vietstar để thực hiện quyền của mình; việc rút lại đồng ý có thể ảnh hưởng đến khả năng cung cấp dịch vụ cần dữ liệu đó.",
] as const;
