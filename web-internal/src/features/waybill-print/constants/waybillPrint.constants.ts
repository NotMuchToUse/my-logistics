export const PRINT_DOCUMENT_TYPES = ["waybill_a4", "waybill_label", "barcode_sticker"] as const;
export const TRACKING_RANGE_STATUSES = ["active", "exhausted", "inactive"] as const;

export const PRINT_DOCUMENT_LABELS = {
  waybill_a4: "Phiếu gửi A4",
  waybill_label: "Tem vận đơn",
  barcode_sticker: "Tem barcode kiện",
} as const;

export const TRACKING_RANGE_STATUS_LABELS = {
  active: "Đang hoạt động",
  exhausted: "Đã hết mã",
  inactive: "Ngừng hoạt động",
} as const;

export const PRINT_SIZES = {
  waybill_a4: { widthMm: 210, heightMm: 297, requiresApproval: false },
  waybill_label: { widthMm: 100, heightMm: 150, requiresApproval: true },
  barcode_sticker: { widthMm: 70, heightMm: 50, requiresApproval: true },
} as const;

export const MAX_UINT64 = 18446744073709551615n;
