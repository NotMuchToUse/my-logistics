import { useEffect, useRef, useState } from 'react';
import { createPendingOperation } from '../utils/pendingOperation.ts';
import { incidentError, type IncidentError } from '../utils/incidentErrors.ts';

export function useIncidentMutation<T, R>(execute: (payload: T, key: string) => Promise<R>, context: string, onSuccess: (result: R) => void) {
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Dialogs are keyed by session and record version; each mount owns one operation context.
  const [operation] = useState(() => createPendingOperation<T, R>(execute, () => context));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<IncidentError | null>(null);
  const [uncertain, setUncertain] = useState(false);
  async function submit(payload: T, retry = false) {
    if (operation.busy) return;
    setBusy(true); setError(null);
    try {
      const result = await operation.run(payload, retry);
      if (alive.current) onSuccess(result);
    } catch (failure) { if (alive.current) setError(incidentError(failure)); }
    finally { if (alive.current) { setBusy(false); setUncertain(operation.pending); } }
  }
  return { busy, error, uncertain, submit };
}
