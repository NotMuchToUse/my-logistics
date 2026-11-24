import { useEffect, useState } from "react";
import { fetchOptions, type CatalogOption, type CatalogResource } from "../api/shipment-create.api";

export function useShipmentOptions(resource: CatalogResource, parentId: number | null = null) {
  const [retry, setRetry] = useState(0);
  const key = `${resource}:${parentId}:${retry}`;
  const [state, setState] = useState<{ key: string; rows: CatalogOption[]; error: boolean }>({ key: "", rows: [], error: false });
  const enabled = (resource !== "districts" && resource !== "wards") || (parentId !== null && parentId > 0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetchOptions(resource, parentId, controller.signal).then(
      (rows) => { if (!controller.signal.aborted) setState({ key, rows, error: false }); },
      () => { if (!controller.signal.aborted) setState({ key, rows: [], error: true }); },
    );
    return () => controller.abort();
  }, [resource, parentId, key, enabled]);
  return {
    rows: enabled && state.key === key ? state.rows : [],
    loading: enabled && state.key !== key,
    error: enabled && state.key === key && state.error,
    retry: () => setRetry((value) => value + 1),
  };
}
