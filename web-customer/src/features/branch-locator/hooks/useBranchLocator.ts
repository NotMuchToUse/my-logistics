import { useCallback, useEffect, useState } from "react";
import { fetchPublicBranches } from "@/features/branch-locator/api/branch-locator.api";
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

export function useBranchLocator() {
  const [directory, setDirectory] = useState<PublicBranchDirectory>({
    branches: [],
    provinces: [],
    districts: [],
  });
  const [branches, setBranches] = useState<LogisticsBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const searchBranches = useCallback(
    async (params: BranchSearchParams = {}) => {
      setIsLoading(true);
      setError("");

      try {
        const result = await fetchPublicBranches(params);
        setDirectory(result);
        setBranches(result.branches);
      } catch (searchError: unknown) {
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Không thể tải danh sách bưu cục.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchPublicBranches().then(
      (result) => {
        setDirectory(result);
        setBranches(result.branches);
        setIsLoading(false);
      },
      (searchError: unknown) => {
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Không thể tải danh sách bưu cục.",
        );
        setIsLoading(false);
      },
    );
  }, []);

  return { directory, branches, isLoading, error, searchBranches };
}
