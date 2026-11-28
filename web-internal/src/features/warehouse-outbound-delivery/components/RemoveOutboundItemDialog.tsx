import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, LoaderCircle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { QUICK_REMOVE_REASONS } from "../constants/warehouse-outbound-delivery.constants";
import {
  removeOutboundItemSchema,
  type RemoveOutboundItemFormValues,
} from "../schemas/warehouse-outbound-delivery.schema";
import type { OutboundDeliveryReceiptItem } from "../types/warehouse-outbound-delivery.types";

interface RemoveOutboundItemDialogProps {
  item: OutboundDeliveryReceiptItem | null;
  isRemoving: boolean;
  onClose: () => void;
  onConfirmRemove: (itemId: number, removeReason: string) => Promise<boolean>;
}

export function RemoveOutboundItemDialog({
  item,
  isRemoving,
  onClose,
  onConfirmRemove,
}: RemoveOutboundItemDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm<RemoveOutboundItemFormValues>({
    defaultValues: {
      remove_reason: "",
    },
  });

  const currentReason = watch("remove_reason");

  useEffect(() => {
    if (item) {
      reset({ remove_reason: "" });
    }
  }, [item, reset]);

  async function onSubmit(values: RemoveOutboundItemFormValues) {
    if (!item) {
      return;
    }

    const parsed = removeOutboundItemSchema.safeParse(values);
    if (!parsed.success) {
      setError("remove_reason", {
        message:
          parsed.error.issues[0]?.message ?? "Vui lòng nhập lý do gỡ đơn.",
      });
      return;
    }

    const ok = await onConfirmRemove(item.id, parsed.data.remove_reason);
    if (ok) {
      onClose();
    }
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            Gỡ vận đơn khỏi phiếu xuất giao
          </DialogTitle>
          <DialogDescription>
            {item ? (
              <>
                Xác nhận gỡ vận đơn{" "}
                <strong className="font-mono text-foreground">
                  {item.tracking_code}
                </strong>{" "}
                (Người nhận: {item.recipient_name}) khỏi phiếu nháp. Hệ thống sẽ lưu vết lý do gỡ đơn.
              </>
            ) : (
              "Vui lòng nhập lý do gỡ vận đơn."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Chọn nhanh lý do phổ biến</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REMOVE_REASONS.map((reason) => (
                <Button
                  key={reason}
                  type="button"
                  size="sm"
                  variant={currentReason === reason ? "default" : "outline"}
                  className="h-auto py-1 text-xs"
                  disabled={isRemoving}
                  onClick={() =>
                    setValue("remove_reason", reason, { shouldValidate: true })
                  }
                >
                  {reason}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outbound-remove-reason">
              Lý do gỡ đơn (remove_reason) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="outbound-remove-reason"
              placeholder="Nhập lý do gỡ vận đơn quét nhầm..."
              disabled={isRemoving}
              {...register("remove_reason")}
            />
            {errors.remove_reason && (
              <p className="text-xs text-destructive">
                {errors.remove_reason.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isRemoving}
              onClick={onClose}
            >
              Hủy bỏ
            </Button>
            <Button type="submit" variant="destructive" disabled={isRemoving}>
              {isRemoving ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Đang gỡ đơn...
                </>
              ) : (
                "Xác nhận gỡ đơn"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
