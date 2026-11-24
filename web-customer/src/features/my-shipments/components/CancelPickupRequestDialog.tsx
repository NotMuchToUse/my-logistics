import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import type { CancelPickupRequestValues } from "@/features/my-shipments/schemas/my-shipments.schema";
import { cancelPickupRequestSchema } from "@/features/my-shipments/schemas/my-shipments.schema";
import type { PickupRequestRecord } from "@/features/my-shipments/types/my-shipments.types";

interface CancelPickupRequestDialogProps {
  request: PickupRequestRecord | null;
  open: boolean;
  isLoading: boolean;
  submitError: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    request: PickupRequestRecord,
    values: CancelPickupRequestValues,
  ) => Promise<boolean>;
}

export function CancelPickupRequestDialog({
  request,
  open,
  isLoading,
  submitError,
  onOpenChange,
  onConfirm,
}: CancelPickupRequestDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelPickupRequestValues>({
    resolver: zodResolver(cancelPickupRequestSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ reason: "" });
    }
  }, [open, reset]);

  async function submit(values: CancelPickupRequestValues): Promise<void> {
    if (!request) {
      return;
    }

    if (await onConfirm(request, values)) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
          <DialogHeader>
            <DialogTitle>Hủy yêu cầu lấy hàng?</DialogTitle>
            <DialogDescription>
              {request
                ? `Yêu cầu ${request.request_code} sẽ được hủy. Vui lòng cho biết lý do.`
                : "Vui lòng cho biết lý do hủy yêu cầu."}
            </DialogDescription>
          </DialogHeader>
          {submitError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {submitError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="pickup-cancel-reason">Lý do hủy</Label>
            <textarea
              id="pickup-cancel-reason"
              rows={4}
              maxLength={500}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Nhập lý do hủy (5–500 ký tự)"
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={
                errors.reason ? "pickup-cancel-reason-error" : undefined
              }
              disabled={isLoading}
              {...register("reason")}
            />
            {errors.reason && (
              <p
                id="pickup-cancel-reason-error"
                className="text-sm text-destructive"
              >
                {errors.reason.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
            >
              Đóng
            </Button>
            <Button type="submit" variant="destructive" disabled={isLoading}>
              {isLoading ? "Đang hủy..." : "Xác nhận hủy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
