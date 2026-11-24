import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cancelPickupRequest } from "../api/pickup-dispatch.api";
import { QUICK_CANCEL_REASONS } from "../constants/pickup-dispatch.constants";
import { cancelPickupRequestSchema } from "../schemas/pickup-dispatch.schema";
import type { PickupRequestItem } from "../types/pickup-dispatch.types";

interface CancelPickupDialogProps {
  request: PickupRequestItem | null;
  onOpenChange: (open: boolean) => void;
  onCancelled: (updated: PickupRequestItem) => void;
}

export function CancelPickupDialog({
  request,
  onOpenChange,
  onCancelled,
}: CancelPickupDialogProps) {
  const [reason, setReason] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (request) {
      setReason("");
      setErrorText(null);
    }
  }, [request]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request) {
      return;
    }

    const parsed = cancelPickupRequestSchema.safeParse({
      cancel_reason: reason,
    });
    if (!parsed.success) {
      setErrorText(parsed.error.issues[0]?.message ?? "Lý do hủy không hợp lệ.");
      return;
    }

    setErrorText(null);
    setSubmitting(true);
    try {
      const updated = await cancelPickupRequest(request.public_id, {
        cancel_reason: parsed.data.cancel_reason,
        version: request.version,
      });
      toast.success(`Đã hủy yêu cầu lấy hàng ${updated.request_code}.`);
      onCancelled(updated);
      onOpenChange(false);
    } catch (error) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        typeof (error as { error?: { message?: string } }).error?.message ===
          "string"
          ? (error as { error: { message: string } }).error.message
          : "Không thể hủy yêu cầu lấy hàng.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Hủy yêu cầu lấy hàng
          </DialogTitle>
          <DialogDescription>
            {request
              ? `Xác nhận hủy yêu cầu ${request.request_code} của khách hàng ${request.sender_name}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Chọn nhanh lý do phổ biến</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CANCEL_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setReason(preset);
                    setErrorText(null);
                  }}
                  className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs transition hover:bg-muted"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pickup-cancel-reason">Lý do hủy chi tiết *</Label>
            <textarea
              id="pickup-cancel-reason"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Nhập lý do hủy yêu cầu lấy hàng..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {errorText && (
              <p className="text-xs text-destructive">{errorText}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Đóng
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận hủy yêu cầu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}