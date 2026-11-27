import { describe, expect, it } from "vitest";
import { createFixtures, createHistoryMock } from "../api/warehouse-history.mock";
import { activeItems, canUnlock, INITIAL_FILTERS, RECEIPT_STATUSES, RECEIPT_TYPES, unlockSchema, type HistoryContext } from "../warehouse-history.model";
export const context: HistoryContext = { authenticated: true, can_read: true, roles: ["branch_manager"], branch_id: 3, warehouse_id: null, demo_scope: true, unlock_capability: true };
describe("KHA-42 validation and custody", () => {
  it("covers exactly three types and five statuses", () => {
    expect(new Set(createFixtures().map((r) => r.receipt_type))).toEqual(new Set(Object.keys(RECEIPT_TYPES)));
    expect(new Set(createFixtures().map((r) => r.status))).toEqual(new Set(Object.keys(RECEIPT_STATUSES)));
  });
  it.each(["", "   ", "a".repeat(501)])("rejects invalid reason %s", (unlock_reason) => expect(unlockSchema.safeParse({ unlock_reason, version: 1 }).success).toBe(false));
  it("accepts 500 characters and trims Vietnamese", () => {
    expect(unlockSchema.parse({ unlock_reason: "  Điều chỉnh  ", version: 3 }).unlock_reason).toBe("Điều chỉnh");
    expect(unlockSchema.safeParse({ unlock_reason: "a".repeat(500), version: 3 }).success).toBe(true);
  });
  it.each([0, -1, 1.5, NaN, undefined])("rejects invalid version %s", (version) => expect(unlockSchema.safeParse({ unlock_reason: "x", version }).success).toBe(false));
  it("requires manager, capability, authentication and correct scope", () => {
    const row = createFixtures()[0];
    expect(canUnlock(row, context)).toBe(true);
    for (const change of [{ authenticated: false }, { can_read: false }, { roles: ["system_admin"] }, { unlock_capability: false }, { branch_id: 2 }, { warehouse_id: 99 }, { demo_scope: false }]) expect(canUnlock(row, { ...context, ...change })).toBe(false);
  });
  it("blocks inbound, handed-over dates, invalid public IDs and nonconfirmed states", () => {
    const row = createFixtures()[0];
    expect(canUnlock({ ...row, receipt_type: "inbound" }, context)).toBe(false);
    expect(canUnlock({ ...row, public_id: "1" }, context)).toBe(false);
    expect(canUnlock({ ...row, demo: { ...row.demo!, handed_over_at: "2026-11-28" } }, context)).toBe(false);
    for (const status of ["draft", "unlocked", "handed_over", "cancelled"] as const) expect(canUnlock({ ...row, status }, context)).toBe(false);
  });
  it("excludes removed items while keeping bags distinct", () => {
    const items = activeItems(createFixtures()[0]);
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.tracking_code)).toHaveLength(2);
    expect(items.filter((i) => i.seal_number)).toHaveLength(1);
  });
});
describe("KHA-42 Mock mutations", () => {
  it("paginates scoped data and filters across all pages", () => {
    const mock = createHistoryMock();
    const page = mock.list(INITIAL_FILTERS, context);
    expect(page.data).toHaveLength(20); expect(page.meta.pagination.total).toBe(48);
    expect(mock.list({ ...INITIAL_FILTERS, receipt_code: "0048" }, context).data).toHaveLength(1);
    expect(mock.list({ ...INITIAL_FILTERS, receipt_code: "absent" }, context).meta.pagination.total).toBe(0);
    expect(mock.list(INITIAL_FILTERS, { ...context, branch_id: 2 }).data).toHaveLength(20);
  });
  it.each([{ page: 0 }, { per_page: 0 }, { per_page: 101 }, { from: "2026-11-29", to: "2026-11-28" }, { status: "locked" }])("rejects invalid filters %j rather than inventing results", (change) => {
    expect(() => createHistoryMock().list({ ...INITIAL_FILTERS, ...change }, context)).toThrow();
  });
  it("synchronizes list/detail, increments version and refuses repeated unlock", () => {
    const mock = createHistoryMock(); const row = mock.list(INITIAL_FILTERS, context).data[0];
    mock.unlock(row.public_id, { version: 3, unlock_reason: "Điều chỉnh" }, context);
    expect(mock.detail(row.public_id, context).version).toBe(4);
    expect(mock.list(INITIAL_FILTERS, context).data[0].status).toBe("unlocked");
    expect(() => mock.unlock(row.public_id, { version: 3, unlock_reason: "x" }, context)).toThrow("Dữ liệu vừa");
    expect(() => mock.unlock(row.public_id, { version: 4, unlock_reason: "x" }, context)).toThrow("không đủ điều kiện");
  });
  it("rejects forbidden, scope violations, invalid reason and version conflict", () => {
    const mock = createHistoryMock(); const row = createFixtures()[0];
    expect(() => mock.detail(row.public_id, { ...context, branch_id: 2 })).toThrow("phạm vi");
    expect(() => mock.unlock(row.public_id, {}, { ...context, roles: ["coordinator"] })).toThrow("Không có quyền");
    expect(() => mock.unlock(row.public_id, { version: 3, unlock_reason: " " }, context)).toThrow("không hợp lệ");
    expect(() => mock.unlock(row.public_id, { version: 2, unlock_reason: "x" }, context)).toThrow("Dữ liệu vừa");
  });
  it("handles 10,000 nullable rows with filtering before pagination and inclusive dates", () => {
    const template = createFixtures()[0];
    const rows = Array.from({ length: 10000 }, (_, i) => ({ ...template, receipt_code: `LARGE-${i}`, warehouse_name: null, note: null, created_at: i % 2 ? "2026-11-28T00:00:00+07:00" : "2026-11-27T23:59:59+07:00" }));
    const mock = createHistoryMock(rows);
    const page = mock.list({ ...INITIAL_FILTERS, from: "2026-11-28", to: "2026-11-28", page: 250 }, context);
    expect(page.meta.pagination).toEqual({ page: 250, per_page: 20, total: 5000, total_pages: 250 });
    expect(page.data).toHaveLength(20); expect(page.data.at(-1)?.receipt_code).toBe("LARGE-9999");
    expect(mock.list({ ...INITIAL_FILTERS, receipt_code: "LARGE-9999" }, context).data).toHaveLength(1);
  });
  it("requires explicit absence of handover rather than treating missing information as eligible", () => {
    const row = createFixtures()[0];
    const malformed = { ...row, demo: { ...row.demo!, handed_over_at: undefined } };
    expect(canUnlock(malformed as unknown as typeof row, context)).toBe(false);
  });
});
