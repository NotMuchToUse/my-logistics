import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DialogContentProps } from "@/components/ui/dialog";
import { ShipmentInheritedInfo } from "@/features/shipment-exceptions/components/ShipmentInheritedInfo";
import type { useShipmentExceptions } from "@/features/shipment-exceptions/hooks/useShipmentExceptions";

type ShipmentExceptionsHookState = ReturnType<typeof useShipmentExceptions>;

export type ReturnShipmentDialogProps = Pick<
  ShipmentExceptionsHookState,
  | "selectedShipment"
  | "selectedShipmentPublicId"
  | "inheritedInfo"
  | "inheritedInfoStatus"
  | "capabilities"
> &
  Pick<
    ShipmentExceptionsHookState["returnDialog"],
    "isOpen" | "onClose" | "unavailableReason"
  > & {
    onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
  };

const RETURN_PREVIEW_BLOCKED_REASON =
  "Chưa thể xác nhận chuyển hoàn. API tạo vận đơn chuyển hoàn và quy tắc kế thừa dữ liệu chưa được xác nhận đầy đủ.";

function hasValidPublicId(value: string): boolean {
  return value.trim().length > 0 && value.trim() === value;
}

export function ReturnShipmentDialog({
  isOpen,
  selectedShipment,
  selectedShipmentPublicId,
  inheritedInfo,
  inheritedInfoStatus,
  capabilities,
  onClose,
  onCloseAutoFocus,
  unavailableReason,
}: ReturnShipmentDialogProps) {
  const hasConsistentSelection =
    selectedShipment !== null &&
    selectedShipmentPublicId !== null &&
    hasValidPublicId(selectedShipment.public_id) &&
    selectedShipment.public_id === selectedShipmentPublicId &&
    selectedShipment.status === "pending_return";
  const canShowPreview =
    isOpen &&
    hasConsistentSelection &&
    capabilities.canOpenReturnModal;

  if (!canShowPreview || selectedShipment === null) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={canShowPreview} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby="return-shipment-description"
        className="w-[95vw] max-w-3xl"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>Tạo vận đơn chuyển hoàn</DialogTitle>
          <DialogDescription id="return-shipment-description">
            Xem thông tin vận đơn gốc trước khi tạo vận đơn chuyển hoàn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Giao diện xem trước</p>
            <p className="mt-1 text-muted-foreground">
              Dữ liệu dưới đây chỉ tham chiếu. Chưa xác nhận quy tắc kế thừa,
              thông tin vận đơn mới hoặc trạng thái sau khi chuyển hoàn.
            </p>
          </div>

          <dl className="grid min-w-0 grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <dt className="text-sm text-muted-foreground">
                Loại vận đơn dự kiến
              </dt>
              <dd className="text-sm font-medium">Chuyển hoàn</dd>
            </div>
            <div className="min-w-0 space-y-1">
              <dt className="text-sm text-muted-foreground">
                Mã vận đơn gốc
              </dt>
              <dd className="break-words font-mono text-sm font-medium">
                {selectedShipment.tracking_code.trim() ||
                  "Chưa có mã vận đơn"}
              </dd>
            </div>
          </dl>

          <ShipmentInheritedInfo
            selectedShipment={selectedShipment}
            inheritedInfo={inheritedInfo}
            inheritedInfoStatus={inheritedInfoStatus}
          />

          <div
            className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            <Info
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <p>{unavailableReason.trim() || RETURN_PREVIEW_BLOCKED_REASON}</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            disabled
            aria-describedby="return-shipment-unavailable"
            title={
              unavailableReason.trim() || RETURN_PREVIEW_BLOCKED_REASON
            }
          >
            Xác nhận tạo đơn chuyển hoàn
          </Button>
          <span className="sr-only" id="return-shipment-unavailable">
            Nút xác nhận luôn bị vô hiệu hóa vì API tạo vận đơn chuyển hoàn
            chưa khả dụng.
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
