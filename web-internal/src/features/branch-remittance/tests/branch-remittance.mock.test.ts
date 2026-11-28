import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  injectRemittanceMockFailureForTests,
  listEligibleCollections,
  markCollectionRemittedForTests,
  RemittanceConflictError,
  RemittanceNetworkError,
  resetRemittanceMockForTests,
  submitRemittanceMock,
  uploadReceiptMock,
  RemittanceAccessError,
} from "../api/branch-remittance.api";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";

const hqScope = { scope_type: "hq_all" as const, branch_id: null, warehouse_id: null, is_primary: true, branch_name: "Toàn hệ thống" };
const branchScope = { scope_type: "post_office" as const, branch_id: 4, warehouse_id: null, is_primary: true, branch_name: "Bưu cục Sơn Trà" };

function setActor(role: "system_admin" | "branch_accountant" | "receptionist", permissions: string[], scope: typeof hqScope | typeof branchScope = hqScope) {
  useAuthStore.setState({ isAuthenticated: true, token: "mock-test-token", roles: [role], permissions });
  useBranchScopeStore.setState({ scopes: [scope], activeScope: scope, activeBranchId: scope.branch_id, activeWarehouseId: null });
}

beforeEach(() => setActor("system_admin", ["*"]));

afterEach(() => resetRemittanceMockForTests());

