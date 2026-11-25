import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "../../../types/api.types";
import type {
  DatabaseId,
  OpsConfigFilters,
  OpsConfigListParams,
} from "../types/ops-config.types";
import { getOpsConfigErrorMessage } from "../utils/ops-config-errors";

interface ResourceConfig<T, P> {
  list: (params: OpsConfigListParams) => Promise<ApiPaginationResponse<T>>;
  create: (payload: P) => Promise<ApiSuccessResponse<T>>;
  update: (id: DatabaseId, payload: P) => Promise<ApiSuccessResponse<T>>;
  onMutation?: () => Promise<void> | void;
}

export function useOpsConfigResource<T, P>(
  config: ResourceConfig<T, P>,
  enabled: boolean,
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<OpsConfigFilters>({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const requestSequence = useRef(0);
  const mutationLock = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);
    void Promise.resolve()
      .then(() =>
        configRef.current.list({
          page,
          per_page: perPage,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(Object.keys(filters).length ? { filters } : {}),
          signal: controller.signal,
        }),
      )
      .then((response) => {
        if (sequence !== requestSequence.current) return;
        setData(response.data);
        setTotal(response.meta.pagination.total);
        setTotalPages(response.meta.pagination.total_pages);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) {
          return;
        }
        setError(getOpsConfigErrorMessage(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === requestSequence.current) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [enabled, filters, page, perPage, refreshIndex, search]);

  const setFilter = useCallback((key: keyof OpsConfigFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearch("");
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);
  const clearError = useCallback(() => setError(null), []);

  const create = useCallback(
    async (payload: P) => {
      if (mutationLock.current) {
        throw new Error("Một thao tác lưu cấu hình đang được xử lý.");
      }
      mutationLock.current = true;
      setMutating(true);
      setError(null);
      try {
        const response = await configRef.current.create(payload);
        setRefreshIndex((current) => current + 1);
        await configRef.current.onMutation?.();
        return response;
      } catch (caught) {
        setError(getOpsConfigErrorMessage(caught));
        throw caught;
      } finally {
        mutationLock.current = false;
        setMutating(false);
      }
    },
    [],
  );

  const update = useCallback(
    async (id: DatabaseId, payload: P) => {
      if (mutationLock.current) {
        throw new Error("Một thao tác lưu cấu hình đang được xử lý.");
      }
      mutationLock.current = true;
      setMutating(true);
      setError(null);
      try {
        const response = await configRef.current.update(id, payload);
        setRefreshIndex((current) => current + 1);
        await configRef.current.onMutation?.();
        return response;
      } catch (caught) {
        setError(getOpsConfigErrorMessage(caught));
        throw caught;
      } finally {
        mutationLock.current = false;
        setMutating(false);
      }
    },
    [],
  );

  return {
    data,
    loading,
    mutating,
    error,
    page,
    perPage,
    search,
    filters,
    total,
    totalPages,
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    clearFilters,
    refresh,
    clearError,
    create,
    update,
  };
}
