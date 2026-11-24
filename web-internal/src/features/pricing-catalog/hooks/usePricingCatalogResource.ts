import { useCallback, useEffect, useRef, useState } from "react";
import type { MasterDataListResponse } from "../types/pricing-catalog.types";
import {
  createCatalogMutationGuard,
  isStaleCatalogRequest,
  normalizeCatalogError,
  type CatalogApiError,
} from "./pricing-catalog-state";

interface CatalogResourceConfig<T, P> {
  list: (params: { page: number; per_page: number; search?: string }) => Promise<MasterDataListResponse<T>>;
  detail?: (id: number) => Promise<{ success: true; data: T; message: string }>;
  create: (payload: P) => Promise<{ success: true; data: T; message: string }>;
  update: (id: number, payload: P) => Promise<{ success: true; data: T; message: string }>;
  remove: (id: number) => Promise<{ success: true; data: null; message: string }>;
}

export function usePricingCatalogResource<T, P>(config: CatalogResourceConfig<T, P>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<CatalogApiError | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const requestSequence = useRef(0);
  const configRef = useRef(config);
  const mutationGuard = useRef(createCatalogMutationGuard());
  configRef.current = config;

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const response = await configRef.current.list({
        page,
        per_page: perPage,
        ...(search ? { search } : {}),
      });
      if (isStaleCatalogRequest(sequence, requestSequence.current)) return;
      setData(response.data);
      setTotal(response.meta.pagination.total);
      setTotalPages(response.meta.pagination.total_pages);
    } catch (caught) {
      if (isStaleCatalogRequest(sequence, requestSequence.current)) return;
      setError(normalizeCatalogError(caught));
    } finally {
      if (!isStaleCatalogRequest(sequence, requestSequence.current)) {
        setLoading(false);
      }
    }
  }, [page, perPage, search, refreshIndex]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback((payload: P) => {
    return mutationGuard.current.run(async () => {
      setMutating(true);
      setError(null);
      try {
        const response = await configRef.current.create(payload);
        await load();
        return response;
      } catch (caught) {
        setError(normalizeCatalogError(caught));
        throw caught;
      } finally {
        setMutating(false);
      }
    });
  }, [load]);

  const update = useCallback((id: number, payload: P) => {
    return mutationGuard.current.run(async () => {
      setMutating(true);
      setError(null);
      try {
        const response = await configRef.current.update(id, payload);
        await load();
        return response;
      } catch (caught) {
        setError(normalizeCatalogError(caught));
        throw caught;
      } finally {
        setMutating(false);
      }
    });
  }, [load]);

  const remove = useCallback((id: number) => {
    return mutationGuard.current.run(async () => {
      setMutating(true);
      setError(null);
      try {
        const response = await configRef.current.remove(id);
        await load();
        return response;
      } catch (caught) {
        setError(normalizeCatalogError(caught));
        throw caught;
      } finally {
        setMutating(false);
      }
    });
  }, [load]);

  const refresh = useCallback(() => setRefreshIndex((value) => value + 1), []);

  return {
    data,
    loading,
    mutating,
    error,
    page,
    perPage,
    search,
    total,
    totalPages,
    setPage,
    setPerPage,
    setSearch,
    refresh,
    create,
    update,
    remove,
  };
}
