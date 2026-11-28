import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
vi.mock("@/core/api/axiosClient", () => ({ default: { get: vi.fn() }, USE_MOCK: true }));
import { WarehouseHistoryPage } from "../pages/WarehouseHistoryPage";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { createFixtures, createHistoryMock } from "../api/warehouse-history.mock";
import { canUnlock, INITIAL_FILTERS, type HistoryContext } from "../warehouse-history.model";
import { HISTORY_BRANCHES, HISTORY_WAREHOUSES } from "../warehouse-history.mock-network";
const hq: HistoryContext = { authenticated: true, can_read: true, roles: ["system_admin"], branch_id: null, warehouse_id: null, scope_type: "hq_all", demo_scope: true, unlock_capability: false };
const auth = useAuthStore.getState(); const scopes = useBranchScopeStore.getState();
afterEach(() => { cleanup(); useAuthStore.setState(auth, true); useBranchScopeStore.setState(scopes, true); });
it("aggregates only known warehouse relationships, filters each branch and supports detail", () => {
  const mock = createHistoryMock();
  expect(mock.list(INITIAL_FILTERS, hq).meta.pagination.total).toBe(96);
  expect(new Set(mock.list(INITIAL_FILTERS, hq).data.map((r) => r.branch_name)).size).toBe(3);
  for (const branch of HISTORY_BRANCHES) {
    const result = mock.list({ ...INITIAL_FILTERS, branch_id: String(branch.id) }, hq);
    expect(result.data.every((r) => r.demo?.branch_id === branch.id)).toBe(true);
    if (![2, 3, 4].includes(branch.id)) expect(result.meta.pagination.total).toBe(0);
  }
  for (const r of createFixtures()) {
    const w = HISTORY_WAREHOUSES.find((w) => w.id === r.warehouse_id)!;
    expect(r.demo?.branch_id).toBe(w.branch_id);
    expect(r.warehouse_name).toBe(w.name);
    expect(mock.detail(r.public_id, hq).branch_name).toBe(HISTORY_BRANCHES.find((b) => b.id === w.branch_id)?.name);
    expect(canUnlock(r, { ...hq, unlock_capability: true })).toBe(false);
  }
});
it("null branch without explicit HQ scope and missing read permission cannot expose data", () => {
  const mock = createHistoryMock();
  expect(mock.list(INITIAL_FILTERS, { ...hq, scope_type: undefined }).data).toHaveLength(0);
  expect(() => mock.list(INITIAL_FILTERS, { ...hq, can_read: false })).toThrow();
  expect(() => mock.detail(createFixtures()[0].public_id, { ...hq, scope_type: "branch" })).toThrow();
});
it("real page uses granted scope and permissions, resets local branch filters on Topbar changes", async () => {
  useAuthStore.setState({ isAuthenticated: true, token: "test-session", user: { public_id: "TEST-USER", must_change_password: 0 }, roles: ["system_admin"], permissions: ["warehouse.read"] });
  useBranchScopeStore.getState().setScopes([{ scope_type: "hq_all", branch_id: null, warehouse_id: null, is_primary: true }, { scope_type: "branch", branch_id: 3, warehouse_id: null }]);
  render(<MemoryRouter><WarehouseHistoryPage /></MemoryRouter>);
  await screen.findByText("96 phiếu · Trang 1/5");
  fireEvent.change(screen.getByLabelText("Chi nhánh"), { target: { value: "4" } });
  await screen.findByText("24 phiếu · Trang 1/2");
  const { act } = await import("@testing-library/react");
  act(() => useBranchScopeStore.getState().switchScope("branch:3:none"));
  await screen.findByText("48 phiếu · Trang 1/3");
  expect(screen.queryByLabelText("Chi nhánh")).toBeNull();
  act(() => useBranchScopeStore.getState().switchScope("hq_all:none:none"));
  await screen.findByText("96 phiếu · Trang 1/5");
  act(() => useAuthStore.setState({ permissions: [] }));
  await screen.findByRole("alert"); expect(screen.queryByRole("table")).toBeNull();
});
