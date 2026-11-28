import type {
  WarehouseAuditResult,
} from "../types/warehouse-audit.types";

export const AUDIT_RESULT_LABELS: Record<WarehouseAuditResult, string> = {
  pending: "Chưa quét",
  matched: "Khớp",
  missing: "Thiếu",
  misrouted: "Sai kho",
  overdue_storage: "Quá hạn lưu",
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  in_warehouse: "Đang lưu kho",
  delivery_failed: "Giao không thành công",
  pending_return: "Chờ hoàn",
  returning: "Đang hoàn",
};

export const WAREHOUSE_OPTIONS = [
  { id: 1, name: "Kho trung tâm Hà Nội" },
  { id: 2, name: "Kho trung chuyển Đà Nẵng" },
] as const;
