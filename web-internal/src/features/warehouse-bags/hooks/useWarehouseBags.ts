import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getScopeKey, useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import {
  warehouseBagsApi,
  WarehouseBagsContractBlockedError,
} from "../api/warehouse-bags.api";
import type { BagFixtureErrorName } from "../api/warehouse-bags.api";
import { bagClosingFormSchema } from "../warehouse-bags.schema";
import type { BagClosingFormValues, BagLookupFormValues } from "../warehouse-bags.types";
import type { WarehouseBagsDemoService } from "../demo/warehouse-bags-demo.service";

type Service = typeof warehouseBagsApi;
type ReadStatus = "idle" | "loading" | "success" | "empty" | "error" | "blocked";
export interface BagReadError {
  kind: "blocked" | "data" | "network" | "timeout" | "server" | "unknown";
  message: string;
  code?: string;
  details?: unknown;
}

function readError(error: unknown): BagReadError {
  if (error instanceof WarehouseBagsContractBlockedError) {
    return { kind: "blocked", message: error.message };
  }
  if (typeof error === "object" && error !== null) {
    if ("error" in error && typeof error.error === "object" && error.error !== null) {
      const value = error.error;
      if ("code" in value && typeof value.code === "string" && "message" in value && typeof value.message === "string") {
        return { kind: value.code.startsWith("5") ? "server" : "data", code: value.code,
          message: value.message, details: "details" in value ? value.details : undefined };
      }
    }
    // Chỉ phân loại khi nguồn lỗi cung cấp dấu hiệu transport rõ ràng.
    if ("code" in error && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")) {
      return { kind: "timeout", message: "Tra cứu quá thời gian chờ." };
    }
    if ("code" in error && error.code === "ERR_NETWORK") {
      return { kind: "network", message: "Không thể kết nối mạng." };
    }
  }
  return { kind: "unknown", message: "Không thể đọc dữ liệu. Vui lòng thử lại." };
}

function useReadSlot<T>(context: string, service: Service) {
  const [state, setState] = useState<{
    context: string; service: Service; status: ReadStatus; data: T | null; error: BagReadError | null;
  }>({ context, service, status: "idle", data: null, error: null });
  const lifecycle = useRef({ active: false, context, service, sequence: 0 });
  useLayoutEffect(() => {
    const current = lifecycle.current;
    current.active = true;
    current.context = context;
    current.service = service;
    current.sequence++;
    setState({ context, service, status: "idle", data: null, error: null });
    return () => { current.active = false; current.sequence++; };
  }, [context, service]);

  const reset = useCallback(() => {
    const current = lifecycle.current;
    if (!current.active || current.context !== context || current.service !== service) return;
    current.sequence++;
    setState({ context, service, status: "idle", data: null, error: null });
  }, [context, service]);

  const run = useCallback(async (load: () => Promise<T>, isEmpty: (data: T) => boolean = () => false) => {
    const current = lifecycle.current;
    if (!current.active || current.context !== context || current.service !== service) return null;
    const sequence = ++current.sequence;
    const valid = () => current.active && current.sequence === sequence && current.context === context && current.service === service;
    setState({ context, service, status: "loading", data: null, error: null });
    try {
      const data = await load();
      if (!valid()) return null;
      setState({ context, service, status: isEmpty(data) ? "empty" : "success", data, error: null });
      return data;
    } catch (error) {
      if (!valid()) return null;
      const failure = readError(error);
      setState({ context, service, status: failure.kind === "blocked" ? "blocked" : "error", data: null, error: failure });
      return null;
    }
  }, [context, service]);
  const visible = state.context === context && state.service === service
    ? state : { status: "idle" as const, data: null, error: null };
  return { status: visible.status, data: visible.data, error: visible.error, run, reset };
}

type Dataset = Awaited<ReturnType<Service["readFixtureDataset"]>>["data"];
type BagDetail = Awaited<ReturnType<Service["findBag"]>>["data"];
type Shipment = Awaited<ReturnType<Service["findShipment"]>>["data"];
type SampleError = unknown;
const emptyForm = (): BagClosingFormValues => ({ destination_warehouse_id: "", seal_number: "" });
const emptyLookup = (): BagLookupFormValues => ({ lookupBy: "bag_code", value: "" });

