import { WaybillError } from "../api/waybillPrint.mock.ts";

/** Locks synchronously; ambiguous errors retain the exact snapshot and UUID for explicit retry. */
export function createPendingOperation<T, R>(
  execute: (payload: T, key: string) => Promise<R>,
  context: () => string,
  uuid: () => string = () => crypto.randomUUID(),
) {
  let pending: { payload: T; key: string; context: string } | null = null;
  let busy = false;
  return {
    get pending() { return pending !== null; },
    get busy() { return busy; },
    get pendingPayload() { return pending ? structuredClone(pending.payload) : null; },
    async run(payload: T, retry = false): Promise<R> {
      if (busy) throw new WaybillError("OPERATION_BUSY", "Thao tác đang được xử lý.");
      if (pending && !retry) throw new WaybillError("OUTCOME_UNKNOWN", "Kết quả lượt trước chưa rõ. Hãy thử lại đúng lượt đó.");
      if (retry && !pending) throw new WaybillError("NO_PENDING_OPERATION", "Không có lượt cần thử lại.");
      if (!pending) pending = { payload: structuredClone(payload), key: uuid(), context: context() };
      if (pending.context !== context()) throw new WaybillError("CONTEXT_CHANGED", "Phiên hoặc chi nhánh đã đổi. Không thể thử lại lượt cũ tại đây.");
      busy = true;
      const current = pending;
      try {
        const result = await execute(structuredClone(current.payload), current.key);
        pending = null;
        if (current.context !== context()) throw new WaybillError("CONTEXT_CHANGED", "Đã đổi phiên hoặc chi nhánh; kết quả cũ không được sử dụng.");
        return result;
      } catch (error) {
        if (error instanceof WaybillError && [
          "400_BAD_REQUEST",
          "401_UNAUTHORIZED",
          "403_FORBIDDEN",
          "403_BRANCH_SCOPE",
          "404_NOT_FOUND",
          "422_VALIDATION_ERROR",
          "CONTRACT_BLOCKED",
        ].includes(error.code)) pending = null;
        throw error;
      } finally { busy = false; }
    },
    invalidate() {
      if (busy) return false;
      pending = null;
      return true;
    },
  };
}
