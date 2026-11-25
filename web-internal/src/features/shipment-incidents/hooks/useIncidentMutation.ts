import { useEffect, useRef, useState } from 'react';
import { createPendingOperation } from '../utils/pendingOperation.ts';
import { incidentError, type IncidentError } from '../utils/incidentErrors.ts';

const pendingOperations = new Map<string, ReturnType<typeof createPendingOperation<unknown, unknown>>>();

export function clearPendingIncidentOperation(context: string, kind: string): void {
  pendingOperations.delete(`${context}:${kind}`);
}

export function useIncidentMutation<T, R>(execute: (payload: T, key: string) => Promise<R>, context: string, onSuccess: (result: R) => void, kind = 'default') {
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const operationKey = `${context}:${kind}`;
  const [operation] = useState(() => {
    const existing = pendingOperations.get(operationKey);
    if (existing) return existing as ReturnType<typeof createPendingOperation<T, R>>;
    const created = createPendingOperation<T, R>(execute, () => context);
    pendingOperations.set(operationKey, created as ReturnType<typeof createPendingOperation<unknown, unknown>>);
    return created;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<IncidentError | null>(null);
  const [uncertain, setUncertain] = useState(operation.pending);
  async function submit(payload: T, retry = false) {
    if (operation.busy) return;
    setBusy(true); setError(null);
    try {
      const result = await operation.run(payload, retry);
      pendingOperations.delete(operationKey);
      if (alive.current) onSuccess(result);
    } catch (failure) { if (alive.current) setError(incidentError(failure)); }
    finally { if (alive.current) { setBusy(false); setUncertain(operation.pending); } }
  }
  return { busy, error, uncertain, submit };
}