export function useWarehouseBags(service: Service = warehouseBagsApi) {
  const activeScope = useBranchScopeStore((state) => state.activeScope);
  const branchId = useBranchScopeStore((state) => state.activeBranchId);
  const warehouseId = useBranchScopeStore((state) => state.activeWarehouseId);
  const context = `${activeScope ? getScopeKey(activeScope) : "none"}:${branchId}:${warehouseId}`;
  const [closingForm, setClosingForm] = useState(emptyForm);
  const [trackingCode, setTrackingCode] = useState("");
  const [bagLookup, setBagLookup] = useState(emptyLookup);
  const dataset = useReadSlot<Dataset>(context, service);
  const bag = useReadSlot<BagDetail>(context, service);
  const shipment = useReadSlot<Shipment>(context, service);
  const errorSample = useReadSlot<SampleError>(context, service);

  useLayoutEffect(() => {
    setClosingForm(emptyForm());
    setTrackingCode("");
    setBagLookup(emptyLookup());
  }, [context, service]);

  const refetch = useCallback(() => dataset.run(async () => {
    const [data, list] = await Promise.all([service.readFixtureDataset(), service.listBags()]);
    return { ...data.data, manifest_bags: list.data };
  }, (data) => data.manifest_bags.length === 0), [dataset.run, service]);
  useEffect(() => { void refetch(); }, [refetch]);

  const lookupBag = useCallback((input: BagLookupFormValues = bagLookup) =>
    bag.run(async () => (await service.findBag(input)).data), [bag.run, bagLookup, service]);
  const lookupShipment = useCallback(async (code: string = trackingCode) => {
    const result = await shipment.run(async () => (await service.findShipment(code)).data);
    // Không xóa mã mới mà người dùng đã nhập trong khi đợi kết quả mã trước.
    if (result) setTrackingCode((current) => current === code ? "" : current);
    return result;
  }, [shipment.run, trackingCode, service]);
  const readErrorFixture = useCallback((name: BagFixtureErrorName) =>
    errorSample.run(() => service.readErrorFixture(name)), [errorSample.run, service]);
  const resetLookup = useCallback(() => {
    bag.reset(); shipment.reset(); errorSample.reset();
    setBagLookup(emptyLookup()); setTrackingCode("");
  }, [bag.reset, shipment.reset, errorSample.reset]);

  return {
    context: { branchId, warehouseId },
    closingForm, setClosingForm,
    validateClosingForm: () => bagClosingFormSchema.safeParse(closingForm),
    trackingCode, setTrackingCode, bagLookup, setBagLookup,
    dataset, bag, shipment, errorSample,
    warehouses: dataset.data?.warehouses ?? [],
    bags: dataset.data?.manifest_bags ?? [],
    bagShipments: bag.data?.shipments ?? [],
    confirmedWeightGram: null,
    mutationsBlocked: true,
    mutationBlockReason: "Chưa xác nhận contract, quyền và điều kiện tạo/thêm đơn/niêm phong/mở túi.",
    refetch, lookupBag, lookupShipment, readErrorFixture, resetLookup,
  };
}

