import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { FileCheck2, LoaderCircle, Send } from "lucide-react";
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
import {
  confirmOutboundDeliverySchema,
  type ConfirmOutboundDeliveryFormValues,
} from "../schemas/warehouse-outbound-delivery.schema";
import type { OutboundDeliveryReceipt } from "../types/warehouse-outbound-delivery.types";

interface ConfirmOutboundDeliveryDialogProps {
  open: boolean;
  receipt: OutboundDeliveryReceipt | null;
  activeCount: number;
  isConfirming: boolean;
  onClose: () => void;
  onConfirmReceipt: (note?: string) => Promise<boolean>;
}

function formatWeight(weightGram: number): string {
  return `${(weightGram / 1000).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  })} kg`;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đ`;
}

export function ConfirmOutboundDeliveryDialog({
  open,
  receipt,
  activeCount,
  isConfirming,
  onClose,
  onConfirmReceipt,
}: ConfirmOutboundDeliveryDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ConfirmOutboundDeliveryFormValues>({
    defaultValues: {
      note: receipt?.note ?? "",
    },
  });

  useEffect(() => {
    if (open && receipt) {
      reset({ note: receipt.note ?? "" });
    }
  }, [open, receipt, reset]);

  async function onSubmit(values: ConfirmOutboundDeliveryFormValues) {
    const parsed = confirmOutboundDeliverySchema.safeParse(values);
    if (!parsed.success) {
      setError("note", {
        message: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ.",
      });
      return;
    }

    const ok = await onConfirmReceipt(parsed.data.note);
    if (ok) {
      onClose();
    }
  }

  if (!receipt) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />
            Chốt phiếu xuất kho giao hàng?
          </DialogTitle>
          <DialogDescription>
            Sau khi chốt, phiếu <strong className="font-mono text-foreground">{receipt.receipt_code}</strong> sẽ chuyển sang trạng thái{" "}
            <strong className="text-foreground">confirmed</strong>, toàn bộ {activeCount} vận đơn chuyển sang{" "}
            <strong className="text-foreground">out_for_delivery</strong> và đẩy trực tiếp sang App Tài xế.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3.5 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Tài xế nhận giao</p>
            <p className="font-semibold">
              {receipt.driver_name} ({receipt.driver_code})
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Số lượng vận đơn</p>
            <p className="font-semibold">{activeCount} đơn hàng</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tổng khối lượng</p>
            <p className="font-semibold">{formatWeight(receipt.total_weight_gram)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tổng tiền thu hộ COD</p>
            <p className="font-semibold text-primary">
              {formatCurrency(receipt.total_cod_amount)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="outbound-confirm-note">Ghi chú bàn giao (tùy chọn)</Label>
            <Input
              id="outbound-confirm-note"
              placeholder="Nhập ghi chú bàn giao cho tài xế..."
              disabled={isConfirming}
              {...register("note")}
            />
            {errors.note && (
              <p className="text-xs text-destructive">{errors.note.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isConfirming}
              onClick={onClose}
            >
              Kiểm tra lại
            </Button>
            <Button type="submit" disabled={isConfirming || activeCount === 0}>
              {isConfirming ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Đang chốt phiếu...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                  Chốt phiếu & Đẩy App Tài xế
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
