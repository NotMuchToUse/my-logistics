import { beforeEach, describe, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/core/api/axiosClient", () => ({ default: client, USE_MOCK: false }));
import { getReceipt, listHistory, unlockReceipt } from "../api/warehouse-history.api";
import { createFixtures } from "../api/warehouse-history.mock";
import { INITIAL_FILTERS, type HistoryContext } from "../warehouse-history.model";
const c: HistoryContext = { authenticated: true, can_read: true, roles: ["branch_manager"], branch_id: 3, warehouse_id: null, demo_scope: true, unlock_capability: true };
beforeEach(() => { client.get.mockReset(); });
describe("KHA-42 real API adapter", () => {
  it("HQ API fails closed before HTTP while branch-header exception is unconfirmed", async () => {
    const hq: HistoryContext = { ...c, scope_type: "hq_all", branch_id: null, warehouse_id: null };
    await expect(listHistory(INITIAL_FILTERS, hq)).rejects.toThrow("X-Branch-Id");
    await expect(getReceipt(createFixtures()[0].public_id, hq)).rejects.toThrow("hq_all");
    expect(client.get).not.toHaveBeenCalled();
  });
  it("uses confirmed GET list URL, query and pagination envelope", async () => {
    client.get.mockResolvedValue({ data: { success: true, data: createFixtures().slice(0, 1), meta: { pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 } } } });
    const result = await listHistory(INITIAL_FILTERS, c);
    expect(result.data).toHaveLength(1);
    expect(client.get).toHaveBeenCalledWith("/api/v1/warehouse/receipts", expect.objectContaining({ params: { page: 1, per_page: 20, receipt_code: undefined, status: undefined, warehouse_id: undefined } }));
    expect(result.data[0]).not.toHaveProperty("demo");
  });
  it("uses public_id detail URL and strips internal keys", async () => {
    const row = createFixtures()[0];
    client.get.mockResolvedValue({ data: { success: true, data: { ...row, id: 99, items: [{ tracking_code: "VD", scanned_at: null, inbound_source_type: null, is_wrong_route: 0, id: 45 }] } } });
    const result = await getReceipt(row.public_id, c);
    expect(client.get.mock.calls[0][0]).toBe(`/api/v1/warehouse/receipts/${row.public_id}`);
    expect(result).not.toHaveProperty("id"); expect(result.items?.[0]).not.toHaveProperty("id");
  });
  it.each(["403_FORBIDDEN", "403_BRANCH_SCOPE", "404_NOT_FOUND", "429_TOO_MANY_REQUESTS", "500_INTERNAL_ERROR", "Network Error", "Timeout"])("propagates %s without fallback", async (message) => {
    const failure = { error: { code: message, message } };
    client.get.mockRejectedValue(failure);
    await expect(listHistory(INITIAL_FILTERS, c)).rejects.toEqual(failure);
  });
  it("fails closed for unconfirmed filters, mutation and denied auth", async () => {
    await expect(listHistory({ ...INITIAL_FILTERS, receipt_type: "inbound" }, c)).rejects.toThrow("chưa được API hỗ trợ");
    await expect(unlockReceipt(createFixtures()[0].public_id, { unlock_reason: "x", version: 3 }, c)).rejects.toThrow("Chưa có route");
    await expect(listHistory(INITIAL_FILTERS, { ...c, can_read: false })).rejects.toThrow("Cần đăng nhập");
    expect(client.get).not.toHaveBeenCalled();
  });
  it("rejects invalid response envelopes", async () => {
    client.get.mockResolvedValue({ data: { success: false, data: [] } });
    await expect(listHistory(INITIAL_FILTERS, c)).rejects.toThrow();
  });
  it("gives a specific invalid public ID error before issuing HTTP", async () => {
    await expect(getReceipt("bad-id", c)).rejects.toThrow("Định danh phiếu không hợp lệ");
    expect(client.get).not.toHaveBeenCalled();
  });
  it("rejects a detail response for a different public ID", async () => {
    const rows = createFixtures();
    client.get.mockResolvedValue({ data: { success: true, data: { ...rows[1], items: [] } } });
    await expect(getReceipt(rows[0].public_id, c)).rejects.toThrow();
  });
  it.each(["list", "detail"])("fails closed on out-of-warehouse %s responses", async (kind) => {
    const row = createFixtures()[0];
    client.get.mockResolvedValue({ data: { success: true, data: kind === "list" ? [row] : { ...row, items: [] }, meta: { pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 } } } });
    const scoped = { ...c, warehouse_id: 99 };
    await expect(kind === "list" ? listHistory(INITIAL_FILTERS, scoped) : getReceipt(row.public_id, scoped)).rejects.toThrow("kho đang chọn");
  });
  it("rejects nonexistent detail without fabricating content", async () => {
    const failure = { success: false, error: { code: "404_NOT_FOUND", message: "Không tìm thấy phiếu" } };
    client.get.mockRejectedValue(failure);
    await expect(getReceipt(createFixtures()[0].public_id, c)).rejects.toEqual(failure);
  });
  it.each([null, false, "", 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects malformed numeric totals instead of coercing %s into data", async (total_shipments) => {
    client.get.mockResolvedValue({ data: { success: true, data: [{ ...createFixtures()[0], total_shipments }], meta: { pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 } } } });
    await expect(listHistory(INITIAL_FILTERS, c)).rejects.toThrow();
  });
});
