import { act, cleanup, renderHook } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { useBranchCodCollection } from "../hooks/useBranchCodCollection";
import * as fixture from "../mocks/branch-cod-collection.mock";
import type { DemoVnd } from "../types/branch-cod-collection.types";

vi.hoisted(() => {
  vi.stubEnv("VITE_USE_MOCK", "true");
});

const originalAuth = useAuthStore.getState();
const originalScopes = useBranchScopeStore.getState();

beforeEach(() => {
  useAuthStore.setState({
    isAuthenticated: true,
    token: "test-session",
    user: { public_id: "TEST-USER", must_change_password: 0 },
    permissions: ["finance.read", "finance.collect"],
  });
  useBranchScopeStore.getState().setScopes([
    { scope_type: "branch", branch_id: 3, warehouse_id: null, is_primary: true },
    { scope_type: "post_office", branch_id: 4, warehouse_id: null },
  ]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.setState(originalAuth, true);
  useBranchScopeStore.setState(originalScopes, true);
});

afterAll(() => vi.unstubAllEnvs());

type HookHandle = { result: { current: ReturnType<typeof useBranchCodCollection> } };

function createDraft(hook: HookHandle, codes = ["DEMO-COD-0001", "DEMO-COD-0003"]): string {
  act(() => {
    expect(hook.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: true });
  });
  act(() => {
    for (const code of codes) {
      expect(hook.result.current.scanBarcode(code)?.type).toBe("added");
    }
    expect(hook.result.current.createCollection()).toEqual({ ok: true });
  });
  const collection = hook.result.current.currentCollection;
  expect(collection?.status).toBe("draft");
  if (!collection) throw new Error("Missing draft collection");
  return collection.id;
}

