import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import type {
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "@/types/api.types";
import { branchApprovalsMock } from "./branch-approvals.mock";
import type {
  BranchApproval,
  BranchApprovalFilters,
  CreateApprovalInput,
  ReviewApprovalInput,
} from "../types/branch-approvals.types";

async function runWithDevMock<T>(
  label: string,
  mockFn: () => T,
  apiFn: () => Promise<T>,
): Promise<T> {
  if (USE_MOCK) {
    return mockFn();
  }
  if (!import.meta.env.DEV) {
    return apiFn();
  }
  try {
    return await apiFn();
  } catch (error) {
    console.warn(`Fallback mock cho ${label}:`, error);
    return mockFn();
  }
}

export function getBranchApprovals(
  filters: BranchApprovalFilters,
): Promise<BranchApproval[]> {
  return runWithDevMock(
    "danh sách yêu cầu phê duyệt",
    () => branchApprovalsMock.list(filters),
    async () => {
      const params: Record<string, string> = {};
      params.page = "1";
      params.per_page = "100";
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status !== "all") params.status = filters.status;
      if (filters.request_type !== "all") {
        params.request_type = filters.request_type;
      }
      const response = await axiosClient.get<
        ApiPaginationResponse<BranchApproval>
      >("/api/v1/approvals", { params });
      return response.data.data;
    },
  );
}

export function createBranchApproval(
  input: CreateApprovalInput,
): Promise<BranchApproval> {
  return runWithDevMock(
    "tạo yêu cầu phê duyệt",
    () => branchApprovalsMock.create(input),
    async () => {
      const response = await axiosClient.post<
        ApiSuccessResponse<BranchApproval>
      >("/api/v1/approvals", input, {
        headers: { "X-Branch-Id": String(input.branch_id) },
      });
      return response.data.data;
    },
  );
}

export function reviewBranchApproval(
  approval: BranchApproval,
  input: ReviewApprovalInput,
  reviewerName: string,
): Promise<BranchApproval> {
  return runWithDevMock(
    "xét duyệt yêu cầu",
    () =>
      branchApprovalsMock.review(
        approval.public_id,
        input,
        reviewerName,
        approval,
      ),
    async () => {
      const response = await axiosClient.patch<
        ApiSuccessResponse<BranchApproval>
      >(
        `/api/v1/approvals/${encodeURIComponent(approval.public_id)}/review`,
        input,
        { headers: { "X-Branch-Id": String(approval.branch_id) } },
      );
      return response.data.data;
    },
  );
}
