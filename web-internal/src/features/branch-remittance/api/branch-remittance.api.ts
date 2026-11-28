import { USE_MOCK } from "@/core/api/axiosClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import fixture from "@/mocks/branchRemittance.mock.json";
import type { RemittanceMockState, RemittanceMockSubmission, MockRemittanceAttempt, ReceiptUpload } from "../types/branch-remittance.types";
import { BRANCH_REMITTANCE_READ_PERMISSION, BRANCH_REMITTANCE_SUBMIT_PERMISSION, isSupportedReceiptFormat, RECEIPT_MAX_BYTES } from "../constants/branch-remittance.constants";
import { transferFormSchema } from "../schemas/branch-remittance.schema";
import { fromMinorUnits, toMinorUnits } from "../utils/branch-remittance.utils";

export class RemittanceBlockedError extends Error {
  constructor(message: string) { super(message); this.name = "RemittanceBlockedError"; }
}

export class RemittanceNetworkError extends Error {
  constructor() { super("Mất kết nối mạng. Có thể thử lại an toàn."); this.name = "RemittanceNetworkError"; }
}

export class RemittanceConflictError extends Error {
  constructor() { super("Bảng kê vừa được sử dụng bởi giao dịch khác. Danh sách đã được cập nhật."); this.name = "RemittanceConflictError"; }
}

export class RemittanceAccessError extends Error {
  constructor(message: string) { super(message); this.name = "RemittanceAccessError"; }
}

function hasMockReadAccess(): boolean {
  const auth = useAuthStore.getState();
  return auth.isAuthenticated && (auth.roles.includes("branch_accountant") || auth.roles.includes("system_admin")) && auth.hasPermission(BRANCH_REMITTANCE_READ_PERMISSION);
}

function canReadRequestedScope(scope: { branch_id: number | null; include_all_branches: boolean }): boolean {
  if (!hasMockReadAccess()) return false;
  const auth = useAuthStore.getState();
  const branchScope = useBranchScopeStore.getState();
  const scopeMatchesBranch = branchScope.activeBranchId === scope.branch_id && branchScope.activeScope?.branch_id === scope.branch_id && ["branch", "post_office"].includes(branchScope.activeScope.scope_type);
  if (scope.include_all_branches) return auth.roles.includes("system_admin") && scope.branch_id === null && branchScope.activeBranchId === null && branchScope.activeScope?.scope_type === "hq_all";
  return scopeMatchesBranch;
}

function canSubmitForBranch(branchId: number): boolean {
  const auth = useAuthStore.getState();
  const branchScope = useBranchScopeStore.getState();
  if (!auth.isAuthenticated || !auth.hasPermission(BRANCH_REMITTANCE_SUBMIT_PERMISSION)) return false;
  if (auth.roles.includes("branch_accountant")) {
    return branchScope.activeBranchId === branchId && branchScope.activeScope?.branch_id === branchId && ["branch", "post_office"].includes(branchScope.activeScope.scope_type);
  }
  if (!auth.roles.includes("system_admin")) return false;
  return branchScope.activeScope?.scope_type === "hq_all" && branchScope.activeBranchId === null ||
    branchScope.activeBranchId === branchId && branchScope.activeScope?.branch_id === branchId && ["branch", "post_office"].includes(branchScope.activeScope.scope_type);
}

function assertMockSubmitAccess(branchId?: number): void {
  const auth = useAuthStore.getState();
  const branchScope = useBranchScopeStore.getState();
  const branchScoped = branchScope.activeBranchId !== null && branchScope.activeScope?.branch_id === branchScope.activeBranchId &&
    ["branch", "post_office"].includes(branchScope.activeScope.scope_type);
  const adminHqScope = auth.roles.includes("system_admin") && branchScope.activeBranchId === null && branchScope.activeScope?.scope_type === "hq_all";
  const scopeAllowed = branchId === undefined ? branchScoped || adminHqScope : canSubmitForBranch(branchId);
  const canSubmit = auth.isAuthenticated && auth.hasPermission(BRANCH_REMITTANCE_READ_PERMISSION) && auth.hasPermission(BRANCH_REMITTANCE_SUBMIT_PERMISSION) &&
    (auth.roles.includes("branch_accountant") || auth.roles.includes("system_admin")) && scopeAllowed;
  if (!canSubmit) throw new RemittanceAccessError("Bạn thiếu quyền finance.read/finance.remit hoặc không có phạm vi hợp lệ cho thao tác Mock này.");
}

const INITIAL_STATE = fixture.success_response.data as RemittanceMockState;
let mockState: RemittanceMockState = structuredClone(INITIAL_STATE);
let submittedByKey = new Map<string, { payload_signature: string; result: RemittanceMockSubmission }>();
let submissionNumber = 1;
let failNextUpload = false;
let failNextResponseAfterCommit = false;

export async function listEligibleCollections(scope: { branch_id: number | null; include_all_branches: boolean }): Promise<RemittanceMockState> {
  if (!USE_MOCK) throw new RemittanceBlockedError("API thật BLOCKED: chưa có endpoint và response xác nhận để lấy bảng kê đủ điều kiện.");
  if (!canReadRequestedScope(scope)) throw new RemittanceAccessError("Không có quyền đọc bảng kê Mock trong phạm vi được chọn.");
  await new Promise((resolve) => setTimeout(resolve, 120));
  const state = structuredClone(mockState);
  if (scope.include_all_branches) return state;
  if (scope.branch_id === null) return { ...state, collections: [], branch_names: {} };
  return {
    ...state,
    collections: state.collections.filter((item) => item.branch_id === scope.branch_id),
    branch_names: state.branch_names[scope.branch_id] === undefined ? {} : { [scope.branch_id]: state.branch_names[scope.branch_id] },
  };
}

