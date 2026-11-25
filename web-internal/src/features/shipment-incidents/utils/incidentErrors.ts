export class IncidentError extends Error {
  code: string;
  details: Record<string, string[]>;
  constructor(code: string, message: string, details: Record<string, string[]> = {}) {
    super(message); this.code = code; this.details = details;
  }
  get envelope() { return { success: false as const, error: { code: this.code, message: this.message, details: this.details, trace_id: 'ERR-MOCK-INCIDENT' } }; }
}
const MESSAGES: Record<string, string> = {
  '401_UNAUTHORIZED': 'Phiên đăng nhập đã hết hạn.', '403_FORBIDDEN': 'Bạn không có quyền thực hiện thao tác này.',
  '403_BRANCH_SCOPE': 'Phạm vi chưa được hỗ trợ hoặc không thuộc quyền truy cập.', '404_NOT_FOUND': 'Không tìm thấy hồ sơ.',
  '409_VERSION_CONFLICT': 'Dữ liệu vừa được người khác cập nhật. Tải lại hồ sơ trước khi lưu.',
  '409_IDEMPOTENCY_DUPLICATE': 'Lượt gửi đang xử lý hoặc khóa gửi bị trùng. Chỉ thử lại lượt cũ.',
  '429_TOO_MANY_REQUESTS': 'Thao tác quá nhanh. Vui lòng chờ trước khi thử lại.',
  '500_INTERNAL_ERROR': 'Chưa xác định kết quả lưu. Hãy thử lại cùng lượt gửi.',
};
export function incidentError(error: unknown): IncidentError {
  if (error instanceof IncidentError) return error;
  if (typeof error === 'object' && error && 'error' in error) {
    const value = error.error;
    if (typeof value === 'object' && value && 'code' in value && typeof value.code === 'string') {
      const details: Record<string, string[]> = {};
      if ('details' in value && typeof value.details === 'object' && value.details) {
        for (const [field, messages] of Object.entries(value.details)) if (Array.isArray(messages) && messages.every(v => typeof v === 'string')) details[field] = messages;
      }
      return new IncidentError(value.code, MESSAGES[value.code] ?? 'Không thể thực hiện thao tác. Kiểm tra dữ liệu và thử lại.', details);
    }
  }
  return new IncidentError('OUTCOME_UNKNOWN', 'Mất kết nối hoặc chưa xác định kết quả. Thử lại cùng lượt gửi.');
}
