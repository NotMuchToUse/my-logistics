import { describe, expect, it } from "vitest";
import type { WarehouseStockAudit } from "../types/warehouse-audit.types";
import {
  getAuditStatistics,
  getStorageDeadlineBucket,
  scanStockItem,
  warehouseAuditToCsv,
} from "./warehouse-audit.utils";

const now = new Date("2026-11-28T00:00:00.000Z");

function createAudit(): WarehouseStockAudit {
  return {
    id: 1,
    audit_code: "KK-001",
    warehouse_id: 1,
    warehouse_name: "Kho trung tâm Hà Nội",
    status: "open",
    opened_at: now.toISOString(),
    completed_at: null,
    return_proposals: [],
    items: [
      {
        shipment_id: 1,
        tracking_code: "AUDIT-OVERDUE",
        shipment_status: "in_warehouse",
        storage_deadline: "2026-11-27T23:59:59.000Z",
        expected_warehouse_id: 1,
        expected_warehouse_name: "Kho trung tâm Hà Nội",
        audit_result: "pending",
        scanned_at: null,
        scanned_warehouse_id: null,
      },
      {
        shipment_id: 2,
        tracking_code: "AUDIT-REGULAR",
        shipment_status: "delivery_failed",
        storage_deadline: "2026-11-29T00:00:00.000Z",
        expected_warehouse_id: 1,
        expected_warehouse_name: "Kho trung tâm Hà Nội",
        audit_result: "pending",
        scanned_at: null,
        scanned_warehouse_id: null,
      },
    ],
  };
}

describe("warehouse audit utilities", () => {
  it("groups storage deadlines, including expired and missing dates", () => {
    expect(getStorageDeadlineBucket("2026-11-27T23:59:59.000Z", now)).toBe("overdue");
    expect(getStorageDeadlineBucket("2026-11-29T00:00:00.000Z", now)).toBe("within_24_hours");
    expect(getStorageDeadlineBucket(null, now)).toBe("no_deadline");
    expect(getStorageDeadlineBucket("invalid", now)).toBe("no_deadline");
  });

  it("classifies a scan by overdue deadline before checking the scanned warehouse", () => {
    const audit = createAudit();
    const overdueScan = scanStockItem(audit, " audit-overdue ", 2, now);
    const misroutedScan = scanStockItem(audit, "AUDIT-REGULAR", 2, now);
    expect(overdueScan.items[0].audit_result).toBe("overdue_storage");
    expect(misroutedScan.items[1].audit_result).toBe("misrouted");
    expect(audit.items[0].audit_result).toBe("pending");
  });

  it("counts inventory statuses and exports a UTF-8 BOM CSV", () => {
    const audit = createAudit();
    const stats = getAuditStatistics(audit, now);
    const csv = warehouseAuditToCsv(audit);
    expect(stats.deadlines.overdue).toBe(1);
    expect(stats.deadlines.within_24_hours).toBe(1);
    expect(stats.shipmentStatuses.in_warehouse).toBe(1);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"AUDIT-OVERDUE"');
  });
});