describe("branch remittance mock transaction", () => {
  const listAll = () => listEligibleCollections({ branch_id: null, include_all_branches: true });
  const makeAttempt = (collectionId: string, branchId = 4, idempotencyKey = "00000000-0000-4000-8000-000000000001") => ({
    idempotency_key: idempotencyKey,
    branch_id: branchId,
    collection_ids: [collectionId],
    values: { bank_name: "Bank", bank_account_no: "00123", bank_reference_no: "REF-1" },
    receipt: { receipt_image_url: "mock://receipts/receipt.png", file_name: "receipt.png", size: 120 },
  });

  it("returns source fixture rows and creates submitted status without verifying", async () => {
    const state = await listAll();
    expect(state.collections.some((item) => item.status === "draft")).toBe(true);
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    const result = await submitRemittanceMock(makeAttempt(row.public_id));
    expect(result.status).toBe("submitted");
    expect(result.total_amount).toBe("4250000.00");
    expect(result.public_id).toHaveLength(26);
    expect((await listAll()).remitted_collection_ids).toContain(row.public_id);
    expect(result.status).not.toBe("verified");
  });

  it("sums a multi-collection remittance exactly in decimal minor units", async () => {
    const state = await listAll();
    const ids = state.collections.filter((item) => ["CC-DNG-20261127-001", "CC-DNG-20261127-002"].includes(item.collection_code)).map((item) => item.public_id);
    const result = await submitRemittanceMock({ ...makeAttempt(ids[0]), collection_ids: ids });
    expect(result.total_amount).toBe("6075000.50");
  });

  it("prevents duplicate use of a collection across remittances", async () => {
    const state = await listAll();
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    await submitRemittanceMock(makeAttempt(row.public_id));
    await expect(submitRemittanceMock(makeAttempt(row.public_id, 4, "different-key"))).rejects.toBeInstanceOf(RemittanceConflictError);
  });

  it("allows only one concurrent transaction to consume the same collection", async () => {
    const state = await listAll();
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    const outcomes = await Promise.allSettled([
      submitRemittanceMock(makeAttempt(row.public_id, 4, "first-concurrent-key")),
      submitRemittanceMock(makeAttempt(row.public_id, 4, "second-concurrent-key")),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected" && outcome.reason instanceof RemittanceConflictError)).toHaveLength(1);
    expect((await listAll()).remitted_collection_ids.filter((id) => id === row.public_id)).toHaveLength(1);
  });

  it("rejects an otherwise locked collection from another branch", async () => {
    const state = await listAll();
    const outside = state.collections.find((item) => item.status === "locked" && item.branch_id === 3)!;
    await expect(submitRemittanceMock(makeAttempt(outside.public_id, 4))).rejects.toBeInstanceOf(RemittanceConflictError);
  });

  it("scopes Mock list rows and branch names unless the caller has the Admin Mock all-branches scope", async () => {
    setActor("branch_accountant", ["finance.read"], branchScope);
    const branchState = await listEligibleCollections({ branch_id: 4, include_all_branches: false });
    expect(branchState.collections.length).toBeGreaterThan(0);
    expect(branchState.collections.every((item) => item.branch_id === 4)).toBe(true);
    expect(Object.keys(branchState.branch_names)).toEqual(["4"]);
    await expect(listEligibleCollections({ branch_id: null, include_all_branches: false })).rejects.toBeInstanceOf(RemittanceAccessError);

    setActor("system_admin", ["*"]);
    const allState = await listAll();
    expect(new Set(allState.collections.map((item) => item.branch_id))).toEqual(new Set([3, 4]));
  });

  it("blocks direct Mock service calls without permission and outside the active branch scope", async () => {
    setActor("receptionist", ["compensation.read"]);
    await expect(listAll()).rejects.toBeInstanceOf(RemittanceAccessError);
    await expect(uploadReceiptMock(new File(["data"], "receipt.png", { type: "image/png" }))).rejects.toBeInstanceOf(RemittanceAccessError);

    setActor("branch_accountant", ["finance.read"], branchScope);
    const readOnlyState = await listEligibleCollections({ branch_id: 4, include_all_branches: false });
    await expect(submitRemittanceMock(makeAttempt(readOnlyState.collections[0].public_id))).rejects.toBeInstanceOf(RemittanceAccessError);
    setActor("branch_accountant", ["finance.remit"], branchScope);
    await expect(uploadReceiptMock(new File(["data"], "receipt.png", { type: "image/png" }))).rejects.toBeInstanceOf(RemittanceAccessError);

    setActor("branch_accountant", ["finance.read", "finance.remit"], branchScope);
    await expect(listEligibleCollections({ branch_id: 3, include_all_branches: false })).rejects.toBeInstanceOf(RemittanceAccessError);
    await expect(submitRemittanceMock(makeAttempt("01JDC9X8K2M4N6P8Q0R2S4T606", 3))).rejects.toBeInstanceOf(RemittanceAccessError);
  });

  it("rejects a mixed-unit remittance even when each collection is individually locked", async () => {
    const state = await listAll();
    const branchFour = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    const branchThree = state.collections.find((item) => item.status === "locked" && item.branch_id === 3)!;
    await expect(submitRemittanceMock({ ...makeAttempt(branchFour.public_id), collection_ids: [branchFour.public_id, branchThree.public_id] })).rejects.toBeInstanceOf(RemittanceConflictError);
  });

  it("rejects stale collections that were already remitted by a concurrent transaction", async () => {
    const state = await listAll();
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    markCollectionRemittedForTests(row.public_id);
    await expect(submitRemittanceMock(makeAttempt(row.public_id))).rejects.toBeInstanceOf(RemittanceConflictError);
  });

  it("retries a lost response using the same key and payload and returns the committed result", async () => {
    const state = await listAll();
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    const attempt = makeAttempt(row.public_id);
    injectRemittanceMockFailureForTests("response_after_commit_once");
    await expect(submitRemittanceMock(attempt)).rejects.toBeInstanceOf(RemittanceNetworkError);
    const retried = await submitRemittanceMock(attempt);
    const repeated = await submitRemittanceMock(attempt);
    expect(retried).toEqual(repeated);
    expect(retried.status).toBe("submitted");
    expect((await listAll()).remitted_collection_ids.filter((id) => id === row.public_id)).toHaveLength(1);
  });

  it("does not allow the same idempotency key to be reused with a changed payload", async () => {
    const state = await listAll();
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    const attempt = makeAttempt(row.public_id);
    const first = await submitRemittanceMock(attempt);
    const changed = { ...attempt, values: { ...attempt.values, bank_account_no: "999" } };
    await expect(submitRemittanceMock(changed)).rejects.toThrow("Idempotency-Key");
    await expect(submitRemittanceMock({ ...attempt, branch_id: 3 })).rejects.toThrow("Idempotency-Key");
    expect(first.status).toBe("submitted");
  });

  it("validates transfer details and rejects local preview URLs at the Mock service boundary", async () => {
    const state = await listAll();
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    const attempt = makeAttempt(row.public_id);
    await expect(submitRemittanceMock({ ...attempt, values: { ...attempt.values, bank_name: "   " } })).rejects.toThrow("Thông tin chuyển khoản");
    await expect(submitRemittanceMock({ ...attempt, receipt: { ...attempt.receipt, receipt_image_url: "blob:preview-url" } })).rejects.toThrow("Biên lai Mock");
    await expect(submitRemittanceMock({ ...attempt, receipt: { ...attempt.receipt, size: Number.NaN } })).rejects.toThrow("Biên lai Mock");
    expect((await listAll()).remitted_collection_ids).not.toContain(row.public_id);
  });

  it("rejects repeated IDs in a submission instead of counting a collection twice", async () => {
    const state = await listAll();
    const row = state.collections.find((item) => item.status === "locked" && item.branch_id === 4)!;
    const attempt = makeAttempt(row.public_id);
    await expect(submitRemittanceMock({ ...attempt, collection_ids: [row.public_id, row.public_id] })).rejects.toBeInstanceOf(RemittanceConflictError);
    expect((await listAll()).remitted_collection_ids).not.toContain(row.public_id);
  });

  it("surfaces a transient upload failure and succeeds on retry with the same file", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "receipt.png", { type: "image/png" });
    injectRemittanceMockFailureForTests("upload_once");
    await expect(uploadReceiptMock(file)).rejects.toBeInstanceOf(RemittanceNetworkError);
    const retry = await uploadReceiptMock(file);
    expect(retry.file_name).toBe(file.name);
    expect(retry.size).toBe(file.size);
    expect(retry.receipt_image_url).toMatch(/^mock:\/\//);
  });

  it("rejects invalid upload metadata at the Mock service boundary", async () => {
    await expect(uploadReceiptMock(new File([], "empty.png", { type: "image/png" }))).rejects.toThrow("ảnh JPEG, PNG hoặc WebP");
    await expect(uploadReceiptMock(new File(["data"], "receipt.png", { type: "image/jpeg" }))).rejects.toThrow("ảnh JPEG, PNG hoặc WebP");
    await expect(uploadReceiptMock(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }))).rejects.toThrow("5 MB");
  });
});
