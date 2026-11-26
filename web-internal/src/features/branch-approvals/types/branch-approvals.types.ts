export const APPROVAL_REQUEST_TYPES = [
  "cancel_delivered",
  "approve_return",
  "redelivery_over_limit",
] as const;

export type ApprovalRequestType = (typeof APPROVAL_REQUEST_TYPES)[number];
export type ApprovalRequestStatus = "pending" | "approved" | "rejected";

export interface BranchApproval {
  public_id: string;
  tracking_number: string;
  request_type: ApprovalRequestType;
  branch_id: number;
  branch_code?: string | null;
  branch_name?: string | null;
  reason: string;
  evidence_urls: string[];
  status: ApprovalRequestStatus;
  requested_by_name?: string | null;
  requested_at: string;
  review_note?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  version: number;
}

export interface CreateApprovalInput {
  tracking_number: string;
  request_type: ApprovalRequestType;
  branch_id: number;
  reason: string;
  evidence_urls: string[];
}

export interface ReviewApprovalInput {
  status: Extract<ApprovalRequestStatus, "approved" | "rejected">;
  review_note: string;
  version: number;
}

export interface BranchApprovalFilters {
  search: string;
  status: ApprovalRequestStatus | "all";
  request_type: ApprovalRequestType | "all";
}

export interface ApprovalBranchOption {
  id: number;
  code: string;
  name: string;
}
