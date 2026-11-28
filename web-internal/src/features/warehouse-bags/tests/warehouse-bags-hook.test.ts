import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, createElement } from "react";
import { useWarehouseBags } from "../hooks/useWarehouseBags";
import { createWarehouseBagsService } from "../api/warehouse-bags.api";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import fixture from "../../../mocks/warehouse-bags.mock.json";

type Service = ReturnType<typeof createWarehouseBagsService>;
const service = () => createWarehouseBagsService({ useMock: true });
const bagCode = { lookupBy: "bag_code", value: "UI-BAG-001" } as const;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function ready(api = service()) {
  const hook = renderHook(() => useWarehouseBags(api));
  await waitFor(() => expect(hook.result.current.dataset.status).toBe("success"));
  return hook;
}
beforeEach(() => useBranchScopeStore.getState().clearScopes());
afterEach(() => { cleanup(); vi.restoreAllMocks(); useBranchScopeStore.getState().clearScopes(); });

describe("React hook warehouse-bags (jsdom, fixture read only)", () => {
  it("khởi tạo, tải dữ liệu, validate form và giữ nguyên Seal", async () => {
    const hook = await ready();
    expect(hook.result.current.closingForm).toEqual({ seal_number: "", destination_warehouse_id: "" });
    expect(hook.result.current.validateClosingForm().success).toBe(false);
    expect(hook.result.current.bag.status).toBe("idle");
    expect(hook.result.current.bagShipments).toEqual([]);
    expect(hook.result.current.bags).toHaveLength(5);
    act(() => hook.result.current.setClosingForm({ seal_number: "000-SEAL/1", destination_warehouse_id: "102" }));
    expect(hook.result.current.validateClosingForm().success).toBe(true);
    expect(hook.result.current.closingForm.seal_number).toBe("000-SEAL/1");
    act(() => hook.result.current.setClosingForm({ seal_number: "a".repeat(41), destination_warehouse_id: "102" }));
    expect(hook.result.current.validateClosingForm().success).toBe(false);
  });

  it("tra cứu vận đơn liên tục chỉ đọc, xóa ô mã thành công, không tăng số đơn/trọng lượng", async () => {
    const api = service();
    const before = await api.readFixtureDataset();
    const hook = await ready(api);
    for (const code of ["UI-VS-0001", "UI-VS-0002", "UI-VS-0002"]) {
      act(() => hook.result.current.setTrackingCode(code));
      await act(async () => { await hook.result.current.lookupShipment(); });
      expect(hook.result.current.shipment.data?.tracking_code).toBe(code);
      expect(hook.result.current.trackingCode).toBe("");
    }
    expect(hook.result.current.bags).toEqual(before.data.manifest_bags);
    expect(hook.result.current.confirmedWeightGram).toBeNull();
    expect(hook.result.current.mutationsBlocked).toBe(true);
    expect(hook.result.current).not.toHaveProperty("sealBag");
    expect(hook.result.current).not.toHaveProperty("openBag");
    expect(await api.readFixtureDataset()).toEqual(before);
  });

  it("tra cứu bag_code/Seal, thay mã lỗi xóa túi cũ, reset lookup", async () => {
    const hook = await ready();
    await act(async () => { await hook.result.current.lookupBag(bagCode); });
    expect(hook.result.current.bag.data?.bag.bag_code).toBe(bagCode.value);
    expect(hook.result.current.bagShipments).toHaveLength(1);
    act(() => hook.result.current.setBagLookup({ lookupBy: "seal_number", value: "000-SEAL/2" }));
    await act(async () => { await hook.result.current.lookupBag(); });
    expect(hook.result.current.bag.data?.bag.seal_number).toBe("000-SEAL/2");
    await act(async () => { await hook.result.current.lookupBag({ lookupBy: "bag_code", value: "MISSING" }); });
    expect(hook.result.current.bag.data).toBeNull();
    expect(hook.result.current.bagShipments).toEqual([]);
    expect(hook.result.current.bag.error?.code).toBe("404_NOT_FOUND");
    act(() => hook.result.current.resetLookup());
    expect(hook.result.current.bag.status).toBe("idle");
    expect(hook.result.current.bagLookup.value).toBe("");
  });

  it("loading/empty/refetch độc lập và lỗi vận đơn giữ form", async () => {
    const api = createWarehouseBagsService({ useMock: true, scenario: "empty" });
    const hook = renderHook(() => useWarehouseBags(api));
    await waitFor(() => expect(hook.result.current.dataset.status).toBe("empty"));
    expect(hook.result.current.bags).toEqual([]);
    act(() => hook.result.current.setTrackingCode("MISSING"));
    await act(async () => { await hook.result.current.lookupShipment(); });
    expect(hook.result.current.shipment.error?.code).toBe("404_NOT_FOUND");
    expect(hook.result.current.trackingCode).toBe("MISSING");
    await act(async () => { await hook.result.current.lookupShipment(" "); });
    expect(hook.result.current.shipment.error?.code).toBe("422_VALIDATION_ERROR");
    await act(async () => { await hook.result.current.refetch(); });
    expect(hook.result.current.dataset.status).toBe("empty");
  });

  it("phản hồi cũ đến sau không ghi đè kết quả và loading mới", async () => {
    const api = service();
    const first = deferred<Awaited<ReturnType<Service["findBag"]>>>();
    const second = deferred<Awaited<ReturnType<Service["findBag"]>>>();
    const resultA = await api.findBag(bagCode);
    const resultB = await api.findBag({ lookupBy: "seal_number", value: "000-SEAL/2" });
    vi.spyOn(api, "findBag").mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const hook = await ready(api);
    let pendingA!: ReturnType<typeof hook.result.current.lookupBag>;
    let pendingB!: typeof pendingA;
    act(() => { pendingA = hook.result.current.lookupBag(bagCode); });
    expect(hook.result.current.bag.status).toBe("loading");
    act(() => { pendingB = hook.result.current.lookupBag({ lookupBy: "seal_number", value: "000-SEAL/2" }); });
    await act(async () => { second.resolve(resultB); await pendingB; });
    await act(async () => { first.resolve(resultA); expect(await pendingA).toBeNull(); });
    expect(hook.result.current.bag.data?.bag.seal_number).toBe("000-SEAL/2");
    expect(hook.result.current.bag.status).toBe("success");
    expect(hook.result.current.bag.error).toBeNull();
  });

  it("lỗi của request cũ không kết thúc loading của request mới", async () => {
    const api = service();
    const first = deferred<Awaited<ReturnType<Service["findShipment"]>>>();
    const second = deferred<Awaited<ReturnType<Service["findShipment"]>>>();
    const found = await api.findShipment("UI-VS-0002");
    vi.spyOn(api, "findShipment").mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const hook = await ready(api);
    let one!: ReturnType<typeof hook.result.current.lookupShipment>;
    let two!: typeof one;
    act(() => { one = hook.result.current.lookupShipment("UI-VS-0001"); two = hook.result.current.lookupShipment("UI-VS-0002"); });
    await act(async () => { first.reject(fixture.shipment_not_found_response); await one; });
    expect(hook.result.current.shipment.status).toBe("loading");
    expect(hook.result.current.shipment.error).toBeNull();
    await act(async () => { second.resolve(found); await two; });
    expect(hook.result.current.shipment.data?.tracking_code).toBe("UI-VS-0002");
  });

  it("đổi context store xóa form/kết quả cũ, bỏ request cũ và giữ warehouse_id riêng", async () => {
    const api = service();
    const found = await api.findBag(bagCode);
    const pending = deferred<typeof found>();
    const hook = await ready(api);
    await act(async () => { await hook.result.current.lookupBag(bagCode); });
    vi.spyOn(api, "findBag").mockReturnValueOnce(pending.promise);
    let lookup!: ReturnType<typeof hook.result.current.lookupBag>;
    act(() => {
      hook.result.current.setClosingForm({ seal_number: "000", destination_warehouse_id: "102" });
      hook.result.current.setTrackingCode("OLD");
      lookup = hook.result.current.lookupBag(bagCode);
    });
    act(() => useBranchScopeStore.setState({ activeBranchId: 77, activeWarehouseId: null }));
    expect(hook.result.current.context).toEqual({ branchId: 77, warehouseId: null });
    expect(hook.result.current.closingForm.seal_number).toBe("");
    expect(hook.result.current.trackingCode).toBe("");
    expect(hook.result.current.bag.data).toBeNull();
    await act(async () => { pending.resolve(found); expect(await lookup).toBeNull(); });
    expect(hook.result.current.bag.status).toBe("idle");
    act(() => useBranchScopeStore.setState({ activeWarehouseId: 102 }));
    expect(hook.result.current.context.warehouseId).toBe(102);
    await waitFor(() => expect(hook.result.current.dataset.status).toBe("success"));
  });

  it("unmount vô hiệu request đang chờ", async () => {
    const api = service();
    const found = await api.findShipment("UI-VS-0001");
    const pending = deferred<typeof found>();
    vi.spyOn(api, "findShipment").mockReturnValueOnce(pending.promise);
    const hook = await ready(api);
    let lookup!: ReturnType<typeof hook.result.current.lookupShipment>;
    act(() => { lookup = hook.result.current.lookupShipment("UI-VS-0001"); });
    hook.unmount();
    pending.resolve(found);
    expect(await lookup).toBeNull();
  });

  it("BranchSwitcher switchScope vô hiệu refetch cũ, chỉ nhận dataset mới", async () => {
    useBranchScopeStore.getState().setScopes([
      { scope_type: "warehouse", branch_id: 11, warehouse_id: 101, is_primary: true },
      { scope_type: "warehouse", branch_id: 22, warehouse_id: 102 },
    ]);
    const api = service();
    const original = await api.readFixtureDataset();
    const pending = deferred<typeof original>();
    const hook = await ready(api);
    vi.spyOn(api, "readFixtureDataset").mockReturnValueOnce(pending.promise);
    let refetch!: ReturnType<typeof hook.result.current.refetch>;
    act(() => { refetch = hook.result.current.refetch(); });
    expect(hook.result.current.dataset.status).toBe("loading");
    act(() => useBranchScopeStore.getState().switchScope("warehouse:22:102"));
    await waitFor(() => expect(hook.result.current.dataset.status).toBe("success"));
    await act(async () => {
      pending.resolve({ ...original, data: { ...original.data, warehouses: [] } });
      expect(await refetch).toBeNull();
    });
    expect(hook.result.current.context).toEqual({ branchId: 22, warehouseId: 102 });
    expect(hook.result.current.warehouses).toHaveLength(2);
  });

  it("reset khi đang chờ không cho phản hồi phục hồi kết quả cũ", async () => {
    const api = service();
    const found = await api.findBag(bagCode);
    const pending = deferred<typeof found>();
    vi.spyOn(api, "findBag").mockReturnValueOnce(pending.promise);
    const hook = await ready(api);
    let lookup!: ReturnType<typeof hook.result.current.lookupBag>;
    act(() => { lookup = hook.result.current.lookupBag(bagCode); });
    act(() => hook.result.current.resetLookup());
    await act(async () => { pending.resolve(found); expect(await lookup).toBeNull(); });
    expect(hook.result.current.bag.data).toBeNull();
    expect(hook.result.current.bag.status).toBe("idle");
  });

  it("reset vô hiệu request, không xóa mã mới khi tra cứu cũ xong", async () => {
    const api = service();
    const found = await api.findShipment("UI-VS-0001");
    const pending = deferred<typeof found>();
    vi.spyOn(api, "findShipment").mockReturnValueOnce(pending.promise);
    const hook = await ready(api);
    let lookup!: ReturnType<typeof hook.result.current.lookupShipment>;
    act(() => { hook.result.current.setTrackingCode("UI-VS-0001"); });
    act(() => { lookup = hook.result.current.lookupShipment(); hook.result.current.setTrackingCode("NEW"); });
    await act(async () => { pending.resolve(found); await lookup; });
    expect(hook.result.current.trackingCode).toBe("NEW");
    act(() => hook.result.current.resetLookup());
    expect(hook.result.current.shipment.data).toBeNull();
  });

  it("chế độ thật phản ánh BLOCKED, không fallback", async () => {
    const api = createWarehouseBagsService({ useMock: false });
    const hook = renderHook(() => useWarehouseBags(api));
    await waitFor(() => expect(hook.result.current.dataset.status).toBe("blocked"));
    await act(async () => { await hook.result.current.lookupBag(bagCode); await hook.result.current.lookupShipment("UI-VS-0001"); });
    expect(hook.result.current.bag.status).toBe("blocked");
    expect(hook.result.current.shipment.error?.kind).toBe("blocked");
    expect(hook.result.current.bags).toEqual([]);
  });

  it.each([
    [{ code: "ERR_NETWORK" }, "network"],
    [{ code: "ECONNABORTED" }, "timeout"],
    [fixture.server_error_response, "server"],
    [new Error("unclassified"), "unknown"],
  ])("phân loại lỗi đọc có căn cứ %s", async (failure, kind) => {
    const api = service();
    vi.spyOn(api, "findShipment").mockRejectedValueOnce(failure);
    const hook = await ready(api);
    await act(async () => { await hook.result.current.lookupShipment("UI-VS-0001"); });
    expect(hook.result.current.shipment.error?.kind).toBe(kind);
  });

  it("StrictMode và đọc lỗi mẫu không tạo mutation", async () => {
    const api = service();
    const hook = renderHook(() => useWarehouseBags(api), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    await waitFor(() => expect(hook.result.current.dataset.status).toBe("success"));
    await act(async () => { await hook.result.current.readErrorFixture("version_conflict_response"); });
    expect(hook.result.current.errorSample.data).toEqual(fixture.version_conflict_response);
    expect(hook.result.current.dataset.data).toEqual(fixture.success_response.data);
  });
});
