import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { canUnlock, unlockSchema, type HistoryContext, type Receipt } from "../warehouse-history.model";
import { historyErrorDetails, historyErrorMessage, unlockReceipt } from "../api/warehouse-history.api";

export function UnlockReceiptDialog({ receipt, context, onClose, onRefresh }: { receipt: Receipt; context: HistoryContext; onClose: () => void; onRefresh: () => void }) {
  const flight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const form = useForm<{ unlock_reason: string; version: number }>({ resolver: zodResolver(unlockSchema), defaultValues: { unlock_reason: "", version: receipt.version } });
  const submit = async (payload: { unlock_reason: string; version: number }) => {
    if (flight.current || uncertain || !canUnlock(receipt, context)) return;
    flight.current = true;
    setBusy(true);
    try {
      const updated = await unlockReceipt(receipt.public_id, payload, context);
      if (updated.public_id !== receipt.public_id || updated.status !== "unlocked" || !Number.isSafeInteger(updated.version) || updated.version <= receipt.version) throw new Error("Invalid unlock response");
      if (mounted.current) {
        onRefresh();
        toast.success("Đã mở khóa phiếu mô phỏng.");
        onClose();
      }
    } catch (error) {
      if (mounted.current) {
        const { code, details } = historyErrorDetails(error);
        const message = historyErrorMessage(error);
        if (["409_VERSION_CONFLICT", "403_FORBIDDEN", "403_BRANCH_SCOPE", "404_NOT_FOUND"].includes(code)) {
          toast.error(message);
          onClose();
          onRefresh();
        } else {
          if (code === "422_VALIDATION_ERROR" && details?.unlock_reason?.[0]) form.setError("unlock_reason", { message: details.unlock_reason[0] });
          else form.setError("root", { message });
          if (!["422_VALIDATION_ERROR", "400_BAD_REQUEST", "CONTRACT_BLOCKED"].includes(code)) setUncertain(true);
        }
      }
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const close = () => { if (uncertain) onRefresh(); onClose(); };
  return <Dialog open onOpenChange={(open) => { if (!open && !flight.current) close(); }}>
    <DialogContent showCloseButton={!busy} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
      <DialogTitle>Mở khóa phiếu xuất kho</DialogTitle>
      <DialogDescription>{receipt.receipt_code} — Mô phỏng thao tác nhạy cảm. Production phải ghi nhật ký kiểm toán; demo không ghi audit log thật.</DialogDescription>
      <form className="space-y-4" onSubmit={(event) => { void form.handleSubmit(submit)(event); }}>
        <label htmlFor="unlock-reason" className="block text-sm font-medium">Lý do mở khóa (tối đa 500 ký tự)</label>
        <textarea id="unlock-reason" className="min-h-28 w-full rounded-md border p-3 text-base focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" disabled={busy || uncertain} aria-invalid={!!form.formState.errors.unlock_reason} aria-describedby="unlock-error" {...form.register("unlock_reason")} />
        <p id="unlock-error" role="alert" className="text-sm text-destructive">{form.formState.errors.unlock_reason?.message ?? form.formState.errors.root?.message}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={close}>{uncertain ? "Tải lại phiếu" : "Hủy"}</Button>
          <Button disabled={busy || uncertain || !canUnlock(receipt, context)}>{busy ? "Đang mở khóa…" : "Xác nhận mở khóa"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
