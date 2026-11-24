import type { PrintCommand, PrintReceipt, TrackingRangeInput, TrackingRangeRecord, WaybillPrintModel, WaybillSession } from "../types/waybillPrint.types";
import { trackingRangeInputSchema, trackingRangeRecordSchema } from "../schemas/trackingRange.schema.ts";
import { rangesIntersect } from "../utils/trackingRange.utils.ts";
import { selectPrintParcels } from "../utils/printSelection.ts";

export class WaybillError extends Error {
  readonly code: string;
  readonly details: Record<string, string[]>;
  constructor(code: string, message: string, details: Record<string, string[]> = {}) {
    super(message); this.code = code; this.details = details;
  }
}

export function assertMockAccess(session: WaybillSession, action: "print" | "ranges") {
  if (!session.authenticated) throw new WaybillError("401_UNAUTHORIZED", "Vui lòng đăng nhập lại.");
  const allowed = action === "ranges" ? session.roles.includes("system_admin") : session.roles.some((role) => role === "receptionist" || role === "coordinator");
  if (!allowed) throw new WaybillError("403_FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  if (session.branchId === null) {
    if (action !== "ranges" || !session.allBranches) throw new WaybillError("403_BRANCH_SCOPE", "Chọn chi nhánh hợp lệ trước khi thao tác.");
    return;
  }
  if (!session.allBranches && !session.allowedBranchIds.includes(session.branchId)) {
    throw new WaybillError("403_BRANCH_SCOPE", "Chọn chi nhánh hợp lệ trước khi thao tác.");
  }
}

/** Session-only simulator. Its policy is explicit and must never be serialized as an HTTP DTO. */
export function createWaybillMock(model: WaybillPrintModel, seed: TrackingRangeRecord[]) {
  const partitions = new Map<string, { ranges: TrackingRangeRecord[]; logCount: number; replay: Map<string, { signature: string; result: unknown }> }>();
  function partition(session: WaybillSession) {
    let state = partitions.get(session.key);
    if (!state) { state = { ranges: structuredClone(seed), logCount: 0, replay: new Map() }; partitions.set(session.key, state); }
    return state;
  }
  function mutate<T>(session: WaybillSession, key: string, signature: string, run: () => T): T {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new WaybillError("400_BAD_REQUEST", "Thiếu khóa thao tác hợp lệ.");
    const state = partition(session);
    const cached = state.replay.get(key);
    if (cached) {
      if (cached.signature !== signature) throw new WaybillError("409_IDEMPOTENCY_DUPLICATE", "Khóa đã dùng cho nội dung khác.");
      return structuredClone(cached.result) as T;
    }
    const result = run();
    state.replay.set(key, { signature, result: structuredClone(result) });
    return result;
  }
  function assertBranch(session: WaybillSession, branch: string | null) {
    if (branch === null && !session.allBranches) throw new WaybillError("403_BRANCH_SCOPE", "Chỉ phạm vi toàn hệ thống mới được quản lý dải dùng chung.");
    if (branch !== null && !session.allBranches && !session.allowedBranchIds.includes(branch)) {
      throw new WaybillError("403_BRANCH_SCOPE", "Chi nhánh không thuộc phạm vi được cấp.");
    }
  }
  return {
    shipment(session: WaybillSession, publicId: string) {
      assertMockAccess(session, "print");
      if (publicId !== model.publicId) throw new WaybillError("404_NOT_FOUND", "Không tìm thấy vận đơn minh họa.");
      return structuredClone(model);
    },
    log(session: WaybillSession, command: PrintCommand, key: string): PrintReceipt {
      assertMockAccess(session, "print");
      selectPrintParcels(model, command);
      return mutate(session, key, JSON.stringify({ action: "print", command }), () => {
        const state = partition(session); state.logCount++;
        return { requestId: `MOCK-PRINT-${state.logCount}`, message: "Đã ghi nhận yêu cầu in minh họa (chưa gửi Backend)." };
      });
    },
    list(session: WaybillSession) {
      assertMockAccess(session, "ranges");
      const visible = partition(session).ranges.filter((row) =>
        session.allBranches || row.branch_id === null || row.branch_id === session.branchId,
      );
      return structuredClone(visible);
    },
    save(session: WaybillSession, input: TrackingRangeInput, id: string | null, key: string) {
      assertMockAccess(session, "ranges");
      const parsed = trackingRangeInputSchema.safeParse(input);
      if (!parsed.success) throw new WaybillError("422_VALIDATION_ERROR", "Kiểm tra dữ liệu dải mã.", Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), [issue.message]])));
      assertBranch(session, input.branch_id);
      return mutate(session, key, JSON.stringify({ action: "save", input, id }), () => {
        const state = partition(session);
        const current = id === null ? undefined : state.ranges.find((row) => row.id === id);
        if (id !== null && !current) throw new WaybillError("404_NOT_FOUND", "Không tìm thấy dải mã.");
        if (id === null) {
          throw new WaybillError(
            "CONTRACT_BLOCKED",
            "Chưa thể tạo dải mới: Backend chưa xác nhận giá trị ban đầu và quy tắc khởi tạo current_number.",
          );
        }
        if (current) assertBranch(session, current.branch_id);
        // Conservative mock-only rule: used/exhausted ranges cannot be rewritten.
        if (current && (current.status !== "active" || BigInt(current.current_number) >= BigInt(current.start_number))) throw new WaybillError("422_VALIDATION_ERROR", "Bản mô phỏng chỉ cho sửa dải đang hoạt động và chưa cấp mã.");
        if (state.ranges.some((row) => row.id !== id && row.prefix === input.prefix && rangesIntersect(row, input))) throw new WaybillError("422_VALIDATION_ERROR", "Khoảng số giao nhau với dải cùng tiền tố (chính sách Mock).", { start_number: ["Khoảng số bị trùng."] });
        if (current && current.start_number !== input.start_number) throw new WaybillError("422_VALIDATION_ERROR", "Không thay đổi số bắt đầu của dải đã tạo.");
        const now = new Date().toISOString();
        const nextId = (state.ranges.reduce((max, row) => BigInt(row.id) > max ? BigInt(row.id) : max, 0n) + 1n).toString();
        const row = trackingRangeRecordSchema.parse({ ...input, id: current?.id ?? nextId, current_number: current?.current_number ?? (BigInt(input.start_number) - 1n).toString(), status: current?.status ?? "active", created_at: current?.created_at ?? now, updated_at: now });
        state.ranges = current ? state.ranges.map((item) => item.id === id ? row : item) : [...state.ranges, row];
        return structuredClone(row);
      });
    },
    deactivate(session: WaybillSession, id: string, key: string) {
      assertMockAccess(session, "ranges");
      return mutate(session, key, JSON.stringify({ action: "deactivate", id }), () => {
        const row = partition(session).ranges.find((item) => item.id === id);
        if (!row) throw new WaybillError("404_NOT_FOUND", "Không tìm thấy dải mã.");
        assertBranch(session, row.branch_id);
        row.status = "inactive"; row.updated_at = new Date().toISOString();
        return structuredClone(row);
      });
    },
    logCount(session: WaybillSession) { return partition(session).logCount; },
    clear() { partitions.clear(); },
  };
}
