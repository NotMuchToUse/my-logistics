import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ApiErrorResponse } from "@/types/api.types";
import {
  confirmOutboundDeliveryReceiptApi,
  createOutboundDeliveryReceiptApi,
  fetchOutboundDeliveryBootstrapApi,
  removeOutboundDeliveryItemApi,
  scanOutboundDeliveryShipmentApi,
} from "../api/warehouse-outbound-delivery.api";
import type {
  AvailableDeliveryShipment,
  DeliveryDriverOption,
  OutboundDeliveryBootstrapData,
  OutboundDeliveryReceipt,
  OutboundDeliveryReceiptItem,
} from "../types/warehouse-outbound-delivery.types";

export interface ScanFeedbackState {
  type: "success" | "error";
  code: string;
  message: string;
  timestamp: string;
}

function isApiError(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "success" in error &&
    error.success === false &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  );
}

function parseError(error: unknown): { code?: string; message: string } {
  if (isApiError(error)) {
    return {
      code: error.error.code,
      message: error.error.message,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Đã xảy ra lỗi không xác định trong quá trình xử lý." };
}

/**
 * Quản lý toàn bộ trạng thái và thao tác nghiệp vụ Xuất kho Giao hàng (tạo phiếu, gán tài xế, quét barcode, gỡ đơn, chốt phiếu).
 */
export function useWarehouseOutboundDelivery(warehouseId?: number | null) {
  const [bootstrapData, setBootstrapData] =
    useState<OutboundDeliveryBootstrapData | null>(null);
  const [activeDraft, setActiveDraft] =
    useState<OutboundDeliveryReceipt | null>(null);
  const [lastConfirmedReceipt, setLastConfirmedReceipt] =
    useState<OutboundDeliveryReceipt | null>(null);

  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [draftNote, setDraftNote] = useState<string>("");
  const [scanCode, setScanCode] = useState<string>("");
  const [lastScanFeedback, setLastScanFeedback] =
    useState<ScanFeedbackState | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreatingDraft, setIsCreatingDraft] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isRemovingItem, setIsRemovingItem] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBootstrap = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchOutboundDeliveryBootstrapApi(warehouseId);
      const data = response.data;
      setBootstrapData(data);
      setActiveDraft(data.active_draft);

      if (data.active_draft) {
        setSelectedDriverId(data.active_draft.driver_id);
        setDraftNote(data.active_draft.note ?? "");
      } else {
        setSelectedDriverId((previous) => {
          if (
            previous !== null &&
            data.drivers.some((driver) => driver.id === previous && driver.is_active)
          ) {
            return previous;
          }
          return data.drivers.find((driver) => driver.is_active)?.id ?? null;
        });
      }
    } catch (error) {
      const parsed = parseError(error);
      setErrorMessage(parsed.message);
    } finally {
      setIsLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const createDraft = useCallback(
    async (driverId: number, note?: string): Promise<boolean> => {
      if (!bootstrapData) {
        return false;
      }

      setIsCreatingDraft(true);
      setErrorMessage(null);
      try {
        const response = await createOutboundDeliveryReceiptApi({
          warehouse_id: bootstrapData.warehouse.id,
          driver_id: driverId,
          ...(note && note.trim() ? { note: note.trim() } : {}),
        });
        setActiveDraft(response.data);
        setSelectedDriverId(response.data.driver_id);
        setDraftNote(response.data.note ?? "");
        setLastConfirmedReceipt(null);
        setLastScanFeedback(null);
        toast.success(response.message);
        return true;
      } catch (error) {
        const parsed = parseError(error);
        setErrorMessage(parsed.message);
        toast.error(parsed.message);
        return false;
      } finally {
        setIsCreatingDraft(false);
      }
    },
    [bootstrapData],
  );

  const scanShipment = useCallback(
    async (rawTrackingCode?: string): Promise<boolean> => {
      const code = (rawTrackingCode ?? scanCode).trim().toUpperCase();
      if (!code) {
        return false;
      }

      if (!activeDraft) {
        const message = "Vui lòng chọn tài xế và khởi tạo phiếu xuất giao trước khi quét đơn.";
        setLastScanFeedback({
          type: "error",
          code,
          message,
          timestamp: new Date().toISOString(),
        });
        toast.error(message);
        return false;
      }

      setIsScanning(true);
      setErrorMessage(null);
      try {
        const response = await scanOutboundDeliveryShipmentApi(
          activeDraft.public_id,
          { tracking_code: code },
        );
        setActiveDraft(response.data);
        setScanCode("");
        setLastScanFeedback({
          type: "success",
          code,
          message: response.message,
          timestamp: new Date().toISOString(),
        });
        toast.success(response.message);
        return true;
      } catch (error) {
        const parsed = parseError(error);
        setLastScanFeedback({
          type: "error",
          code,
          message: parsed.message,
          timestamp: new Date().toISOString(),
        });
        toast.error(parsed.message);
        return false;
      } finally {
        setIsScanning(false);
      }
    },
    [activeDraft, scanCode],
  );

  const removeItem = useCallback(
    async (itemId: number, removeReason: string): Promise<boolean> => {
      if (!activeDraft) {
        return false;
      }

      setIsRemovingItem(true);
      setErrorMessage(null);
      try {
        const response = await removeOutboundDeliveryItemApi(
          activeDraft.public_id,
          {
            item_id: itemId,
            remove_reason: removeReason,
            version: activeDraft.version,
          },
        );
        setActiveDraft(response.data);
        toast.success(response.message);
        return true;
      } catch (error) {
        const parsed = parseError(error);
        toast.error(parsed.message);
        if (parsed.code === "409_VERSION_CONFLICT") {
          void loadBootstrap();
        }
        return false;
      } finally {
        setIsRemovingItem(false);
      }
    },
    [activeDraft, loadBootstrap],
  );

  const confirmReceipt = useCallback(
    async (note?: string): Promise<boolean> => {
      if (!activeDraft) {
        return false;
      }

      setIsConfirming(true);
      setErrorMessage(null);
      try {
        const response = await confirmOutboundDeliveryReceiptApi(
          activeDraft.public_id,
          {
            ...(note && note.trim() ? { note: note.trim() } : {}),
            version: activeDraft.version,
          },
        );
        const confirmed = response.data;
        setActiveDraft(null);
        setLastConfirmedReceipt(confirmed);
        setLastScanFeedback(null);
        setDraftNote("");

        const confirmedIds = new Set(
          confirmed.items
            .filter((item) => item.removed_at === null)
            .map((item) => item.shipment_id),
        );

        setBootstrapData((previous) => {
          if (!previous) {
            return previous;
          }
          return {
            ...previous,
            active_draft: null,
            available_shipments: previous.available_shipments.filter(
              (shipment) => !confirmedIds.has(shipment.shipment_id),
            ),
            drivers: previous.drivers.map((driver) =>
              driver.id === confirmed.driver_id
                ? {
                    ...driver,
                    active_delivery_count:
                      driver.active_delivery_count + confirmedIds.size,
                  }
                : driver,
            ),
            recent_confirmed: [confirmed, ...previous.recent_confirmed],
          };
        });

        toast.success(response.message);
        return true;
      } catch (error) {
        const parsed = parseError(error);
        setErrorMessage(parsed.message);
        toast.error(parsed.message);
        if (parsed.code === "409_VERSION_CONFLICT") {
          void loadBootstrap();
        }
        return false;
      } finally {
        setIsConfirming(false);
      }
    },
    [activeDraft, loadBootstrap],
  );

  const activeItems = useMemo<OutboundDeliveryReceiptItem[]>(
    () => activeDraft?.items.filter((item) => item.removed_at === null) ?? [],
    [activeDraft],
  );

  const removedItems = useMemo<OutboundDeliveryReceiptItem[]>(
    () => activeDraft?.items.filter((item) => item.removed_at !== null) ?? [],
    [activeDraft],
  );

  const selectedDriver = useMemo<DeliveryDriverOption | null>(() => {
    if (!bootstrapData) {
      return null;
    }
    const targetDriverId = activeDraft?.driver_id ?? selectedDriverId;
    if (targetDriverId === null) {
      return null;
    }
    return (
      bootstrapData.drivers.find((driver) => driver.id === targetDriverId) ??
      null
    );
  }, [bootstrapData, activeDraft, selectedDriverId]);

  const unscannedAvailableShipments = useMemo<AvailableDeliveryShipment[]>(() => {
    if (!bootstrapData) {
      return [];
    }
    const activeShipmentIds = new Set(
      activeItems.map((item) => item.shipment_id),
    );
    return bootstrapData.available_shipments.filter(
      (shipment) => !activeShipmentIds.has(shipment.shipment_id),
    );
  }, [bootstrapData, activeItems]);

  return {
    bootstrapData,
    activeDraft,
    lastConfirmedReceipt,
    selectedDriverId,
    setSelectedDriverId,
    selectedDriver,
    draftNote,
    setDraftNote,
    scanCode,
    setScanCode,
    lastScanFeedback,
    activeItems,
    removedItems,
    unscannedAvailableShipments,
    isLoading,
    isCreatingDraft,
    isScanning,
    isRemovingItem,
    isConfirming,
    errorMessage,
    refetch: loadBootstrap,
    createDraft,
    scanShipment,
    removeItem,
    confirmReceipt,
  };
}
