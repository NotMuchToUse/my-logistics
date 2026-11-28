import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { USE_MOCK } from "@/core/api/axiosClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { listEligibleCollections, RemittanceBlockedError, RemittanceConflictError, RemittanceNetworkError, submitRemittanceMock, uploadReceiptMock } from "../api/branch-remittance.api";
import { BRANCH_REMITTANCE_READ_PERMISSION, BRANCH_REMITTANCE_SUBMIT_PERMISSION } from "../constants/branch-remittance.constants";
import { transferFormSchema } from "../schemas/branch-remittance.schema";
import type { CashCollection, MockRemittanceAttempt, ReceiptUpload, RemittanceMockState, RemittanceMockSubmission, TransferFormValues } from "../types/branch-remittance.types";
import { getEligibleCollections, sumCollectionAmounts, validateReceiptMetadata } from "../utils/branch-remittance.utils";
import type { RoleCode } from "@/types/rbac.types";

const EMPTY_STATE: RemittanceMockState = { collections: [], remitted_collection_ids: [], selected_recipient_name: "", branch_names: {} };

export function canReadBranchRemittance(
  isAuthenticated: boolean,
  roles: RoleCode[],
  hasPermission: (permission: string) => boolean,
  scopeAllowed: boolean,
  useMock = USE_MOCK,
): boolean {
  const allowedRole = roles.includes("branch_accountant") ||
    (useMock && roles.includes("system_admin"));
  return isAuthenticated && allowedRole && hasPermission(BRANCH_REMITTANCE_READ_PERMISSION) && scopeAllowed;
}

function isReadableImage(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (isReadable: boolean) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(isReadable);
    };
    try {
      const image = new Image();
      image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
      image.onerror = () => finish(false);
      image.src = url;
    } catch {
      finish(false);
    }
  });
}

