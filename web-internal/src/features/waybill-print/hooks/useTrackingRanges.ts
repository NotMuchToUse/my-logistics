import { useCallback, useEffect, useRef, useState } from "react";
import { waybillPrintApi } from "../api/waybillPrint.api";
import { createPendingOperation } from "../utils/pendingOperation";
import type {
  TrackingRangeInput,
  TrackingRangeRecord,
  WaybillSession,
} from "../types/waybillPrint.types";

type RangeMutation =
  | { kind: "save"; input: TrackingRangeInput; id: string | null }
  | { kind: "deactivate"; id: string };

export function useTrackingRanges(session: WaybillSession, enabled: boolean) {
  const requestSequence = useRef(0);
  const [rows, setRows] = useState<TrackingRangeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [mutation] = useState(() => createPendingOperation<RangeMutation, TrackingRangeRecord>(
    (action, key) => action.kind === "save"
      ? waybillPrintApi.save(session, action.input, action.id, key)
      : waybillPrintApi.deactivate(session, action.id, key),
    () => session.key,
  ));

  const reload = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const requestSession = session;
    setLoading(true);
    setError(null);
    try {
      const result = await waybillPrintApi.ranges(requestSession);
      if (sequence === requestSequence.current && requestSession.key === session.key) {
        setRows(result);
      }
    } catch (caught: unknown) {
      if (sequence === requestSequence.current && requestSession.key === session.key) {
        setError(caught instanceof Error ? caught : new Error("Không tải được danh sách dải mã."));
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [session, setError, setLoading]);

  useEffect(() => {
    if (enabled) void reload();
    return () => {
      requestSequence.current += 1;
      mutation.invalidate();
    };
  }, [enabled, mutation, reload]);

  const runMutation = useCallback(async (action: RangeMutation, retry = false) => {
    if (mutation.busy) return null;
    setMutating(true);
    setError(null);
    try {
      const result = await mutation.run(action, retry);
      await reload();
      return result;
    } catch (caught: unknown) {
      const failure = caught instanceof Error ? caught : new Error("Không thể cập nhật dải mã.");
      setError(failure);
      return null;
    } finally {
      setMutating(false);
    }
  }, [mutation, reload, setError, setMutating]);

  const save = useCallback(
    (input: TrackingRangeInput, id: string | null, retry = false) =>
      runMutation({ kind: "save", input, id }, retry),
    [runMutation],
  );
  const deactivate = useCallback(
    (id: string, retry = false) => runMutation({ kind: "deactivate", id }, retry),
    [runMutation],
  );
  const retryMutation = useCallback(async () => {
    const pending = mutation.pendingPayload;
    if (!pending) return null;
    return runMutation(pending, true);
  }, [mutation, runMutation]);

  return {
    rows,
    loading,
    mutating,
    error,
    pending: mutation.pending,
    pendingMutation: mutation.pendingPayload,
    reload,
    save,
    deactivate,
    retryMutation,
  };
}
