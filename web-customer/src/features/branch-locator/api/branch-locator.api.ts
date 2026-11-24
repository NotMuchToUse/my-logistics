import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import branchesMock from "@/mocks/branches.mock.json";
import type { ApiSuccessResponse } from "@/types/api.types";
import type {
  LogisticsBranch,
  PublicBranchDirectory,
} from "@/features/branch-locator/types/branch-locator.types";

interface BranchSearchParams {
  province_id?: number;
  district_id?: number;
  keyword?: string;
  accepts_counter_dropoff?: boolean;
}

const mockDirectory = branchesMock.success_response.data as unknown as PublicBranchDirectory;

function matchesMockFilters(
  branch: LogisticsBranch,
  params: BranchSearchParams,
): boolean {
  const normalizedKeyword = params.keyword?.trim().toLowerCase();

  if (
    params.province_id !== undefined &&
    branch.province_id !== params.province_id
  ) {
    return false;
  }

  if (
    params.district_id !== undefined &&
    branch.district_id !== params.district_id
  ) {
    return false;
  }

  if (
    params.accepts_counter_dropoff &&
    !branch.accepts_counter_dropoff
  ) {
    return false;
  }

  if (normalizedKeyword) {
    const searchable = [
      branch.name,
      branch.code,
      branch.address_line,
    ]
      .join(" ")
      .toLowerCase();

    if (!searchable.includes(normalizedKeyword)) {
      return false;
    }
  }

  return Boolean(branch.is_active);
}

export async function fetchPublicBranches(
  params: BranchSearchParams = {},
): Promise<PublicBranchDirectory> {
  if (USE_MOCK) {
    return {
      ...mockDirectory,
      branches: mockDirectory.branches.filter((branch) =>
        matchesMockFilters(branch, params),
      ),
    };
  }

  try {
    const response = await axiosClient.get<
      ApiSuccessResponse<LogisticsBranch[] | PublicBranchDirectory>
    >("/api/v1/public/branches", {
      params: {
        province_id: params.province_id,
        district_id: params.district_id,
        keyword: params.keyword?.trim() || undefined,
        accepts_counter_dropoff: params.accepts_counter_dropoff
          ? 1
          : undefined,
      },
    });

    const payload = response.data.data;

    if (Array.isArray(payload)) {
      return {
        branches: payload,
        provinces: mockDirectory.provinces,
        districts: mockDirectory.districts,
      };
    }

    return payload;
  } catch {
    return {
      ...mockDirectory,
      branches: mockDirectory.branches.filter((branch) =>
        matchesMockFilters(branch, params),
      ),
    };
  }
}
