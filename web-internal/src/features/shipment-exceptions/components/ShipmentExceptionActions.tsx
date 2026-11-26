import { useRef } from "react";
import { Ellipsis, Forward, RotateCcw, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ShipmentExceptionCapabilities,
  ShipmentExceptionListItem,
} from "@/features/shipment-exceptions/types/shipment-exceptions.types";

export interface ShipmentExceptionActionsProps {
  shipment: ShipmentExceptionListItem;
  capabilities: ShipmentExceptionCapabilities;
  onOpenReturn?: (publicId: string, trigger?: HTMLElement | null) => boolean;
  onOpenForward?: (publicId: string, trigger?: HTMLElement | null) => boolean;
}

interface ActionMenuItemProps {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  unavailableReason?: string;
  onSelect?: () => void;
}

function ActionMenuItem({
  icon: Icon,
  label,
  disabled = false,
  unavailableReason,
  onSelect,
}: ActionMenuItemProps) {
  return (
    <DropdownMenuItem
      className="items-start gap-2 whitespace-normal py-2"
      disabled={disabled}
      onSelect={onSelect}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="grid min-w-0 gap-1">
        <span>{label}</span>
        {unavailableReason && (
          <span className="whitespace-normal text-xs leading-snug text-muted-foreground">
            {unavailableReason}
          </span>
        )}
      </span>
    </DropdownMenuItem>
  );
}

function getUnavailableReason(
  hasPublicId: boolean,
  capabilityAllowsOpening: boolean,
  callbackExists: boolean,
  capabilityReason: string | undefined,
  actionLabel: string,
): string | undefined {
  if (!hasPublicId) {
    return "Không thể mở thao tác vì mã vận đơn không hợp lệ.";
  }

  if (!capabilityAllowsOpening) {
    return capabilityReason ?? `${actionLabel} hiện chưa khả dụng.`;
  }

  if (!callbackExists) {
    return `Không thể mở hộp thoại ${actionLabel.toLocaleLowerCase("vi-VN")} lúc này.`;
  }

  return undefined;
}

export function ShipmentExceptionActions({
  shipment,
  capabilities,
  onOpenReturn,
  onOpenForward,
}: ShipmentExceptionActionsProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const publicId = shipment.public_id;
  const hasPublicId =
    publicId.length > 0 && publicId.trim() === publicId;
  const trackingCode = shipment.tracking_code.trim();
  const triggerLabel = trackingCode
    ? `Thao tác vận đơn ${trackingCode}`
    : "Thao tác vận đơn";

  const canOpenReturn =
    shipment.status === "pending_return" &&
    capabilities.canOpenReturnModal &&
    hasPublicId &&
    typeof onOpenReturn === "function";
  const canOpenForward =
    (shipment.status === "delivery_failed" ||
      shipment.status === "pending_return") &&
    capabilities.canOpenForwardModal &&
    hasPublicId &&
    typeof onOpenForward === "function";

  const openReturn = () => {
    if (
      shipment.status !== "pending_return" ||
      !capabilities.canOpenReturnModal ||
      !hasPublicId ||
      !onOpenReturn
    ) {
      return;
    }

    onOpenReturn(publicId, triggerRef.current);
  };

  const openForward = () => {
    if (
      (shipment.status !== "delivery_failed" &&
        shipment.status !== "pending_return") ||
      !capabilities.canOpenForwardModal ||
      !hasPublicId ||
      !onOpenForward
    ) {
      return;
    }

    onOpenForward(publicId, triggerRef.current);
  };

  if (
    shipment.status !== "pending_return" &&
    shipment.status !== "delivery_failed"
  ) {
    return (
      <span className="text-xs text-muted-foreground" role="status">
        Không có thao tác
      </span>
    );
  }

  const returnUnavailableReason = getUnavailableReason(
    hasPublicId,
    capabilities.canOpenReturnModal,
    typeof onOpenReturn === "function",
    capabilities.unavailableReason,
    "Chuyển hoàn",
  );
  const forwardUnavailableReason = getUnavailableReason(
    hasPublicId,
    capabilities.canOpenForwardModal,
    typeof onOpenForward === "function",
    capabilities.unavailableReason,
    "Chuyển tiếp",
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={triggerLabel}
        >
          <Ellipsis className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuLabel>Thao tác vận đơn</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {shipment.status === "pending_return" && (
          <>
            <ActionMenuItem
              icon={RotateCcw}
              label="Duyệt tiếp tục giao lại"
              disabled
              unavailableReason="Chưa có API contract duyệt tiếp tục giao lại."
            />
            <ActionMenuItem
              icon={Truck}
              label="Mở xem trước chuyển hoàn"
              disabled={!canOpenReturn}
              unavailableReason={returnUnavailableReason}
              onSelect={openReturn}
            />
            <ActionMenuItem
              icon={Forward}
              label="Mở xem trước chuyển tiếp"
              disabled={!canOpenForward}
              unavailableReason={forwardUnavailableReason}
              onSelect={openForward}
            />
          </>
        )}

        {shipment.status === "delivery_failed" && (
          <ActionMenuItem
            icon={Forward}
            label="Mở xem trước chuyển tiếp"
            disabled={!canOpenForward}
            unavailableReason={forwardUnavailableReason}
            onSelect={openForward}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
