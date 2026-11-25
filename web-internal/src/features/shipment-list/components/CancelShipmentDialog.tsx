import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
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
import { shipmentCancelMutationSchema } from "../schemas/shipment-list.schema.ts";
import type { ShipmentListItem } from "../types/shipment-list.types";
import {
  formatShipmentCreatedAt,
  getShipmentStatusPresentation,
  getShipmentErrorMessage,
} from "../utils/shipment-list-display";

const cancelReasonSchema = shipmentCancelMutationSchema.pick({
  cancel_reason: true,
});
type CancelReasonForm = z.infer<typeof cancelReasonSchema>;

interface CancelShipmentDialogProps {
  shipment: ShipmentListItem;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    shipment: ShipmentListItem,
    cancelReason?: string,
  ) => Promise<unknown>;
}

export function CancelShipmentDialog({
  shipment,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: CancelShipmentDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<CancelReasonForm>({
    resolver: zodResolver(cancelReasonSchema),
    defaultValues: { cancel_reason: "" },
  });
  const status = getShipmentStatusPresentation(shipment.status);

  useEffect(() => {
    if (!open) return;
    form.reset({ cancel_reason: "" });
    setSubmitError(null);
  }, [form.reset, open, shipment.public_id]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onConfirm(shipment, values.cancel_reason?.trim() || undefined);
      toast.success(`Đã hủy vận đơn ${shipment.tracking_code}.`);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        getShipmentErrorMessage(error, "Không thể hủy vận đơn."),
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Xác nhận hủy vận đơn</DialogTitle>
          <DialogDescription>
            Thao tác này chỉ khả dụng với vận đơn ở trạng thái Bản nháp hoặc
            Chờ lấy hàng. Dữ liệu cước và COD không bị thay đổi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Mã vận đơn: </span>
            <span className="font-mono font-medium">{shipment.tracking_code}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Trạng thái hiện tại: </span>
            {status.label}
          </p>
          <p>
            <span className="text-muted-foreground">Tạo lúc: </span>
            {formatShipmentCreatedAt(shipment.created_at)}
          </p>
        </div>

        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor={`shipment-cancel-reason-${shipment.public_id}`}>
              Lý do hủy (không bắt buộc)
            </Label>
            <textarea
              id={`shipment-cancel-reason-${shipment.public_id}`}
              rows={3}
              maxLength={500}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              placeholder="Nhập lý do nếu cần"
              disabled={pending}
              {...form.register("cancel_reason")}
            />
            {form.formState.errors.cancel_reason?.message ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.cancel_reason.message}
              </p>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Quay lại
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {pending ? "Đang hủy..." : "Xác nhận hủy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
