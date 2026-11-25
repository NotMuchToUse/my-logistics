import { useState } from "react";
import {
  Ellipsis,
  Flag,
  Forward,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHIPMENT_LIST_PERMISSIONS } from "../constants/shipment-list.constants.ts";
import type { ShipmentListItem } from "../types/shipment-list.types";
import type { useShipmentActions } from "../hooks/useShipmentActions";
import { canCancelShipmentStatus, getShipmentApiErrorCode } from "../hooks/shipment-list.hook-logic";
import { getShipmentErrorMessage } from "../utils/shipment-list-display";
import { CancelShipmentDialog } from "./CancelShipmentDialog";

type ShipmentActionsState = ReturnType<typeof useShipmentActions>;

interface ShipmentRowActionsProps {
  shipment: ShipmentListItem;
  actions: ShipmentActionsState;
}

function showActionError(error: unknown): void {
  const code = getShipmentApiErrorCode(error);
  if (
    code === "401_UNAUTHORIZED" ||
    code === "403_FORBIDDEN" ||
    code === "403_BRANCH_SCOPE" ||
    code === "409_VERSION_CONFLICT"
  ) {
    return;
  }
  toast.error(getShipmentErrorMessage(error));
}

export function ShipmentRowActions({
  shipment,
  actions,
}: ShipmentRowActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const pending = actions.isPending(shipment.public_id);

  const togglePriority = async () => {
    try {
      const result = await actions.updatePriority(
        shipment,
        !shipment.is_priority,
      );
      toast.success(result.message);
    } catch (error) {
      showActionError(error);
    }
  };

  const confirmCancel = (row: ShipmentListItem, reason?: string) =>
    actions.cancel(row, reason);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Thao tác vận đơn ${shipment.tracking_code}`}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Ellipsis className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!actions.canUpdatePriority || pending}
            title={
              actions.canUpdatePriority
                ? undefined
                : `Cần quyền ${SHIPMENT_LIST_PERMISSIONS.priority}`
            }
            onSelect={() => void togglePriority()}
          >
            <Flag className="mr-2 h-4 w-4" aria-hidden="true" />
            {shipment.is_priority ? "Bỏ ưu tiên" : "Báo ưu tiên"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              !actions.canCancel ||
              !canCancelShipmentStatus(shipment.status) ||
              pending
            }
            title={
              !actions.canCancel
                ? `Cần quyền ${SHIPMENT_LIST_PERMISSIONS.cancel}`
                : undefined
            }
            onSelect={() => setCancelOpen(true)}
          >
            <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Hủy vận đơn
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled
            title="Chưa có interface chuyển tiếp được xác nhận."
          >
            <Forward className="mr-2 h-4 w-4" aria-hidden="true" />
            Chuyển tiếp (chưa khả dụng)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CancelShipmentDialog
        shipment={shipment}
        open={cancelOpen}
        pending={pending}
        onOpenChange={setCancelOpen}
        onConfirm={confirmCancel}
      />
    </>
  );
}