export async function uploadReceiptMock(file: File): Promise<ReceiptUpload> {
  if (!USE_MOCK) throw new RemittanceBlockedError("Upload thật BLOCKED: chưa có endpoint hoặc multipart field được xác nhận.");
  assertMockSubmitAccess();
  if (!file.name.trim() || file.size === 0 || file.size > RECEIPT_MAX_BYTES || !isSupportedReceiptFormat(file.name, file.type)) {
    throw new Error("Chọn ảnh JPEG, PNG hoặc WebP hợp lệ, dung lượng tối đa 5 MB.");
  }
  await new Promise((resolve) => setTimeout(resolve, 180));
  if (failNextUpload) {
    failNextUpload = false;
    throw new RemittanceNetworkError();
  }
  return { receipt_image_url: `mock://receipts/${encodeURIComponent(file.name)}`, file_name: file.name, size: file.size };
}

export async function submitRemittanceMock(attempt: MockRemittanceAttempt): Promise<RemittanceMockSubmission> {
  if (!USE_MOCK) {
    throw new RemittanceBlockedError("API thật BLOCKED: đã biết POST /api/v1/finance/remittances nhưng chưa xác nhận payload/response, permission hoặc expected version.");
  }
  assertMockSubmitAccess(attempt.branch_id);
  const { collection_ids: collectionIds, receipt } = attempt;
  if (!Array.isArray(collectionIds) || !collectionIds.length || !receipt) throw new Error("Cần chọn bảng kê và tải biên lai trước khi gửi.");
  if (!Number.isSafeInteger(attempt.branch_id) || attempt.branch_id <= 0) throw new Error("Đơn vị nguồn không hợp lệ.");
  if (!attempt.idempotency_key.trim()) throw new Error("Thiếu Idempotency-Key.");
  if (new Set(collectionIds).size !== collectionIds.length) throw new RemittanceConflictError();
  if (!transferFormSchema.safeParse(attempt.values).success) throw new Error("Thông tin chuyển khoản không hợp lệ.");
  const validReceiptName = /\.(jpe?g|png|webp)$/i.test(receipt.file_name);
  const validReceiptUrl = receipt.receipt_image_url === `mock://receipts/${encodeURIComponent(receipt.file_name)}`;
  if (!receipt.file_name.trim() || !Number.isSafeInteger(receipt.size) || receipt.size <= 0 || receipt.size > RECEIPT_MAX_BYTES || !validReceiptName || !validReceiptUrl) {
    throw new Error("Biên lai Mock không hợp lệ hoặc chưa được tải lên.");
  }
  const payloadSignature = JSON.stringify({ branch_id: attempt.branch_id, collection_ids: collectionIds, values: attempt.values, receipt });
  const previous = submittedByKey.get(attempt.idempotency_key);
  if (previous) {
    if (previous.payload_signature !== payloadSignature) throw new Error("Idempotency-Key đã được dùng với nội dung khác.");
    return structuredClone(previous.result);
  }
  if (collectionIds.some((id) => mockState.remitted_collection_ids.includes(id))) throw new RemittanceConflictError();
  const eligible = mockState.collections.filter((item) => collectionIds.includes(item.public_id) && item.status === "locked");
  if (eligible.length !== new Set(collectionIds).size || eligible.some((item) => item.branch_id !== attempt.branch_id)) throw new RemittanceConflictError();
  const amount = eligible.reduce((sum, item) => sum + toMinorUnits(item.total_amount), 0n);
  if (amount === 0n) throw new Error("Không thể gửi phiếu có tổng tiền bằng 0.");
  const totalAmount = fromMinorUnits(amount);
  mockState = { ...mockState, remitted_collection_ids: [...mockState.remitted_collection_ids, ...collectionIds] };
  const currentNumber = submissionNumber++;
  const n = String(currentNumber).padStart(3, "0");
  const result: RemittanceMockSubmission = {
    public_id: `01JDC9X8K2M4N6P8${String(currentNumber).padStart(10, "0")}`,
    remittance_code: `RM-DNG-20261128-${n}`,
    total_amount: totalAmount,
    status: "submitted",
    submitted_at: new Date().toISOString(),
    collection_ids: [...collectionIds],
  };
  submittedByKey.set(attempt.idempotency_key, { payload_signature: payloadSignature, result });
  if (failNextResponseAfterCommit) {
    failNextResponseAfterCommit = false;
    throw new RemittanceNetworkError();
  }
  return structuredClone(result);
}

export function resetRemittanceMockForTests(): void {
  mockState = structuredClone(INITIAL_STATE);
  submittedByKey = new Map();
  submissionNumber = 1;
  failNextUpload = false;
  failNextResponseAfterCommit = false;
}

export function injectRemittanceMockFailureForTests(failure: "upload_once" | "response_after_commit_once"): void {
  if (failure === "upload_once") failNextUpload = true;
  if (failure === "response_after_commit_once") failNextResponseAfterCommit = true;
}

export function markCollectionRemittedForTests(publicId: string): void {
  if (!mockState.remitted_collection_ids.includes(publicId)) {
    mockState = { ...mockState, remitted_collection_ids: [...mockState.remitted_collection_ids, publicId] };
  }
}
