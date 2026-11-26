import { FALLBACK_APPROVAL_BRANCHES } from "../constants/branch-approvals.constants";
import type {
  BranchApproval,
  BranchApprovalFilters,
  CreateApprovalInput,
  ReviewApprovalInput,
} from "../types/branch-approvals.types";

const now = Date.now();
const requests: BranchApproval[] = [
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4APRV1",
    tracking_number: "VS26112300200",
    request_type: "cancel_delivered",
    branch_id: 3,
    branch_code: "BC-HC1",
    branch_name: "Bưu cục Hải Châu 1 - Đà Nẵng",
    reason: "Tài xế xác nhận giao thành công nhầm, khách hàng chưa nhận được hàng.",
    evidence_urls: [
      "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=640",
    ],
    status: "pending",
    requested_by_name: "Nguyễn Văn Điều phối",
    requested_at: new Date(now - 12 * 60_000).toISOString(),
    version: 1,
  },
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4APRV2",
    tracking_number: "VS26112300201",
    request_type: "approve_return",
    branch_id: 4,
    branch_code: "BC-ST1",
    branch_name: "Bưu cục Sơn Trà - Đà Nẵng",
    reason: "Người nhận từ chối nhận hàng sau nhiều lần liên hệ.",
    evidence_urls: [],
    status: "pending",
    requested_by_name: "Trần Minh Điều phối",
    requested_at: new Date(now - 42 * 60_000).toISOString(),
    version: 1,
  },
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4APRV3",
    tracking_number: "VS26112300202",
    request_type: "redelivery_over_limit",
    branch_id: 5,
    branch_code: "BC-BD1",
    branch_name: "Bưu cục Ba Đình - Hà Nội",
    reason: "Khách hàng đề nghị giao lại vào khung giờ làm việc ngày mai.",
    evidence_urls: [],
    status: "approved",
    requested_by_name: "Lê Quốc Điều phối",
    requested_at: new Date(now - 90 * 60_000).toISOString(),
    review_note: "Đã xác nhận với khách hàng, đồng ý giao lại.",
    reviewed_by_name: "Quản lý chi nhánh",
    reviewed_at: new Date(now - 55 * 60_000).toISOString(),
    version: 2,
  },
];

let sequence = 4;

function findRequest(publicId: string): BranchApproval {
  const found = requests.find((request) => request.public_id === publicId);
  if (!found) {
    throw new Error("Không tìm thấy yêu cầu phê duyệt.");
  }
  return found;
}

export const branchApprovalsMock = {
  list(filters: BranchApprovalFilters): BranchApproval[] {
    const query = filters.search.trim().toLowerCase();
    return requests
      .filter((request) => filters.status === "all" || request.status === filters.status)
      .filter(
        (request) =>
          filters.request_type === "all" ||
          request.request_type === filters.request_type,
      )
      .filter(
        (request) =>
          !query ||
          [
            request.tracking_number,
            request.reason,
            request.branch_code ?? "",
            request.branch_name ?? "",
            request.requested_by_name ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
      )
      .map((request) => ({ ...request, evidence_urls: [...request.evidence_urls] }));
  },

  create(input: CreateApprovalInput): BranchApproval {
    const branch = FALLBACK_APPROVAL_BRANCHES.find(
      (option) => option.id === input.branch_id,
    );
    const created: BranchApproval = {
      ...input,
      public_id: `01JDC9X8K2M4N6P8Q0R2S4APRV${sequence++}`,
      branch_code: branch?.code ?? `BC-${input.branch_id}`,
      branch_name: branch?.name ?? `Chi nhánh #${input.branch_id}`,
      status: "pending",
      requested_by_name: "Điều phối viên",
      requested_at: new Date().toISOString(),
      version: 1,
    };
    requests.unshift(created);
    return { ...created, evidence_urls: [...created.evidence_urls] };
  },

  review(
    publicId: string,
    input: ReviewApprovalInput,
    reviewerName: string,
    seed?: BranchApproval,
  ): BranchApproval {
    let request: BranchApproval;
    try {
      request = findRequest(publicId);
    } catch (error) {
      if (!seed) throw error;
      requests.push({ ...seed, evidence_urls: [...seed.evidence_urls] });
      request = findRequest(publicId);
    }
    if (request.status !== "pending") {
      throw new Error("Yêu cầu này đã được xét duyệt.");
    }
    if (request.version !== input.version) {
      throw new Error("Yêu cầu đã được cập nhật, vui lòng tải lại.");
    }
    Object.assign(request, {
      status: input.status,
      review_note: input.review_note,
      reviewed_by_name: reviewerName,
      reviewed_at: new Date().toISOString(),
      version: request.version + 1,
    });
    return { ...request, evidence_urls: [...request.evidence_urls] };
  },
};