export function useBranchRemittance() {
  const branchId = useBranchScopeStore((state) => state.activeBranchId);
  const activeScope = useBranchScopeStore((state) => state.activeScope);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const roles = useAuthStore((state) => state.roles);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [datasetState, setDatasetState] = useState<{ scope_key: string; data: RemittanceMockState } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<{ scope_key: string; ids: string[] }>({ scope_key: "none", ids: [] });
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState("all");
  const [receipt, setReceipt] = useState<ReceiptUpload | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<{ scope_key: string; value: RemittanceMockSubmission } | null>(null);
  const submitLock = useRef(false);
  const selectedFile = useRef<File | null>(null);
  const uploadSequence = useRef(0);
  const requestSequence = useRef(0);
  const attemptRef = useRef<{ signature: string; attempt: MockRemittanceAttempt } | null>(null);
  const form = useForm<TransferFormValues>({ resolver: zodResolver(transferFormSchema), defaultValues: { bank_name: "", bank_account_no: "", bank_reference_no: "" }, mode: "onBlur" });

  const scopeKey = activeScope === null ? "none" : `${activeScope.scope_type}:${activeScope.branch_id ?? "all"}:${activeScope.warehouse_id ?? "none"}`;
  const isMockAdminAll = USE_MOCK && isAuthenticated && roles.includes("system_admin") && activeScope?.scope_type === "hq_all" && branchId === null;
  const branchScopeAllowed = branchId !== null && activeScope !== null && activeScope.branch_id === branchId && ["branch", "post_office"].includes(activeScope.scope_type);
  const scopeAllowed = branchScopeAllowed || isMockAdminAll;
  const canRead = canReadBranchRemittance(isAuthenticated, roles, hasPermission, scopeAllowed);
  const needsMockBranchScope = USE_MOCK && isAuthenticated && roles.includes("system_admin") && hasPermission(BRANCH_REMITTANCE_READ_PERMISSION) && !scopeAllowed;
  const permitted = canRead && hasPermission(BRANCH_REMITTANCE_SUBMIT_PERMISSION);
  const dataset = canRead && datasetState?.scope_key === scopeKey ? datasetState.data : EMPTY_STATE;
  const isLoading = loading || (canRead && datasetState?.scope_key !== scopeKey);
  const selectedIds = useMemo(() => selection.scope_key === scopeKey ? selection.ids : [], [selection, scopeKey]);
  const submission = submissionState?.scope_key === scopeKey ? submissionState.value : null;
  const branchName = branchId === null ? (isMockAdminAll ? "Toàn hệ thống" : null) : dataset.branch_names[branchId] ?? activeScope?.branch_name ?? `Phạm vi chi nhánh #${branchId}`;
  const collections = useMemo(() => getEligibleCollections(dataset.collections, branchId, dataset.remitted_collection_ids, isMockAdminAll), [dataset, branchId, isMockAdminAll]);
  const unitOptions = useMemo(() => [...new Set(collections.map((item) => item.branch_id))].sort((a, b) => a - b).map((id) => ({ id, name: dataset.branch_names[id] ?? `Đơn vị #${id}` })), [collections, dataset.branch_names]);
  const visibleCollections = useMemo(() => collections.filter((item) => (unitFilter === "all" || item.branch_id === Number(unitFilter)) && item.collection_code.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))), [collections, search, unitFilter]);
  const totalAmount = useMemo(() => sumCollectionAmounts(collections, selectedIds), [collections, selectedIds]);
  const selectedCollections = useMemo(() => collections.filter((item) => selectedIds.includes(item.public_id)), [collections, selectedIds]);
  const selectedSourceBranchId = selectedCollections[0]?.branch_id ?? null;
  const selectedSourceBranchName = selectedSourceBranchId === null ? null : dataset.branch_names[selectedSourceBranchId] ?? `Đơn vị #${selectedSourceBranchId}`;
  const selectableVisibleCollections = selectedSourceBranchId === null ? visibleCollections : visibleCollections.filter((item) => item.branch_id === selectedSourceBranchId);
  const visibleBranchIds = new Set(visibleCollections.map((item) => item.branch_id));
  const allVisibleSelected = selectableVisibleCollections.length > 0 && selectableVisibleCollections.every((item) => selectedIds.includes(item.public_id));
  const selectAllBlocked = selectedSourceBranchId === null && visibleBranchIds.size > 1;

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    if (!canRead) return;
    setLoading(true); setLoadError(null);
    try {
      const response = await listEligibleCollections({ branch_id: branchId, include_all_branches: isMockAdminAll });
      if (sequence === requestSequence.current && canRead) setDatasetState({ scope_key: scopeKey, data: response });
    } catch (error) {
      if (sequence === requestSequence.current && canRead) {
        setDatasetState({ scope_key: scopeKey, data: EMPTY_STATE });
        setLoadError(error instanceof Error ? error.message : "Không thể tải bảng kê.");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [branchId, canRead, isMockAdminAll, scopeKey]);

  useEffect(() => {
    if (!canRead) return;
    const sequence = ++requestSequence.current;
    let active = true;
    void listEligibleCollections({ branch_id: branchId, include_all_branches: isMockAdminAll }).then((response) => {
      if (active && sequence === requestSequence.current && canRead) setDatasetState({ scope_key: scopeKey, data: response });
    }).catch((error: unknown) => {
      if (active && sequence === requestSequence.current && canRead) {
        setDatasetState({ scope_key: scopeKey, data: EMPTY_STATE });
        setLoadError(error instanceof Error ? error.message : "Không thể tải bảng kê.");
      }
    }).finally(() => {
      if (active && sequence === requestSequence.current) setLoading(false);
    });
    return () => {
      active = false;
      requestSequence.current += 1;
    };
  }, [branchId, canRead, isMockAdminAll, scopeKey]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => {
    requestSequence.current += 1;
    uploadSequence.current += 1;
  }, []);

  const toggleCollection = useCallback((collection: CashCollection, checked: boolean) => {
    if (!collections.some((item) => item.public_id === collection.public_id)) return;
    if (checked && selectedSourceBranchId !== null && selectedSourceBranchId !== collection.branch_id) {
      setSelectionError("Một phiếu nộp chỉ gồm bảng kê của cùng một chi nhánh/bưu cục. Bỏ chọn bảng kê hiện tại trước khi chọn đơn vị khác.");
      return;
    }
    setSelectionError(null);
    setSelection((current) => {
      const ids = current.scope_key === scopeKey ? current.ids : [];
      return { scope_key: scopeKey, ids: checked ? [...new Set([...ids, collection.public_id])] : ids.filter((id) => id !== collection.public_id) };
    });
  }, [collections, scopeKey, selectedSourceBranchId]);

  const toggleAllVisible = useCallback((checked: boolean) => {
    if (checked && selectAllBlocked) {
      setSelectionError("Hãy lọc theo một đơn vị nguồn trước khi chọn tất cả bảng kê.");
      return;
    }
    const visibleIds = selectableVisibleCollections.map((item) => item.public_id);
    setSelectionError(null);
    setSelection((current) => {
      const ids = current.scope_key === scopeKey ? current.ids : [];
      return { scope_key: scopeKey, ids: checked ? [...new Set([...ids, ...visibleIds])] : ids.filter((id) => !visibleIds.includes(id)) };
    });
  }, [scopeKey, selectableVisibleCollections, selectAllBlocked]);

  const clearReceipt = useCallback(() => {
    uploadSequence.current += 1;
    setReceipt(null); setUploadError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    selectedFile.current = null;
  }, [previewUrl]);

  const uploadFile = useCallback(async (file?: File) => {
    if (!file) return;
    const sequence = ++uploadSequence.current;
    selectedFile.current = file;
    const metadataError = validateReceiptMetadata(file);
    if (metadataError) { clearReceipt(); setUploadError(metadataError); return; }
    setUploading(true); setUploadError(null); setReceipt(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const localPreview = URL.createObjectURL(file); setPreviewUrl(localPreview);
    try {
      const readable = await isReadableImage(file);
      if (sequence !== uploadSequence.current) return;
      if (!readable) throw new Error("Tệp đã chọn không phải ảnh hợp lệ hoặc ảnh bị hỏng.");
      const uploaded = await uploadReceiptMock(file);
      if (sequence === uploadSequence.current) setReceipt(uploaded);
    } catch (error) {
      if (sequence === uploadSequence.current) {
        setReceipt(null);
        setUploadError(error instanceof Error ? error.message : "Không thể tải ảnh lên.");
      }
    } finally { if (sequence === uploadSequence.current) setUploading(false); }
  }, [clearReceipt, previewUrl]);

  const retryUpload = useCallback(() => {
    const file = selectedFile.current;
    if (file) void uploadFile(file);
    else setUploadError("Chọn lại ảnh để thử tải lên.");
  }, [uploadFile]);

  const submit = useCallback(async (values: TransferFormValues) => {
    if (submitLock.current || submitting) return;
    if (!permitted) { setSubmitError("Bạn chưa có quyền finance.remit để gửi phiếu."); return; }
    if (!selectedIds.length || !receipt || uploading || selectedSourceBranchId === null || !totalAmount || totalAmount === "0.00" || new Set(selectedCollections.map((item) => item.branch_id)).size !== 1) return;
    submitLock.current = true; setSubmitting(true); setSubmissionState(null); setSubmitError(null);
    const payloadSignature = JSON.stringify({ branch_id: selectedSourceBranchId, collection_ids: selectedIds, values, receipt });
    if (!attemptRef.current || attemptRef.current.signature !== payloadSignature) {
      setRetryPending(true);
      attemptRef.current = {
        signature: payloadSignature,
        attempt: { idempotency_key: crypto.randomUUID(), branch_id: selectedSourceBranchId, collection_ids: [...selectedIds], values: { ...values }, receipt: { ...receipt } },
      };
    }
    try {
      const result = await submitRemittanceMock(attemptRef.current.attempt);
      attemptRef.current = null;
      setRetryPending(false);
      setSubmissionState({ scope_key: scopeKey, value: result });
      setSelection({ scope_key: scopeKey, ids: [] });
      await load();
    } catch (error) {
      if (error instanceof RemittanceConflictError) {
        attemptRef.current = null;
        setRetryPending(false);
        setSelection({ scope_key: scopeKey, ids: [] });
        setSubmitError(error.message);
        await load();
      } else if (error instanceof RemittanceBlockedError) {
        attemptRef.current = null;
        setRetryPending(false);
        setSubmitError(error.message);
      } else {
        if (!(error instanceof RemittanceNetworkError)) {
          attemptRef.current = null;
          setRetryPending(false);
        }
        setSubmitError(error instanceof Error ? error.message : "Không thể gửi phiếu. Vui lòng thử lại.");
      }
    } finally { setSubmitting(false); submitLock.current = false; }
  }, [load, permitted, receipt, scopeKey, selectedIds, selectedSourceBranchId, selectedCollections, submitting, totalAmount, uploading]);

  const retrySubmit = useCallback(() => {
    const parsed = transferFormSchema.safeParse(form.getValues());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "bank_name" || field === "bank_account_no" || field === "bank_reference_no") form.setError(field, { message: issue.message });
      }
      return;
    }
    void submit(parsed.data);
  }, [form, submit]);

  return { branchId, branchName, isMockAdminAll, recipientName: dataset.selected_recipient_name, unitOptions, unitFilter, setUnitFilter, selectedSourceBranchId, selectedSourceBranchName, selectionError, selectableVisibleCollections, allVisibleSelected, selectAllBlocked, loading: isLoading, loadError, load, search, setSearch, collections, visibleCollections, selectedIds, selectedCollections, totalAmount, toggleCollection, toggleAllVisible, form, submit, retrySubmit, retryPending, submitError, canRead, needsMockBranchScope, permitted, uploading, uploadError, receipt, previewUrl, uploadFile, retryUpload, clearReceipt, submitting, submission, canMock: USE_MOCK };
}
