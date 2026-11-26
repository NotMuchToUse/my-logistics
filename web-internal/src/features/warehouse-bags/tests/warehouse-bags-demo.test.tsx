import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import fixture from "../../../mocks/warehouse-bags.mock.json";
import axiosClient from "@/core/api/axiosClient";
import { createWarehouseBagsDemoService, isWarehouseBagsDemoEnabled } from "../demo/warehouse-bags-demo.service";
import { useWarehouseBagsDemo } from "../hooks/useWarehouseBags";

const validGate = { isDevelopment: true, useMock: true, demoFlag: "true", isAuthenticated: true, hasToken: true };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("requires every development, mock, explicit flag, and authenticated-session condition", () => {
  expect(isWarehouseBagsDemoEnabled(validGate)).toBe(true);
  for (const key of Object.keys(validGate) as (keyof typeof validGate)[]) {
    const value = key === "demoFlag" ? "false" : false;
    expect(isWarehouseBagsDemoEnabled({ ...validGate, [key]: value })).toBe(false);
  }
  expect(isWarehouseBagsDemoEnabled({ ...validGate, demoFlag: undefined })).toBe(false);
});

it("keeps all demo mutations in an isolated session and supports add, dedupe, remove, seal, open, and reset", async () => {
  const sourceBefore = structuredClone(fixture.success_response.data);
  const service = createWarehouseBagsDemoService();
  const demo = service.createSession();
  const seal = "000-DEMO-9001";
  const code = "UI-VS-0003";
  expect((await demo.readFixtureDataset()).data.manifest_bags).toHaveLength(5);
  await demo.addShipment(seal, "102", code);
  expect(demo.getCurrentShipments(seal).map((row) => row.tracking_code)).toEqual([code]);
  expect(demo.getDemoWeightBySeal(seal)).toBeGreaterThan(0);
  await expect(demo.addShipment(seal, "102", code)).rejects.toMatchObject({ error: { code: "422_VALIDATION_ERROR" } });
  const beforeRemove = await demo.findBag({ lookupBy: "seal_number", value: seal });
  expect(beforeRemove.data.bag.shipment_count).toBe(1);
  await demo.removeShipment(seal, code);
  expect(demo.getCurrentShipments(seal)).toEqual([]);
  expect((await demo.findBag({ lookupBy: "seal_number", value: seal })).data.bag.shipment_count).toBe(0);
  await demo.addShipment(seal, "102", code);
  await demo.sealBag(seal);
  const sealed = await demo.findBag({ lookupBy: "seal_number", value: seal });
  expect(sealed.data.bag.status).toBe("sealed");
  await demo.openBag(sealed.data.bag.public_id);
  expect((await demo.findBag({ lookupBy: "seal_number", value: seal })).data.bag.status).toBe("opened");
  demo.reset();
  expect((await demo.readFixtureDataset()).data.manifest_bags).toHaveLength(5);
  await expect(demo.findBag({ lookupBy: "seal_number", value: seal })).rejects.toMatchObject({ error: { code: "404_NOT_FOUND" } });
  expect(fixture.success_response.data).toEqual(sourceBefore);
});

it("demo hook exposes isolated UI mutations without changing the API fixture", async () => {
  const before = structuredClone(fixture.success_response.data);
  const request = vi.spyOn(axiosClient, "request");
  const hook = renderHook(() => useWarehouseBagsDemo(createWarehouseBagsDemoService()));
  await waitFor(() => expect(hook.result.current.dataset.status).toBe("success"));
  act(() => hook.result.current.setClosingForm({ seal_number: "000-DEMO-9002", destination_warehouse_id: "102" }));
  act(() => hook.result.current.setTrackingCode("UI-VS-0003"));
  await act(async () => { await hook.result.current.lookupShipment(); });
  await act(async () => { await hook.result.current.addShipment("UI-VS-0003"); });
  await waitFor(() => expect(hook.result.current.demoShipments).toHaveLength(1));
  expect(hook.result.current.demoWeightGram).toBeGreaterThan(0);
  await act(async () => { await hook.result.current.sealBag(); });
  await waitFor(() => expect(hook.result.current.bag.data?.bag.status).toBe("sealed"));
  await act(async () => { hook.result.current.setBagLookup({ lookupBy: "seal_number", value: "000-DEMO-9002" }); });
  await act(async () => { await hook.result.current.lookupBag(); });
  expect(hook.result.current.bag.data?.bag.seal_number).toBe("000-DEMO-9002");
  await act(async () => { await hook.result.current.openBag(); });
  await waitFor(() => expect(hook.result.current.bag.data?.bag.status).toBe("opened"));
  act(() => hook.result.current.resetDemo());
  await waitFor(() => expect(hook.result.current.bags).toHaveLength(5));
  expect(hook.result.current.mutationsBlocked).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(fixture.success_response.data).toEqual(before);
});
