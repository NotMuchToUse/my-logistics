import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateLoadSummary,
  warehouseOutboundLinehaulApi,
} from "../api/warehouse-outbound-linehaul.api";
import { mawbNumberSchema } from "../schemas/warehouse-outbound-linehaul.schema";
import type {
  OutboundDraftConfirmation,
  OutboundLinehaulDataset,
  OutboundScannedItem,
  OutboundTransportMode,
} from "../types/warehouse-outbound-linehaul.types";

export function useWarehouseOutboundLinehaul(activeWarehouseId: number | null) {
  const [dataset, setDataset] = useState<OutboundLinehaulDataset | null>(null);
  const [items, setItems] = useState<OutboundScannedItem[]>([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>(1);
  const [transportMode, setTransportMode] = useState<OutboundTransportMode>("vehicle");
  const [vehicleId, setVehicleId] = useState<number | null>(3301);
  const [partnerId, setPartnerId] = useState<number | null>(3201);
  const [mawbNumber, setMawbNumber] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmation, setConfirmation] = useState<OutboundDraftConfirmation | null>(null);

  useEffect(() => {
    let active = true;
    void warehouseOutboundLinehaulApi.readDataset().then((response) => {
      if (!active) return;
      setDataset(response.data);
      setItems([]);
      setConfirmation(null);
      setErrorMessage(null);
      const originId = activeWarehouseId === null
        ? 2
        : response.data.warehouses.some(
            (warehouse) => warehouse.id === activeWarehouseId,
          )
          ? activeWarehouseId
          : null;
      const firstTarget = response.data.warehouses.find(
        (warehouse) => warehouse.id !== originId,
      );
      if (firstTarget) setTargetWarehouseId(firstTarget.id);
      setIsLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setErrorMessage(error instanceof Error ? error.message : "Không tải được dữ liệu demo.");
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [activeWarehouseId]);

  useEffect(() => {
    setItems((current) => current.map((item) => ({
      ...item,
      is_wrong_route: item.expected_next_hop_warehouse_id !== targetWarehouseId,
    })));
  }, [targetWarehouseId]);

  const originWarehouseId = dataset === null
    ? null
    : activeWarehouseId === null
      ? 2
      : dataset.warehouses.some((warehouse) => warehouse.id === activeWarehouseId)
        ? activeWarehouseId
        : null;
  const originWarehouse = dataset?.warehouses.find(
    (warehouse) => warehouse.id === originWarehouseId,
  ) ?? null;
  const selectedVehicle = dataset?.vehicles.find(
    (vehicle) => vehicle.id === vehicleId && vehicle.status === "available",
  ) ?? null;
  const selectedPartner = dataset?.partners.find(
    (partner) => partner.id === partnerId && partner.is_active === 1,
  ) ?? null;
  const maxPayloadKg = transportMode === "vehicle"
    ? selectedVehicle?.max_payload_kg ?? "0"
    : "0";
  const loadSummary = useMemo(
    () => calculateLoadSummary(items, maxPayloadKg),
    [items, maxPayloadKg],
  );
  const isMawbRequired = transportMode === "partner"
    && selectedPartner?.partner_type === "airline_agent";
  const isMawbValid = !isMawbRequired || mawbNumberSchema.safeParse(mawbNumber).success;
  const canConfirm = Boolean(
    dataset
      && items.length > 0
      && originWarehouseId !== null
      && targetWarehouseId !== originWarehouseId
      && !loadSummary.is_overloaded
      && (transportMode === "vehicle" ? selectedVehicle : selectedPartner)
      && isMawbValid,
  );

  const addScannedCode = useCallback(async (value = scanCode) => {
    if (originWarehouseId === null) {
      setErrorMessage("Kho hiện tại không có trong dữ liệu mô phỏng.");
      return;
    }
    setErrorMessage(null);
    try {
      const item = await warehouseOutboundLinehaulApi.scanCode(
        value,
        originWarehouseId,
        targetWarehouseId,
      );
      if (items.some((current) => current.item_key === item.item_key)) {
        throw new Error("Mã này đã có trong phiếu nháp.");
      }
      setItems((current) => [...current, item]);
      setScanCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể quét mã.");
    }
  }, [items, originWarehouseId, scanCode, targetWarehouseId]);

  const removeItem = useCallback((itemKey: string) => {
    setItems((current) => current.filter((item) => item.item_key !== itemKey));
  }, []);

  const confirmDraft = useCallback(() => {
    if (!canConfirm) {
      setErrorMessage("Kiểm tra kho nhận, phương tiện/đối tác, MAWB và tải trọng trước khi chốt.");
      return;
    }
    setConfirmation({
      receipt_code: `DEMO-OUT-${Date.now()}`,
      confirmed_at: new Date().toISOString(),
      item_count: items.length,
      total_weight_gram: loadSummary.total_weight_gram,
    });
  }, [canConfirm, items.length, loadSummary.total_weight_gram]);

  const resetDraft = useCallback(() => {
    setItems([]);
    setConfirmation(null);
    setErrorMessage(null);
    setScanCode("");
  }, []);

  return {
    dataset,
    items,
    originWarehouse,
    originWarehouseId,
    targetWarehouseId,
    setTargetWarehouseId,
    transportMode,
    setTransportMode,
    vehicleId,
    setVehicleId,
    selectedVehicle,
    partnerId,
    setPartnerId,
    selectedPartner,
    mawbNumber,
    setMawbNumber,
    isMawbRequired,
    isMawbValid,
    scanCode,
    setScanCode,
    addScannedCode,
    removeItem,
    confirmDraft,
    resetDraft,
    loadSummary,
    canConfirm,
    confirmation,
    errorMessage,
    isLoading,
  };
}
