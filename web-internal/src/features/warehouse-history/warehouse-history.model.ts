import { z } from "zod";

export const RECEIPT_TYPES = { inbound: "Nhập kho", outbound_linehaul: "Xuất kho trung chuyển", outbound_delivery: "Xuất kho giao hàng" } as const;
export const RECEIPT_STATUSES = { draft: "Nháp", confirmed: "Đã chốt", unlocked: "Đã mở khóa", handed_over: "Đã bàn giao", cancelled: "Đã hủy" } as const;
export const unlockSchema = z.object({ unlock_reason: z.string().trim().min(1, "Vui lòng nhập lý do mở khóa.").max(500, "Lý do tối đa 500 ký tự."), version: z.number().int().positive() });
export const publicIdSchema = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
export interface ReceiptItem {
  tracking_code: string | null;
  seal_number?: string | null;
  scanned_at: string | null;
  inbound_source_type: string | null;
  is_wrong_route: number | boolean;
  removed_at: string | null;
}
// Presentation model: demo enrichments are never sent as API fields.
export interface Receipt {
  public_id: string;
  receipt_code: string;
  receipt_type: keyof typeof RECEIPT_TYPES;
  status: keyof typeof RECEIPT_STATUSES;
  warehouse_id: number;
  warehouse_name: string | null;
  total_shipments: number;
  total_bags: number;
  total_weight_gram: number;
  version: number;
  created_at: string | null;
  updated_at: string | null;
  confirmed_at: string | null;
  confirmed_by_name?: string | null;
  branch_name?: string | null;
  note: string | null;
  items?: ReceiptItem[];
  demo?: { branch_id: number; target_warehouse_name: string | null; driver_name: string | null; handed_over_at: string | null; unlocked_at: string | null; unlock_reason: string | null };
}
export interface HistoryContext {
  authenticated: boolean;
  can_read: boolean;
  roles: readonly string[];
  branch_id: number | null;
  warehouse_id: number | null;
  demo_scope: boolean;
  unlock_capability: boolean;
  scope_type?: "hq_all" | "branch" | "post_office" | "warehouse" | "region_center";
}
export interface HistoryFilters { branch_id?: string; receipt_code: string; status: string; receipt_type: string; warehouse_id: string; from: string; to: string; page: number; per_page: number }
export const INITIAL_FILTERS: HistoryFilters = { branch_id: "", receipt_code: "", status: "", receipt_type: "", warehouse_id: "", from: "", to: "", page: 1, per_page: 20 };
export const historyFiltersSchema = z.object({
  receipt_code: z.string().trim(),
  status: z.union([z.literal(""), z.enum(["draft", "confirmed", "unlocked", "handed_over", "cancelled"])]),
  receipt_type: z.union([z.literal(""), z.enum(["inbound", "outbound_linehaul", "outbound_delivery"])]),
  warehouse_id: z.string().regex(/^$|^[1-9]\d*$/),
  branch_id: z.string().regex(/^$|^[1-9]\d*$/).optional(),
  from: z.union([z.literal(""), z.iso.date()]),
  to: z.union([z.literal(""), z.iso.date()]),
  page: z.number().int().positive(),
  per_page: z.number().int().min(1).max(100),
}).refine((f) => !f.from || !f.to || f.from <= f.to, { message: "Ngày kết thúc phải từ ngày bắt đầu trở đi.", path: ["to"] });
export interface ReceiptPage { data: Receipt[]; meta: { pagination: { page: number; per_page: number; total: number; total_pages: number } } }
export function isHqHistory(c: HistoryContext) {
  return c.scope_type === "hq_all" && c.branch_id === null && c.warehouse_id === null;
}
export function hasHistoryScope(c: HistoryContext) {
  return isHqHistory(c) || (c.scope_type !== "hq_all" && Number.isSafeInteger(c.branch_id) && (c.branch_id ?? 0) > 0);
}
export function inDemoScope(r: Receipt, c: HistoryContext) {
  return c.authenticated && c.can_read && c.demo_scope && hasHistoryScope(c) && !!r.demo && (isHqHistory(c) || r.demo.branch_id === c.branch_id) && (c.warehouse_id === null || c.warehouse_id === r.warehouse_id);
}
export function canUnlock(r: Receipt, c: HistoryContext) {
  return inDemoScope(r, c) && !isHqHistory(c) && c.roles.includes("branch_manager") && c.unlock_capability && ["outbound_linehaul", "outbound_delivery"].includes(r.receipt_type) && r.status === "confirmed" && r.demo?.handed_over_at === null && publicIdSchema.safeParse(r.public_id).success && Number.isSafeInteger(r.version) && r.version > 0;
}
export function activeItems(r: Receipt) { return (r.items ?? []).filter((item) => item.removed_at === null); }
export function manifestType(r: Receipt) { return r.receipt_type === "outbound_delivery" ? "delivery_manifest" : r.receipt_type === "outbound_linehaul" ? "outbound_manifest" : null; }
