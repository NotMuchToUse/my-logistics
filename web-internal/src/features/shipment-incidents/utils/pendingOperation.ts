import { IncidentError, incidentError } from './incidentErrors.ts';

/** Ambiguous failures retain the exact payload, context and UUID until an explicit retry. */
export function createPendingOperation<T, R>(execute: (payload: T, key: string) => Promise<R>, context: () => string, uuid = () => crypto.randomUUID()) {
  let pending: { payload: T; key: string; context: string } | null = null;
  let busy = false;
  return {
    get pending() { return pending !== null; },
    get busy() { return busy; },
    async run(payload: T, retry = false) {
      if (busy) throw new IncidentError('BUSY', 'Đang xử lý.');
      if (pending && !retry) throw new IncidentError('OUTCOME_UNKNOWN', 'Hãy thử lại lượt gửi trước.');
      if (!pending) pending = { payload: structuredClone(payload), key: uuid(), context: context() };
      const current = pending;
      if (current.context !== context()) throw new IncidentError('CONTEXT_CHANGED', 'Phiên hoặc chi nhánh đã thay đổi.');
      busy = true;
      try {
        const result = await execute(structuredClone(current.payload), current.key);
        pending = null;
        if (current.context !== context()) throw new IncidentError('CONTEXT_CHANGED', 'Đã đổi chi nhánh; không sử dụng kết quả cũ.');
        return result;
      } catch (error) {
        const normalized = incidentError(error);
        if (['400_BAD_REQUEST', '401_UNAUTHORIZED', '403_FORBIDDEN', '403_BRANCH_SCOPE', '404_NOT_FOUND', '409_VERSION_CONFLICT', '422_VALIDATION_ERROR', 'API_CONTRACT_BLOCKED'].includes(normalized.code)) pending = null;
        throw normalized;
      } finally { busy = false; }
    },
  };
}
