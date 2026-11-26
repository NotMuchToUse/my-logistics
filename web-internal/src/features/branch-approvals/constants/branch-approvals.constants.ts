import type {
  ApprovalRequestStatus,
  ApprovalRequestType,
} from "../types/branch-approvals.types";

export const APPROVAL_TYPE_LABELS: Record<ApprovalRequestType, string> = {
  cancel_delivered: "Hủy giao hàng thành công",
  approve_return: "Duyệt chuyển hoàn",
  redelivery_over_limit: "Giao lại vượt số lần",
};

export const APPROVAL_STATUS_META: Record<
  ApprovalRequestStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Chờ duyệt",
    className: "border-amber-300 bg-amber-100 text-amber-800",
  },
  approved: {
    label: "Đã phê duyệt",
    className: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  rejected: {
    label: "Đã từ chối",
    className: "border-rose-300 bg-rose-100 text-rose-800",
  },
};

export const FALLBACK_APPROVAL_BRANCHES = [
  { id: 3, code: "BC-HC1", name: "Bưu cục Hải Châu 1 - Đà Nẵng" },
  { id: 4, code: "BC-ST1", name: "Bưu cục Sơn Trà - Đà Nẵng" },
  { id: 5, code: "BC-BD1", name: "Bưu cục Ba Đình - Hà Nội" },
];
