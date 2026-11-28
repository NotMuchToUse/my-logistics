import type { ShipmentStatus } from "@/types/api.types";

export type WarehouseAuditResult =
  | "pending"
  | "matched"
  | "missing"
  | "misrouted"
  | "overdue_storage";

export type WarehouseAuditStatus = "open" | "completed";

export interface WarehouseStockItem {
  shipment_id: number;
  tracking_code: string;
  shipment_status: ShipmentStatus;
  storage_deadline: string | null;
  expected_warehouse_id: number;
  expected_warehouse_name: string;
  audit_result: WarehouseAuditResult;
  scanned_at: string | null;
  scanned_warehouse_id: number | null;
}

export interface WarehouseReturnProposal {
  shipment_id: number;
  tracking_code: string;
  reason: string;
  proposed_at: string;
  status: "pending_review";
}

export interface WarehouseStockAudit {
  id: number;
  audit_code: string;
  warehouse_id: number;
  warehouse_name: string;
  status: WarehouseAuditStatus;
  opened_at: string;
  completed_at: string | null;
  items: WarehouseStockItem[];
  return_proposals: WarehouseReturnProposal[];
}

export interface CreateWarehouseStockAuditInput {
  warehouse_id: number;
}

export type UpdateWarehouseStockAuditInput = Partial<
  Pick<
    WarehouseStockAudit,
    "status" | "completed_at" | "items" | "return_proposals"
  >
>;
