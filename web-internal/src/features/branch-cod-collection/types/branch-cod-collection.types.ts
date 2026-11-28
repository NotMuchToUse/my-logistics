import type { UserBranchScope } from "@/types/rbac.types";

// Các kiểu này chỉ phục vụ UI demo, không phải contract Backend.
// Giá trị và kết quả phép tính phải được kiểm tra là số nguyên an toàn tại runtime.
export type DemoVnd = number & { readonly __demoSafeVnd: unique symbol };

export type DemoBranchScope = Pick<
  UserBranchScope,
  "scope_type" | "branch_id" | "warehouse_id"
>;

export type DemoCodTransactionStatus = "driver_holding" | "collected_by_branch";
export type DemoCollectionStatus = "draft" | "locked" | "cancelled";

export interface DemoDriver {
  id: string;
  name: string;
  branchId: number;
}

export interface DemoCodTransaction {
  id: string;
  status: DemoCodTransactionStatus;
}

export interface DemoDebtShipment {
  shipmentId: string;
  barcode: string;
  codTransactions: readonly DemoCodTransaction[];
  codAmount: DemoVnd;
  freightAmount: DemoVnd;
  // Giá trị demo từ fixture, không suy ra từ COD và cước.
  amountDue: DemoVnd;
}

export interface DemoDriverDebt {
  driver: DemoDriver;
  scope: DemoBranchScope;
  shipments: readonly DemoDebtShipment[];
  totalDebt: DemoVnd;
}

export type DemoCollectionItem = DemoDebtShipment;

interface DemoCollectionBase {
  id: string;
  driverId: string;
  branchId: number;
  scope: DemoBranchScope;
  items: readonly DemoCollectionItem[];
  totalAmount: DemoVnd;
}

export type DemoCashCollection =
  | (DemoCollectionBase & { status: "draft" })
  | (DemoCollectionBase & { status: "locked" })
  | (DemoCollectionBase & { status: "cancelled" });

export type DemoScanResult =
  | { type: "added"; item: DemoCollectionItem }
  | { type: "invalid" }
  | { type: "not_found" }
  | { type: "duplicate" }
  | { type: "wrong_driver" }
  | { type: "wrong_branch" }
  | { type: "already_in_collection" }
  | { type: "not_driver_holding" }
  | { type: "collection_not_draft" }
  | { type: "mock_unavailable" };
