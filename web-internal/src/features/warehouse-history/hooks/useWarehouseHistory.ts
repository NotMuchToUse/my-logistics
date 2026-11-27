import { useEffect, useState } from "react";
import { getReceipt, historyErrorMessage, listHistory } from "../api/warehouse-history.api";
import type { HistoryContext, HistoryFilters, Receipt, ReceiptPage } from "../warehouse-history.model";

export function useWarehouseHistory(c: HistoryContext, f: HistoryFilters, id?: string) {
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([c, f, id, revision]);
  const [result, setResult] = useState<{ key: string; list?: ReceiptPage; receipt?: Receipt; error?: string }>();
  useEffect(() => {
    const [context, filters, receiptId] = JSON.parse(key) as [HistoryContext, HistoryFilters, string | null, number];
    const controller = new AbortController();
    let active = true;
    const request = receiptId ? getReceipt(receiptId, context, controller.signal).then((receipt) => ({ receipt })) : listHistory(filters, context, controller.signal).then((list) => ({ list }));
    void request.then((value) => { if (active) setResult({ key, ...value }); }).catch((error: unknown) => { if (active) setResult({ key, error: historyErrorMessage(error) }); });
    return () => { active = false; controller.abort(); };
    // key captures the complete request and authentication context.
  }, [key]);
  const current = result?.key === key ? result : undefined;
  return { ...current, loading: !current, refetch: () => setRevision((value) => value + 1) };
}