export function useWarehouseBagsDemo(service: WarehouseBagsDemoService) {
  const context = "warehouse-bags-demo";
  const [closingForm, setClosingForm] = useState(emptyForm);
  const [trackingCode, setTrackingCode] = useState("");
  const [bagLookup, setBagLookup] = useState(emptyLookup);
  const dataset = useReadSlot<Dataset>(context, warehouseBagsApi);
  const bag = useReadSlot<BagDetail>(context, warehouseBagsApi);
  const shipment = useReadSlot<Shipment>(context, warehouseBagsApi);
  const errorSample = useReadSlot<SampleError>(context, warehouseBagsApi);
  const [demo] = useState(() => service.createSession());
  const [, refresh] = useState(0);

  const load = useCallback(() => dataset.run(async () => {
    const [data, list] = await Promise.all([demo.readFixtureDataset(), demo.listBags()]);
    return { ...data.data, manifest_bags: list.data };
  }, (value) => value.manifest_bags.length === 0), [dataset.run, demo]);
  useEffect(() => { void load(); }, [load]);

  const lookupShipment = useCallback(async (code = trackingCode) => {
    const result = await shipment.run(async () => (await demo.findShipment(code)).data);
    if (result) setTrackingCode((current) => current === code ? "" : current);
    return result;
  }, [demo, shipment.run, trackingCode]);
  const lookupBag = useCallback((input: BagLookupFormValues = bagLookup) =>
    bag.run(async () => (await demo.findBag(input)).data), [bag.run, bagLookup, demo]);
  const refreshData = useCallback(async (lookup?: BagLookupFormValues) => {
    refresh((value) => value + 1);
    await load();
    if (lookup) await lookupBag(lookup);
  }, [load, lookupBag]);
  const addShipment = useCallback(async (code = shipment.data?.tracking_code) => {
    if (!code) return null;
    try {
      const result = await demo.addShipment(closingForm.seal_number, closingForm.destination_warehouse_id, code);
      await refreshData({ lookupBy: "seal_number", value: closingForm.seal_number });
      return result;
    } catch (error) {
      const failure = readError(error);
      return { success: false as const, error: failure };
    }
  }, [closingForm, demo, refreshData, shipment.data]);
  const sealBag = useCallback(async () => {
    const result = await demo.sealBag(closingForm.seal_number);
    if (result) await refreshData({ lookupBy: "seal_number", value: closingForm.seal_number });
    return result;
  }, [closingForm.seal_number, demo, refreshData]);
  const openBag = useCallback(async () => {
    const publicId = bag.data?.bag.public_id;
    if (!publicId) return null;
    const result = await demo.openBag(publicId);
    if (result && bagLookup.value) await refreshData(bagLookup);
    return result;
  }, [bag.data, bagLookup, demo, refreshData]);
  const removeShipment = useCallback(async (code: string) => {
    const result = await demo.removeShipment(closingForm.seal_number, code);
    await refreshData({ lookupBy: "seal_number", value: closingForm.seal_number });
    return result;
  }, [closingForm.seal_number, demo, refreshData]);
  const resetDemo = useCallback(() => {
    demo.reset(); refresh((value) => value + 1); setClosingForm(emptyForm()); setTrackingCode(""); setBagLookup(emptyLookup());
    void load(); bag.reset(); shipment.reset(); errorSample.reset();
  }, [bag.reset, demo, errorSample.reset, load, shipment.reset]);
  const resetLookup = useCallback(() => {
    bag.reset(); shipment.reset(); errorSample.reset(); setBagLookup(emptyLookup()); setTrackingCode("");
  }, [bag.reset, errorSample.reset, shipment.reset]);
  const readErrorFixture = useCallback((name: BagFixtureErrorName) => errorSample.run(() => demo.readErrorFixture(name)), [demo, errorSample.run]);

  return {
    context: { branchId: 101 as number | null, warehouseId: 101 as number | null },
    closingForm, setClosingForm, validateClosingForm: () => bagClosingFormSchema.safeParse(closingForm),
    trackingCode, setTrackingCode, bagLookup, setBagLookup,
    dataset, bag, shipment, errorSample,
    warehouses: dataset.data?.warehouses ?? [], bags: dataset.data?.manifest_bags ?? [],
    bagShipments: bag.data?.shipments ?? [],
    confirmedWeightGram: (bag.data ? demo.getDemoWeight(bag.data.bag.public_id) : null) as number | null,
    mutationsBlocked: false, mutationBlockReason: "DEMO ONLY — dữ liệu và thao tác giả lập, không phải quy tắc nghiệp vụ.",
    refetch: load, lookupBag, lookupShipment, readErrorFixture, resetLookup,
    addShipment, removeShipment, sealBag, openBag, resetDemo,
    demoShipments: demo.getCurrentShipments(closingForm.seal_number),
    demoWeightGram: demo.getDemoWeightBySeal(closingForm.seal_number),
  };
}