describe("useBranchCodCollection", () => {
  it("lập và khóa bảng kê demo với tổng và công nợ chính xác", () => {
    const hook = renderHook(() => useBranchCodCollection());
    act(() => {
      expect(hook.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: true });
    });
    act(() => {
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("added");
      expect(hook.result.current.scanBarcode("DEMO-COD-0003")?.type).toBe("added");
    });
    expect(hook.result.current.scannedTotal).toBe(230000);
    act(() => {
      expect(hook.result.current.createCollection()).toEqual({ ok: true });
    });
    const collection = hook.result.current.currentCollection;
    expect(collection).toMatchObject({ status: "draft", totalAmount: 230000 });
    expect(collection?.items).toHaveLength(2);
    expect(collection).not.toBeNull();
    if (!collection) throw new Error("Missing draft collection");
    act(() => {
      expect(hook.result.current.lockCollection(collection.id)).toEqual({ ok: true });
    });
    expect(hook.result.current.currentCollection?.status).toBe("locked");
    expect(hook.result.current.currentDebt?.totalDebt).toBe(65000);
    expect(hook.result.current.currentDebt?.shipments).toHaveLength(2);
  });

  it("không quét thêm sau khi khóa trước khi bắt đầu bảng kê mới", () => {
    const hook = renderHook(() => useBranchCodCollection());
    act(() => {
      expect(hook.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: true });
    });
    act(() => {
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("added");
      expect(hook.result.current.createCollection()).toEqual({ ok: true });
    });
    const collection = hook.result.current.currentCollection;
    expect(collection).not.toBeNull();
    if (!collection) throw new Error("Missing draft collection");
    act(() => {
      expect(hook.result.current.lockCollection(collection.id)).toEqual({ ok: true });
    });
    const scanResults: Array<ReturnType<typeof hook.result.current.scanBarcode>> = [];
    act(() => {
      scanResults.push(hook.result.current.scanBarcode("DEMO-COD-0002"));
    });
    expect.soft(scanResults[0]?.type).not.toBe("added");
    expect.soft(hook.result.current.scanned).toEqual([]);
  });

  it("tính công nợ theo scope, không tính vận đơn đã thu hoặc trùng transaction", () => {
    const hook = renderHook(() => useBranchCodCollection());
    const debts = hook.result.current.driverDebts;
    expect(debts.map(({ driver, totalDebt, shipments }) => [driver.id, totalDebt, shipments.length])).toEqual([
      ["DEMO-DRIVER-A", 295000, 4],
      ["DEMO-DRIVER-B", 183000, 4],
    ]);
    expect(debts.every(({ scope }) => scope.scope_type === "branch" && scope.branch_id === 3)).toBe(true);
    expect(debts[0].shipments.map(({ barcode }) => barcode)).not.toContain("DEMO-COD-0004");
    expect(debts[0].shipments.find(({ barcode }) => barcode === "DEMO-COD-0003")?.codTransactions).toHaveLength(2);
    act(() => {
      expect(hook.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: true });
    });
    expect(hook.result.current.currentDebt).toEqual(hook.result.current.driverDebts[0]);
    act(() => useBranchScopeStore.getState().switchScope("post_office:4:none"));
    expect(hook.result.current.driverDebts.map(({ driver, totalDebt, shipments }) => [driver.id, totalDebt, shipments.length])).toEqual([
      ["DEMO-DRIVER-C", 170000, 3],
      ["DEMO-DRIVER-D", 0, 0],
    ]);
    expect(hook.result.current.driverDebts.every(({ scope }) => scope.scope_type === "post_office" && scope.branch_id === 4)).toBe(true);
    expect(hook.result.current.currentDebt).toBeNull();
    act(() => {
      expect(hook.result.current.selectDriver("DEMO-DRIVER-D")).toEqual({ ok: true });
    });
    expect(hook.result.current.currentDebt).toEqual(hook.result.current.driverDebts[1]);
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["overflow", Number.MAX_SAFE_INTEGER],
  ])("chặn dữ liệu tiền %s khi khởi tạo", (_label, amount) => {
    const data = fixture.createBranchCodCollectionDemoData();
    const badData = data.map((debt, index) => index === 0
      ? {
          ...debt,
          shipments: debt.shipments.map((item, itemIndex) =>
            itemIndex === 0 ? { ...item, amountDue: amount as DemoVnd } : item),
        }
      : debt);
    vi.spyOn(fixture, "createBranchCodCollectionDemoData").mockReturnValue(badData);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const hook = renderHook(() => useBranchCodCollection());
    expect(log).toHaveBeenCalled();
    expect(hook.result.current.error).toBeTruthy();
    expect(hook.result.current.driverDebts).toEqual([]);
    expect(hook.result.current.scannedTotal).toBeNull();
    expect(hook.result.current.createCollection()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("quét barcode liên tục, kiểm tra kết quả từ chối và quét lại sau khi xóa", () => {
    const hook = renderHook(() => useBranchCodCollection());
    act(() => {
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")).toBeNull();
      expect(hook.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: true });
    });
    act(() => {
      expect(hook.result.current.scanBarcode("  DEMO-COD-0001  ")?.type).toBe("added");
      expect(hook.result.current.scanBarcode("DEMO-COD-0002")?.type).toBe("added");
      expect(hook.result.current.scanBarcode("DEMO-COD-0003")?.type).toBe("added");
      expect(hook.result.current.scanBarcode("DEMO-COD-0005")?.type).toBe("added");
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("duplicate");
      expect(hook.result.current.scanBarcode("DEMO-COD-0004")?.type).toBe("not_driver_holding");
      expect(hook.result.current.scanBarcode("DEMO-COD-0006")?.type).toBe("wrong_driver");
      expect(hook.result.current.scanBarcode("DEMO-COD-0010")).toEqual({ type: "not_found" });
      expect(hook.result.current.scanBarcode("DEMO-COD-9999")).toEqual({ type: "not_found" });
      expect(hook.result.current.scanBarcode("demo-cod-0001")?.type).toBe("not_found");
      expect(hook.result.current.scanBarcode("DEMO-COD-1")?.type).toBe("not_found");
      expect(hook.result.current.scanBarcode("   ")?.type).toBe("invalid");
    });
    expect(hook.result.current.scanned.map(({ barcode }) => barcode)).toEqual([
      "DEMO-COD-0001", "DEMO-COD-0002", "DEMO-COD-0003", "DEMO-COD-0005",
    ]);
    expect(hook.result.current.scannedTotal).toBe(295000);
    act(() => {
      expect(hook.result.current.removeScanned("DEMO-SHIPMENT-01")).toEqual({ ok: true });
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("added");
    });
    expect(hook.result.current.scanned).toHaveLength(4);
    expect(hook.result.current.scannedTotal).toBe(295000);
  });

  it("chặn bảng kê rỗng, đổi tài xế và submit trùng; snapshot độc lập", () => {
    const hook = renderHook(() => useBranchCodCollection());
    act(() => {
      expect(hook.result.current.createCollection()).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: true });
      expect(hook.result.current.createCollection()).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("added");
      expect(hook.result.current.selectDriver("DEMO-DRIVER-B")).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.scanBarcode("DEMO-COD-0003")?.type).toBe("added");
      expect(hook.result.current.createCollection()).toEqual({ ok: true });
      expect(hook.result.current.createCollection()).toEqual({ ok: false, reason: "invalid_state" });
    });
    const draft = hook.result.current.currentCollection;
    expect(draft).toMatchObject({ status: "draft", totalAmount: 230000 });
    expect(draft?.items).toHaveLength(2);
    expect(hook.result.current.history).toHaveLength(1);
    act(() => {
      expect(hook.result.current.scanBarcode("DEMO-COD-0002")?.type).toBe("collection_not_draft");
      expect(hook.result.current.removeScanned("DEMO-SHIPMENT-01")).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.clearScanned()).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.startNewCollection()).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.selectDriver("DEMO-DRIVER-B")).toEqual({ ok: false, reason: "invalid_state" });
    });
    expect(hook.result.current.currentCollection).toEqual(draft);
    expect(hook.result.current.scanned).toEqual([]);
    if (!draft) throw new Error("Missing draft collection");
    draft.items[0].codTransactions[0].status = "collected_by_branch";
    expect(hook.result.current.currentCollection?.items[0].codTransactions[0].status).toBe("driver_holding");
    expect(hook.result.current.history[0].items[0].codTransactions[0].status).toBe("driver_holding");
  });

  it("khóa chỉ một lần, giữ lịch sử và không cho ID cũ tác động draft mới", () => {
    const hook = renderHook(() => useBranchCodCollection());
    const otherDebt = structuredClone(hook.result.current.driverDebts[1]);
    const oldId = createDraft(hook);
    act(() => {
      expect(hook.result.current.lockCollection(oldId)).toEqual({ ok: true });
      expect(hook.result.current.lockCollection(oldId)).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.cancelCollection(oldId)).toEqual({ ok: false, reason: "invalid_state" });
    });
    expect(hook.result.current.driverDebts[1]).toEqual(otherDebt);
    expect(hook.result.current.currentDebt?.totalDebt).toBe(65000);
    expect(hook.result.current.currentDebt?.shipments).toHaveLength(2);
    expect(hook.result.current.history[0]).toMatchObject({ id: oldId, status: "locked", totalAmount: 230000 });
    act(() => {
      expect(hook.result.current.startNewCollection()).toEqual({ ok: true });
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("not_driver_holding");
      expect(hook.result.current.scanBarcode("DEMO-COD-0002")?.type).toBe("added");
      expect(hook.result.current.createCollection()).toEqual({ ok: true });
    });
    const newId = hook.result.current.currentCollection?.id;
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(oldId);
    act(() => {
      expect(hook.result.current.lockCollection(oldId)).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.cancelCollection(oldId)).toEqual({ ok: false, reason: "invalid_state" });
    });
    expect(hook.result.current.currentCollection).toMatchObject({ id: newId, status: "draft" });
    expect(hook.result.current.history).toHaveLength(2);
  });

  it("hủy không thay đổi công nợ, giữ lịch sử và giải phóng vận đơn sau khi bắt đầu mới", () => {
    const hook = renderHook(() => useBranchCodCollection());
    const debts = structuredClone(hook.result.current.driverDebts);
    const id = createDraft(hook);
    act(() => {
      expect(hook.result.current.cancelCollection(id)).toEqual({ ok: true });
      expect(hook.result.current.cancelCollection(id)).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.lockCollection(id)).toEqual({ ok: false, reason: "invalid_state" });
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("collection_not_draft");
      expect(hook.result.current.clearScanned()).toEqual({ ok: false, reason: "invalid_state" });
    });
    expect(hook.result.current.driverDebts).toEqual(debts);
    expect(hook.result.current.currentCollection?.status).toBe("cancelled");
    expect(hook.result.current.history).toMatchObject([{ id, status: "cancelled" }]);
    act(() => {
      expect(hook.result.current.startNewCollection()).toEqual({ ok: true });
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")?.type).toBe("added");
    });
    expect(hook.result.current.scanned.map(({ barcode }) => barcode)).toEqual(["DEMO-COD-0001"]);
    expect(hook.result.current.driverDebts).toEqual(debts);
    expect(hook.result.current.history).toMatchObject([{ id, status: "cancelled" }]);
  });

  it("yêu cầu finance.read và chặn mọi thao tác thu với quyền chỉ đọc", () => {
    useAuthStore.setState({ permissions: ["finance.collect"] });
    const denied = renderHook(() => useBranchCodCollection());
    expect(denied.result.current.driverDebts).toEqual([]);
    expect(denied.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: false, reason: "unavailable" });
    expect(denied.result.current.createCollection()).toEqual({ ok: false, reason: "unavailable" });
    denied.unmount();
    useAuthStore.setState({ permissions: ["finance.read"] });
    const readOnly = renderHook(() => useBranchCodCollection());
    expect(readOnly.result.current.driverDebts).toHaveLength(2);
    act(() => {
      expect(readOnly.result.current.selectDriver("DEMO-DRIVER-A")).toEqual({ ok: true });
      expect(readOnly.result.current.scanBarcode("DEMO-COD-0001")).toBeNull();
      expect(readOnly.result.current.createCollection()).toEqual({ ok: false, reason: "unavailable" });
      expect(readOnly.result.current.removeScanned("DEMO-SHIPMENT-01")).toEqual({ ok: false, reason: "unavailable" });
      expect(readOnly.result.current.clearScanned()).toEqual({ ok: false, reason: "unavailable" });
      expect(readOnly.result.current.lockCollection("missing")).toEqual({ ok: false, reason: "unavailable" });
      expect(readOnly.result.current.cancelCollection("missing")).toEqual({ ok: false, reason: "unavailable" });
      expect(readOnly.result.current.startNewCollection()).toEqual({ ok: false, reason: "unavailable" });
    });
    expect(readOnly.result.current.scanned).toEqual([]);
    expect(readOnly.result.current.history).toEqual([]);
  });

  it("từ chối scope không hợp lệ hoặc sai loại", () => {
    useBranchScopeStore.getState().setScopes([
      { scope_type: "warehouse", branch_id: 3, warehouse_id: 1, is_primary: true },
    ]);
    const hook = renderHook(() => useBranchCodCollection());
    expect(hook.result.current.isScopeValid).toBe(false);
    expect(hook.result.current.driverDebts).toEqual([]);
    expect(hook.result.current.createCollection()).toEqual({ ok: false, reason: "unavailable" });
    act(() => useBranchScopeStore.setState({ activeScope: null, activeBranchId: null, activeWarehouseId: null }));
    expect(hook.result.current.driverDebts).toEqual([]);
    expect(hook.result.current.scanBarcode("DEMO-COD-0001")).toBeNull();
  });

  it("đổi scope xóa dữ liệu cũ và vô hiệu callback cũ", () => {
    const hook = renderHook(() => useBranchCodCollection());
    const id = createDraft(hook);
    const oldLock = hook.result.current.lockCollection;
    const oldScan = hook.result.current.scanBarcode;
    act(() => useBranchScopeStore.getState().switchScope("post_office:4:none"));
    expect(hook.result.current.history).toEqual([]);
    expect(hook.result.current.currentCollection).toBeNull();
    expect(hook.result.current.scanned).toEqual([]);
    expect(hook.result.current.driverDebts.map(({ driver }) => driver.id)).toEqual(["DEMO-DRIVER-C", "DEMO-DRIVER-D"]);
    act(() => {
      expect(oldLock(id)).toEqual({ ok: false, reason: "unavailable" });
      expect(oldScan("DEMO-COD-0001")).toBeNull();
      expect(hook.result.current.selectDriver("DEMO-DRIVER-C")).toEqual({ ok: true });
    });
    expect(hook.result.current.history).toEqual([]);
    expect(hook.result.current.currentDebt?.totalDebt).toBe(170000);
  });

  it("đổi tài xế cùng scope giữ lịch sử", () => {
    const hook = renderHook(() => useBranchCodCollection());
    const id = createDraft(hook);
    act(() => {
      expect(hook.result.current.cancelCollection(id)).toEqual({ ok: true });
      expect(hook.result.current.startNewCollection()).toEqual({ ok: true });
      expect(hook.result.current.selectDriver("DEMO-DRIVER-B")).toEqual({ ok: true });
    });
    expect(hook.result.current.currentDebt?.driver.id).toBe("DEMO-DRIVER-B");
    expect(hook.result.current.history).toMatchObject([{ id, status: "cancelled", driverId: "DEMO-DRIVER-A" }]);
  });

  it.each(["account", "granted scopes"])("vô hiệu phiên cũ khi thay đổi %s", (change) => {
    const hook = renderHook(() => useBranchCodCollection());
    const id = createDraft(hook);
    const oldLock = hook.result.current.lockCollection;
    const oldScan = hook.result.current.scanBarcode;
    act(() => {
      if (change === "account") {
        useAuthStore.setState({ user: { public_id: "OTHER-USER", must_change_password: 0 }, token: "other-session" });
      } else {
        useBranchScopeStore.getState().setScopes([
          { scope_type: "branch", branch_id: 3, warehouse_id: null, is_primary: true },
        ]);
      }
    });
    expect(hook.result.current.driverDebts).toEqual([]);
    expect(hook.result.current.history).toEqual([]);
    expect(hook.result.current.error).toBeTruthy();
    expect(oldLock(id)).toEqual({ ok: false, reason: "unavailable" });
    const fresh = renderHook(() => useBranchCodCollection());
    expect(fresh.result.current.driverDebts).toHaveLength(2);
    const newId = createDraft(fresh);
    expect(newId).toBe(id);
    expect(oldLock(id)).toEqual({ ok: false, reason: "unavailable" });
    expect(oldScan("DEMO-COD-0002")).toBeNull();
    expect(fresh.result.current.currentCollection).toMatchObject({ id: newId, status: "draft" });
    expect(fresh.result.current.history).toMatchObject([{ id: newId, status: "draft" }]);
  });

  it("các Hook instance có trạng thái demo độc lập", () => {
    const first = renderHook(() => useBranchCodCollection());
    const second = renderHook(() => useBranchCodCollection());
    const id = createDraft(first);
    act(() => expect(first.result.current.lockCollection(id)).toEqual({ ok: true }));
    expect(first.result.current.currentDebt?.totalDebt).toBe(65000);
    expect(second.result.current.driverDebts[0].totalDebt).toBe(295000);
    expect(second.result.current.history).toEqual([]);
    expect(second.result.current.scanned).toEqual([]);
  });

  it("ngoài Mock Mode không cung cấp dữ liệu hoặc thao tác demo", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    try {
      const { useAuthStore: auth } = await import("@/core/stores/useAuthStore");
      const { useBranchScopeStore: scopes } = await import("@/core/stores/useBranchScopeStore");
      const { useBranchCodCollection: useNonMockCollection } = await import("../hooks/useBranchCodCollection");
      auth.setState({
        isAuthenticated: true,
        token: "test-session",
        user: { public_id: "TEST-USER", must_change_password: 0 },
        permissions: ["finance.read", "finance.collect"],
      });
      scopes.getState().setScopes([
        { scope_type: "branch", branch_id: 3, warehouse_id: null, is_primary: true },
      ]);
      const hook = renderHook(() => useNonMockCollection());
      expect(hook.result.current.isMockMode).toBe(false);
      expect(hook.result.current.driverDebts).toEqual([]);
      expect(hook.result.current.currentDebt).toBeNull();
      expect(hook.result.current.history).toEqual([]);
      expect(hook.result.current.scanBarcode("DEMO-COD-0001")).toBeNull();
      expect(hook.result.current.createCollection()).toEqual({ ok: false, reason: "unavailable" });
      hook.unmount();
    } finally {
      vi.stubEnv("VITE_USE_MOCK", "true");
      vi.resetModules();
    }
  });
});
