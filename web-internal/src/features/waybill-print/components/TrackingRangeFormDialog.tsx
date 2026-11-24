import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TRACKING_RANGE_STATUS_LABELS } from "../constants/waybillPrint.constants";
import { trackingRangeInputSchema } from "../schemas/trackingRange.schema";
import type { TrackingRangeInput, TrackingRangeRecord, WaybillSession } from "../types/waybillPrint.types";
import { WaybillError } from "../api/waybillPrint.mock";

export function TrackingRangeFormDialog({
  open,
  record,
  session,
  busy,
  error,
  pendingSave,
  onOpenChange,
  onSave,
  onRetry,
}: {
  open: boolean;
  record: TrackingRangeRecord | null;
  session: WaybillSession;
  busy: boolean;
  error: Error | null;
  pendingSave: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: TrackingRangeInput, id: string | null) => Promise<TrackingRangeRecord | null>;
  onRetry: () => Promise<TrackingRangeRecord | null>;
}) {
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<TrackingRangeInput>({
    resolver: zodResolver(trackingRangeInputSchema),
    defaultValues: { prefix: "", start_number: "", end_number: "", branch_id: session.branchId },
  });

  useEffect(() => {
    reset(record
      ? {
          prefix: record.prefix,
          start_number: record.start_number,
          end_number: record.end_number,
          branch_id: record.branch_id,
        }
      : { prefix: "", start_number: "", end_number: "", branch_id: session.branchId });
  }, [open, record, reset, session.branchId]);

  async function submit(input: TrackingRangeInput) {
    if (await onSave(input, record?.id ?? null)) onOpenChange(false);
  }

  async function retry() {
    if (await onRetry()) onOpenChange(false);
  }

  const fieldMessages = error instanceof WaybillError ? error.details : {};
  const matchingPendingSave = pendingSave;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? "Chỉnh sửa dải mã" : "Tạo dải mã"}</DialogTitle>
          <DialogDescription>
            Chỉ nhập các trường nghiệp vụ được phép. Trạng thái và số đã cấp do dịch vụ quản lý.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <div className="space-y-1">
            <label htmlFor="range-prefix" className="text-sm font-medium">Tiền tố</label>
            <Input id="range-prefix" autoComplete="off" maxLength={15} {...register("prefix")} disabled={busy || matchingPendingSave} aria-invalid={Boolean(errors.prefix || fieldMessages.prefix)} />
            {(errors.prefix?.message || fieldMessages.prefix?.[0]) && <p className="text-sm text-destructive" role="alert">{errors.prefix?.message ?? fieldMessages.prefix?.[0]}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="range-start" className="text-sm font-medium">Số bắt đầu</label>
              <Input id="range-start" inputMode="numeric" autoComplete="off" {...register("start_number")} readOnly={Boolean(record)} disabled={busy || matchingPendingSave} aria-invalid={Boolean(errors.start_number || fieldMessages.start_number)} />
              {(errors.start_number?.message || fieldMessages.start_number?.[0]) && <p className="text-sm text-destructive" role="alert">{errors.start_number?.message ?? fieldMessages.start_number?.[0]}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="range-end" className="text-sm font-medium">Số kết thúc</label>
              <Input id="range-end" inputMode="numeric" autoComplete="off" {...register("end_number")} disabled={busy || matchingPendingSave} aria-invalid={Boolean(errors.end_number || fieldMessages.end_number)} />
              {(errors.end_number?.message || fieldMessages.end_number?.[0]) && <p className="text-sm text-destructive" role="alert">{errors.end_number?.message ?? fieldMessages.end_number?.[0]}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="range-branch" className="text-sm font-medium">Phạm vi chi nhánh</label>
            <Controller
              control={control}
              name="branch_id"
              render={({ field }) => (
                <select
                  id="range-branch"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(event.target.value || null)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  disabled={busy || matchingPendingSave}
                >
                  {session.allBranches && <option value="">Dùng chung toàn hệ thống</option>}
                  {session.branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              )}
            />
            {(errors.branch_id?.message || fieldMessages.branch_id?.[0]) && <p className="text-sm text-destructive" role="alert">{errors.branch_id?.message ?? fieldMessages.branch_id?.[0]}</p>}
          </div>
          {record && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p>Đã cấp tới số: <strong className="font-mono">{record.current_number}</strong></p>
              <p>Trạng thái hiện tại: <strong>{TRACKING_RANGE_STATUS_LABELS[record.status]}</strong></p>
            </div>
          )}
          {error && !Object.keys(fieldMessages).length && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Đóng</Button>
            {matchingPendingSave ? (
              <Button type="button" onClick={() => void retry()} disabled={busy}>Thử lại đúng yêu cầu trước</Button>
            ) : (
              <Button type="submit" disabled={busy}>Lưu dải mã</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
