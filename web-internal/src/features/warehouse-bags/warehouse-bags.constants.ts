// Nguồn: yêu cầu KHA-38, mục 5.1. Không mô tả quyền chuyển trạng thái.
export const BAG_STATUSES = [
  "open",
  "sealed",
  "in_transit",
  "opened",
  "cancelled",
] as const;

export const BAG_STATUS_LABELS = {
  open: "Đang mở",
  sealed: "Đã niêm phong",
  in_transit: "Đang trung chuyển",
  opened: "Đã mở túi",
  cancelled: "Đã hủy",
} as const satisfies Record<(typeof BAG_STATUSES)[number], string>;

export const BAG_STATUS_BADGE_CLASSES = {
  open: "bg-slate-100 text-slate-700",
  sealed: "bg-blue-50 text-blue-700",
  in_transit: "bg-amber-50 text-amber-700",
  opened: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
} as const satisfies Record<(typeof BAG_STATUSES)[number], string>;

export const SEAL_NUMBER_MAX_LENGTH = 40;
export const BAG_CODE_MAX_LENGTH = 35;
