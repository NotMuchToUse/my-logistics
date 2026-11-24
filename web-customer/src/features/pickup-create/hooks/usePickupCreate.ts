import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";
import { createPickup, loadPickupOptions } from "../api/pickup.api";
import { normalizeDraft } from "../api/pickup.mock";
import { DEFAULT_PICKUP_VALUES } from "../constants/pickup.constants";
import { pickupSchema } from "../schemas/pickup.schema";
import type { PickupDraft, PickupOptions, PickupReceipt } from "../types/pickup.types";

export function pickupError(error: unknown): { code: string; message: string; details: Record<string, string[]> } {
  if (typeof error === "object" && error !== null && "error" in error) {
    const detail = error.error as { code?: string; message?: string; details?: Record<string, string[]> };
    return { code: detail.code ?? "", message: detail.message ?? "Không thể gửi yêu cầu.", details: detail.details ?? {} };
  }
  return { code: "", message: error instanceof Error ? error.message : "Không thể kết nối. Vui lòng thử lại.", details: {} };
}

export function usePickupCreate() {
  const owner = useCustomerAuthStore((state) => state.customer?.public_id);
  const [options, setOptions] = useState<PickupOptions>({ addresses: [], branches: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [receipt, setReceipt] = useState<PickupReceipt | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ key: string; draft: PickupDraft } | null>(null);
  const form = useForm<PickupDraft>({ resolver: zodResolver(pickupSchema), defaultValues: DEFAULT_PICKUP_VALUES });

  useEffect(() => {
    let active = true;
    loadPickupOptions().then((data) => { if (active) setOptions(data); }).catch((error: unknown) => {
      if (active) setLoadError(pickupError(error).message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner, reload]);

  async function submit(values: PickupDraft) {
    if (inFlight.current || receipt || loading || loadError) return;
    inFlight.current = true;
    setSending(true);
    form.clearErrors();
    const currentOwner = owner;
    try {
      attempt.current ??= { key: crypto.randomUUID(), draft: normalizeDraft(values) };
      const response = await createPickup(attempt.current.draft, attempt.current.key);
      if (useCustomerAuthStore.getState().customer?.public_id !== currentOwner) return;
      setReceipt(response.data);
      attempt.current = null;
      setPendingRetry(false);
      toast.success(response.message);
    } catch (error: unknown) {
      if (useCustomerAuthStore.getState().customer?.public_id !== currentOwner) return;
      const failure = pickupError(error);
      const fields: (keyof PickupDraft)[] = ["handoverMode", "addressId", "branchPublicId", "parcelCount", "weightGram"];
      for (const field of fields) {
        if (failure.details[field]?.[0]) form.setError(field, { type: "server", message: failure.details[field][0] });
      }
      form.setError("root.server", { message: failure.message });
      const definitive = ["400_BAD_REQUEST", "401_UNAUTHORIZED", "403_FORBIDDEN", "422_VALIDATION_ERROR"].includes(failure.code);
      if (definitive) attempt.current = null;
      setPendingRetry(!definitive);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return { form, options, loading, loadError, receipt, sending, pendingRetry, submit,
    reload: () => { setLoading(true); setLoadError(""); setReload((value) => value + 1); },
    startNew: () => { setReceipt(null); form.reset(DEFAULT_PICKUP_VALUES); },
  };
}
