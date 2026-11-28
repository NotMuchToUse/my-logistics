import { AUDIT_RESULT_LABELS, SHIPMENT_STATUS_LABELS } from "../constants/warehouse-audit.constants";
import type {
  WarehouseAuditResult,
  WarehouseStockAudit,
  WarehouseStockItem,
} from "../types/warehouse-audit.types";

export type StorageDeadlineBucket =
  | "overdue"
  | "within_24_hours"
  | "within_3_days"
  | "over_3_days"
  | "no_deadline";

export const STORAGE_DEADLINE_BUCKET_LABELS: Record<StorageDeadlineBucket, string> = {
  overdue: "Đã quá hạn",
  within_24_hours: "Trong 24 giờ",
  within_3_days: "1–3 ngày",
  over_3_days: "Trên 3 ngày",
  no_deadline: "Không có hạn",
};

export function getStorageDeadlineBucket(
  deadline: string | null,
  now = new Date(),
): StorageDeadlineBucket {
  if (!deadline || !Number.isFinite(Date.parse(deadline))) return "no_deadline";
  const remaining = Date.parse(deadline) - now.getTime();
  if (remaining < 0) return "overdue";
  if (remaining <= 24 * 60 * 60 * 1000) return "within_24_hours";
  if (remaining <= 3 * 24 * 60 * 60 * 1000) return "within_3_days";
  return "over_3_days";
}

export function getAuditResult(item: WarehouseStockItem): WarehouseAuditResult {
  return item.audit_result;
}

export function scanStockItem(
  audit: WarehouseStockAudit,
  barcode: string,
  scannedWarehouseId: number,
  now = new Date(),
): WarehouseStockAudit {
  const normalizedBarcode = barcode.trim().toUpperCase();
  if (!normalizedBarcode) throw new Error("Vui lòng nhập hoặc quét mã vận đơn.");
  if (audit.status !== "open") throw new Error("Phiên kiểm kê đã kết thúc.");

  const itemIndex = audit.items.findIndex(
    (item) => item.tracking_code.toUpperCase() === normalizedBarcode,
  );
  if (itemIndex < 0) throw new Error(`Không tìm thấy vận đơn ${normalizedBarcode} trong danh sách kiểm kê.`);
  if (audit.items[itemIndex].audit_result !== "pending") {
    throw new Error(`Vận đơn ${normalizedBarcode} đã được đối chiếu.`);
  }

  const item = audit.items[itemIndex];
  const isOverdue = getStorageDeadlineBucket(item.storage_deadline, now) === "overdue";
  const auditResult: WarehouseAuditResult = isOverdue
    ? "overdue_storage"
    : item.expected_warehouse_id !== scannedWarehouseId
      ? "misrouted"
      : "matched";

  return {
    ...audit,
    items: audit.items.map((row, index) =>
      index === itemIndex
        ? {
            ...row,
            audit_result: auditResult,
            scanned_at: now.toISOString(),
            scanned_warehouse_id: scannedWarehouseId,
          }
        : row,
    ),
  };
}

export function getAuditStatistics(audit: WarehouseStockAudit, now = new Date()) {
  const auditResults = Object.fromEntries(
    (Object.keys(AUDIT_RESULT_LABELS) as WarehouseAuditResult[]).map((result) => [
      result,
      audit.items.filter((item) => item.audit_result === result).length,
    ]),
  ) as Record<WarehouseAuditResult, number>;

  const deadlines = Object.fromEntries(
    (Object.keys(STORAGE_DEADLINE_BUCKET_LABELS) as StorageDeadlineBucket[]).map((bucket) => [
      bucket,
      audit.items.filter(
        (item) => getStorageDeadlineBucket(item.storage_deadline, now) === bucket,
      ).length,
    ]),
  ) as Record<StorageDeadlineBucket, number>;

  const shipmentStatuses = audit.items.reduce<Record<string, number>>((counts, item) => {
    counts[item.shipment_status] = (counts[item.shipment_status] ?? 0) + 1;
    return counts;
  }, {});

  return { auditResults, deadlines, shipmentStatuses };
}

export function getShipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABELS[status] ?? status;
}

function csvCell(value: string): string {
  const safeValue = /^\s*[=+\-@]/.test(value)
    ? `'${value}`
    : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function warehouseAuditToCsv(audit: WarehouseStockAudit): string {
  const headers = [
    "Mã vận đơn",
    "Trạng thái vận đơn",
    "Kết quả kiểm kê",
    "Hạn lưu kho",
    "Kho dự kiến",
    "Kho quét",
    "Thời điểm quét",
  ];
  const rows = audit.items.map((item) => [
    item.tracking_code,
    getShipmentStatusLabel(item.shipment_status),
    AUDIT_RESULT_LABELS[item.audit_result],
    item.storage_deadline ?? "",
    item.expected_warehouse_name,
    item.scanned_warehouse_id === null ? "" : String(item.scanned_warehouse_id),
    item.scanned_at ?? "",
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
