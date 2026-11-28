import { HISTORY_BRANCHES, HISTORY_WAREHOUSES } from "../warehouse-history.mock-network";
import { canUnlock, historyFiltersSchema, inDemoScope, isHqHistory, unlockSchema, type Receipt, type HistoryContext, type HistoryFilters } from "../warehouse-history.model";

// Isolated synthetic fixtures; warehouse-to-branch relationships are demo-only.
export function createFixtures(): Receipt[] {
  return Array.from({ length: 96 }, (_, index) => {
    const warehouse = HISTORY_WAREHOUSES.find((w) => w.id === (index < 48 ? 2 : index < 72 ? 3 : 1))!;
    const branch = HISTORY_BRANCHES.find((b) => b.id === warehouse.branch_id)!;
    const target = HISTORY_WAREHOUSES.find((w) => w.id !== warehouse.id)!;
    const status = (["confirmed", "draft", "unlocked", "handed_over", "cancelled"] as const)[index % 5];
    return {
      public_id: `01K0000000000000000000${String(index).padStart(4, "0")}`,
      receipt_code: `DEMO-KHO-${String(index + 1).padStart(4, "0")}`,
      receipt_type: (["outbound_delivery", "outbound_linehaul", "inbound"] as const)[index % 3],
      status, warehouse_id: warehouse.id,
      branch_name: branch.name,
      warehouse_name: warehouse.name,
      total_shipments: 2, total_bags: 1, total_weight_gram: 8500,
      version: 3, created_at: `2026-11-28T08:${String(index % 24).padStart(2, "0")}:00+07:00`, updated_at: "2026-11-28T09:00:00+07:00",
      confirmed_at: status === "draft" ? null : "2026-11-28T09:00:00+07:00", note: null,
      demo: { branch_id: branch.id, target_warehouse_name: target.name, driver_name: null, handed_over_at: status === "handed_over" ? "2026-11-28T10:00:00+07:00" : null, unlocked_at: status === "unlocked" ? "2026-11-28T10:00:00+07:00" : null, unlock_reason: status === "unlocked" ? "Điều chỉnh phiếu mẫu" : null },
      items: [
        { tracking_code: "DEMO-VD-001", scanned_at: null, inbound_source_type: "new_pickup", is_wrong_route: false, removed_at: null },
        { tracking_code: "DEMO-VD-002", scanned_at: null, inbound_source_type: "linehaul_in", is_wrong_route: true, removed_at: null },
        { tracking_code: null, seal_number: "DEMO-SEAL-001", scanned_at: null, inbound_source_type: null, is_wrong_route: false, removed_at: null },
        { tracking_code: "DEMO-REMOVED", scanned_at: null, inbound_source_type: null, is_wrong_route: false, removed_at: "2026-11-28T08:30:00+07:00" },
      ],
    };
  });
}
export class HistoryError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export function createHistoryMock(fixtures: Receipt[] = createFixtures()) {
  const rows = structuredClone(fixtures);
  function detail(id: string, c: HistoryContext) {
    const row = rows.find((r) => r.public_id === id);
    if (!row) throw new HistoryError("404_NOT_FOUND", "Không tìm thấy phiếu.");
    if (!inDemoScope(row, c)) throw new HistoryError("403_BRANCH_SCOPE", "Phiếu không thuộc phạm vi mẫu được cấp.");
    return structuredClone(row);
  }
  return {
    detail,
    list(f: HistoryFilters, c: HistoryContext) {
      if (!c.authenticated || !c.can_read) throw new HistoryError("403_FORBIDDEN", "Không có quyền xem lịch sử kho.");
      const validation = historyFiltersSchema.safeParse(f);
      if (!validation.success) throw new HistoryError("422_VALIDATION_ERROR", validation.error.issues[0].message);
      f = validation.data;
      const filtered = rows.filter((r) => inDemoScope(r, c) && (!f.branch_id || Number(f.branch_id) === r.demo?.branch_id) && (!f.receipt_code || r.receipt_code.includes(f.receipt_code.trim().toUpperCase())) && (!f.status || f.status === r.status) && (!f.receipt_type || f.receipt_type === r.receipt_type) && (!f.warehouse_id || Number(f.warehouse_id) === r.warehouse_id) && (!f.from || (r.created_at ?? "").slice(0, 10) >= f.from) && (!f.to || (r.created_at ?? "").slice(0, 10) <= f.to));
      if (isHqHistory(c)) filtered.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      return { success: true, message: "Dữ liệu mô phỏng", data: structuredClone(filtered.slice((f.page - 1) * f.per_page, f.page * f.per_page)), meta: { timestamp: new Date().toISOString(), pagination: { page: f.page, per_page: f.per_page, total: filtered.length, total_pages: Math.ceil(filtered.length / f.per_page) } } };
    },
    unlock(id: string, payload: unknown, c: HistoryContext) {
      const current = detail(id, c);
      if (!c.roles.includes("branch_manager") || !c.unlock_capability) throw new HistoryError("403_FORBIDDEN", "Không có quyền mở khóa.");
      const parsed = unlockSchema.safeParse(payload);
      if (!parsed.success) throw new HistoryError("422_VALIDATION_ERROR", "Lý do hoặc version không hợp lệ.");
      if (parsed.data.version !== current.version) throw new HistoryError("409_VERSION_CONFLICT", "Dữ liệu vừa được cập nhật. Vui lòng tải lại và xác nhận lại.");
      if (!canUnlock(current, c)) throw new HistoryError("422_VALIDATION_ERROR", "Phiếu không đủ điều kiện mở khóa.");
      const row = rows.find((r) => r.public_id === id)!;
      row.status = "unlocked";
      row.version++;
      row.updated_at = new Date().toISOString();
      row.demo!.unlocked_at = row.updated_at;
      row.demo!.unlock_reason = parsed.data.unlock_reason;
      return detail(id, c);
    },
  };
}
