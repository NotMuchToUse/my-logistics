import { useCallback, useRef } from "react";
import { ForwardShipmentDialog } from "@/features/shipment-exceptions/components/ForwardShipmentDialog";
import { ReturnShipmentDialog } from "@/features/shipment-exceptions/components/ReturnShipmentDialog";
import { ShipmentExceptionsTabs } from "@/features/shipment-exceptions/components/ShipmentExceptionsTabs";
import { useShipmentExceptions } from "@/features/shipment-exceptions/hooks/useShipmentExceptions";

export function ShipmentExceptionsPage() {
  const shipmentExceptions = useShipmentExceptions();
  const { onOpen: openReturnDialog } = shipmentExceptions.returnDialog;
  const { onOpen: openForwardDialog } = shipmentExceptions.forwardDialog;
  const focusReturnRef = useRef<{
    publicId: string;
    trigger: HTMLElement;
  } | null>(null);

  const handleOpenReturn = useCallback(
    (publicId: string, trigger?: HTMLElement | null): boolean => {
      const opened = openReturnDialog(publicId);
      focusReturnRef.current =
        opened && trigger ? { publicId, trigger } : null;
      return opened;
    },
    [openReturnDialog],
  );

  const handleOpenForward = useCallback(
    (publicId: string, trigger?: HTMLElement | null): boolean => {
      const opened = openForwardDialog(publicId);
      focusReturnRef.current =
        opened && trigger ? { publicId, trigger } : null;
      return opened;
    },
    [openForwardDialog],
  );

  const handleDialogCloseAutoFocus = (event: Event) => {
    event.preventDefault();

    const target = focusReturnRef.current;
    focusReturnRef.current = null;

    if (
      !target ||
      !target.trigger.isConnected ||
      (target.trigger instanceof HTMLButtonElement && target.trigger.disabled)
    ) {
      return;
    }

    target.trigger.focus();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Quản lý vận đơn chờ xử lý
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Theo dõi vận đơn giao thất bại, gặp sự cố và vận đơn chờ chuyển hoàn.
        </p>
      </header>

      <ShipmentExceptionsTabs
        activeTab={shipmentExceptions.activeTab}
        capabilities={shipmentExceptions.capabilities}
        dataSource={shipmentExceptions.dataSource}
        errorKind={shipmentExceptions.errorKind}
        isEmpty={shipmentExceptions.isEmpty}
        isError={shipmentExceptions.isError}
        isLoading={shipmentExceptions.isLoading}
        isReadOnlyMockPreview={shipmentExceptions.isReadOnlyMockPreview}
        isRefreshing={shipmentExceptions.isRefreshing}
        isSearchEmpty={shipmentExceptions.isSearchEmpty}
        onOpenForward={handleOpenForward}
        onOpenReturn={handleOpenReturn}
        pagination={shipmentExceptions.pagination}
        refresh={shipmentExceptions.refresh}
        retry={shipmentExceptions.retry}
        searchTerm={shipmentExceptions.searchTerm}
        setActiveTab={shipmentExceptions.setActiveTab}
        setPage={shipmentExceptions.setPage}
        setSearchTerm={shipmentExceptions.setSearchTerm}
        shipments={shipmentExceptions.shipments}
      />

      <ReturnShipmentDialog
        isOpen={shipmentExceptions.returnDialog.isOpen}
        onClose={shipmentExceptions.returnDialog.onClose}
        onCloseAutoFocus={handleDialogCloseAutoFocus}
        unavailableReason={shipmentExceptions.returnDialog.unavailableReason}
        selectedShipment={shipmentExceptions.selectedShipment}
        selectedShipmentPublicId={
          shipmentExceptions.selectedShipmentPublicId
        }
        inheritedInfo={shipmentExceptions.inheritedInfo}
        inheritedInfoStatus={shipmentExceptions.inheritedInfoStatus}
        capabilities={shipmentExceptions.capabilities}
      />

      <ForwardShipmentDialog
        isOpen={shipmentExceptions.forwardDialog.isOpen}
        onClose={shipmentExceptions.forwardDialog.onClose}
        onCloseAutoFocus={handleDialogCloseAutoFocus}
        unavailableReason={shipmentExceptions.forwardDialog.unavailableReason}
        canCreate={shipmentExceptions.forwardDialog.canCreate}
        form={shipmentExceptions.forwardDialog.form}
        formState={shipmentExceptions.forwardDialog.formState}
        validate={shipmentExceptions.forwardDialog.validate}
        selectedShipment={shipmentExceptions.selectedShipment}
        selectedShipmentPublicId={
          shipmentExceptions.selectedShipmentPublicId
        }
        inheritedInfo={shipmentExceptions.inheritedInfo}
        inheritedInfoStatus={shipmentExceptions.inheritedInfoStatus}
        capabilities={shipmentExceptions.capabilities}
        catalogAvailable={shipmentExceptions.catalogAvailable}
        catalogUnavailableReason={
          shipmentExceptions.catalogUnavailableReason
        }
      />
    </div>
  );
}
