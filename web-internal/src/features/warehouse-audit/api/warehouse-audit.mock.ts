import type {
  CreateWarehouseStockAuditInput,
  UpdateWarehouseStockAuditInput,
  WarehouseStockAudit,
  WarehouseStockItem,
} from "../types/warehouse-audit.types";

const DAY = 24 * 60 * 60 * 1000;

function makeInventory(): WarehouseStockItem[] {
  const now = Date.now();
  return [
    {
      shipment_id: 501,
      tracking_code: "VN-AUDIT-0001",
      shipment_status: "in_warehouse",
      storage_deadline: new Date(now - DAY).toISOString(),
      expected_warehouse_id: 1,
      expected_warehouse_name: "Kho trung tâm Hà Nội",
      audit_result: "pending",
      scanned_at: null,
      scanned_warehouse_id: null,
    },
    {
      shipment_id: 502,
      tracking_code: "VN-AUDIT-0002",
      shipment_status: "in_warehouse",
      storage_deadline: new Date(now + DAY / 2).toISOString(),
      expected_warehouse_id: 1,
      expected_warehouse_name: "Kho trung tâm Hà Nội",
      audit_result: "pending",
      scanned_at: null,
      scanned_warehouse_id: null,
    },
    {
      shipment_id: 503,
      tracking_code: "VN-AUDIT-0003",
      shipment_status: "delivery_failed",
      storage_deadline: new Date(now + 2 * DAY).toISOString(),
      expected_warehouse_id: 1,
      expected_warehouse_name: "Kho trung tâm Hà Nội",
      audit_result: "pending",
      scanned_at: null,
      scanned_warehouse_id: null,
    },
    {
      shipment_id: 504,
      tracking_code: "VN-AUDIT-0004",
      shipment_status: "pending_return",
      storage_deadline: new Date(now + 5 * DAY).toISOString(),
      expected_warehouse_id: 1,
      expected_warehouse_name: "Kho trung tâm Hà Nội",
      audit_result: "pending",
      scanned_at: null,
      scanned_warehouse_id: null,
    },
    {
      shipment_id: 505,
      tracking_code: "VN-AUDIT-0005",
      shipment_status: "in_warehouse",
      storage_deadline: null,
      expected_warehouse_id: 1,
      expected_warehouse_name: "Kho trung tâm Hà Nội",
      audit_result: "pending",
      scanned_at: null,
      scanned_warehouse_id: null,
    },
  ];
}

function createSeedAudit(): WarehouseStockAudit {
  return {
    id: 1,
    audit_code: "KK-2026-001",
    warehouse_id: 1,
    warehouse_name: "Kho trung tâm Hà Nội",
    status: "open",
    opened_at: new Date().toISOString(),
    completed_at: null,
    items: makeInventory(),
    return_proposals: [],
  };
}

let audits: WarehouseStockAudit[] = [createSeedAudit()];
let nextAuditId = 2;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const warehouseAuditMock = {
  list(): WarehouseStockAudit[] {
    return clone(audits);
  },

  detail(id: number): WarehouseStockAudit {
    const audit = audits.find((item) => item.id === id);
    if (!audit) throw new Error(`Không tìm thấy phiên kiểm kê ${id}.`);
    return clone(audit);
  },

  create(input: CreateWarehouseStockAuditInput): WarehouseStockAudit {
    const warehouseName =
      input.warehouse_id === 2
        ? "Kho trung chuyển Đà Nẵng"
        : "Kho trung tâm Hà Nội";
    const id = nextAuditId++;
    const audit: WarehouseStockAudit = {
      id,
      audit_code: `KK-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`,
      warehouse_id: input.warehouse_id,
      warehouse_name: warehouseName,
      status: "open",
      opened_at: new Date().toISOString(),
      completed_at: null,
      items: makeInventory().map((item) => ({
        ...item,
        expected_warehouse_id: input.warehouse_id,
        expected_warehouse_name: warehouseName,
      })),
      return_proposals: [],
    };
    audits = [audit, ...audits];
    return clone(audit);
  },

  update(id: number, input: UpdateWarehouseStockAuditInput): WarehouseStockAudit {
    const index = audits.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`Không tìm thấy phiên kiểm kê ${id}.`);
    audits[index] = { ...audits[index], ...clone(input) };
    return clone(audits[index]);
  },

  remove(id: number): void {
    const index = audits.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`Không tìm thấy phiên kiểm kê ${id}.`);
    audits = audits.filter((item) => item.id !== id);
  },
};
