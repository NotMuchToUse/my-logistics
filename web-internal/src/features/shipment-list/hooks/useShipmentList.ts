import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getScopeKey,
  useBranchScopeStore,
} from "@/core/stores/useBranchScopeStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import {
  DEFAULT_SHIPMENT_PAGE_SIZE,
  MAX_SHIPMENT_PAGE_SIZE,
  SHIPMENT_LIST_PERMISSIONS,
} from "../constants/shipment-list.constants.ts";
import {
  shipmentFilterSchema,
  shipmentListQuerySchema,
} from "../schemas/shipment-list.schema.ts";
import {
  fetchShipmentsApi,
  shipmentListCapabilities,
} from "../api/shipment-list.api";
import type {
  ShipmentFilterValues,
  ShipmentListItem,
  ShipmentPagination,
  ShipmentSortField,
  SortDirection,
} from "../types/shipment-list.types";
import {
  buildShipmentListQuery,
  createDefaultShipmentFilters,
  DEFAULT_SHIPMENT_SORTING,
  getPageWithinResponse,
  hasShipmentPermission,
  isShipmentRequestAborted,
  reconcilePageSelection,
  type ShipmentListSorting,
} from "./shipment-list.hook-logic";

const EMPTY_PAGINATION: ShipmentPagination = {
  page: 1,
  per_page: DEFAULT_SHIPMENT_PAGE_SIZE,
  total: 0,
  total_pages: 0,
};

function isAbortError(error: unknown): boolean {
  return isShipmentRequestAborted(error);
}

export function useShipmentList() {
  const [items, setItems] = useState<ShipmentListItem[]>([]);
  const [draftFilters, setDraftFilters] = useState(createDefaultShipmentFilters);
  const [appliedFilters, setAppliedFilters] = useState(createDefaultShipmentFilters);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_SHIPMENT_PAGE_SIZE);
  const [sorting, setSortingState] = useState<ShipmentListSorting>(
    DEFAULT_SHIPMENT_SORTING,
  );
  const [pagination, setPagination] =
    useState<ShipmentPagination>(EMPTY_PAGINATION);
  const [selectedPublicIds, setSelectedPublicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [filterError, setFilterError] = useState<unknown>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const userPublicId = useAuthStore((state) => state.user?.public_id ?? null);
  const token = useAuthStore((state) => state.token);
  const permissions = useAuthStore((state) => state.permissions);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const activeScope = useBranchScopeStore((state) => state.activeScope);
  const activeBranchId = useBranchScopeStore((state) => state.activeBranchId);
  const activeWarehouseId = useBranchScopeStore(
    (state) => state.activeWarehouseId,
  );

  const canRead = isAuthenticated && hasShipmentPermission(permissions, "read");
  const branchFiltersSupported = shipmentListCapabilities.branchFilters;
  const scopeKey = activeScope ? getScopeKey(activeScope) : "none";
  const scopeContext = useMemo(
    () => ({ branchId: activeBranchId, warehouseId: activeWarehouseId }),
    [activeBranchId, activeWarehouseId],
  );
  const sessionKey = JSON.stringify([userPublicId, token, permissions]);
  const dataContextKey = JSON.stringify([scopeKey, sessionKey]);
  const [itemsContextKey, setItemsContextKey] = useState(dataContextKey);
  const hasCurrentDataContext =
    canRead && itemsContextKey === dataContextKey;
  const requestId = useRef(0);
  const hasLoaded = useRef(false);
  const previousScopeKey = useRef(scopeKey);
  const scopeChanged = previousScopeKey.current !== scopeKey;

  const requestQuery = useMemo(
    () =>
      buildShipmentListQuery(
        appliedFilters,
        page,
        pageSize,
        sorting,
        branchFiltersSupported,
      ),
    [appliedFilters, branchFiltersSupported, page, pageSize, sorting],
  );
  const requestKey = JSON.stringify([requestQuery, scopeKey, sessionKey]);

  useEffect(() => {
    if (!scopeChanged) return;

    previousScopeKey.current = scopeKey;
    hasLoaded.current = false;
    setItems([]);
    setPagination({
      ...EMPTY_PAGINATION,
      per_page: pageSize,
    });
    setSelectedPublicIds(new Set());
    setPageState(1);
    setDraftFilters((current) => ({
      ...current,
      origin_branch_id: "",
      destination_branch_id: "",
    }));
    setAppliedFilters((current) => ({
      ...current,
      origin_branch_id: "",
      destination_branch_id: "",
    }));
    setError(null);
    setFilterError(null);
    setLoading(canRead);
    setRefetching(false);
  }, [canRead, pageSize, scopeChanged, scopeKey]);

  useEffect(() => {
    if (scopeChanged) return;
    if (!canRead) {
      hasLoaded.current = false;
      setItems([]);
      setPagination({ ...EMPTY_PAGINATION, per_page: pageSize });
      setSelectedPublicIds(new Set());
      setLoading(false);
      setRefetching(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const currentRequestId = ++requestId.current;
    setError(null);
    setLoading(!hasLoaded.current);
    setRefetching(hasLoaded.current);

    void fetchShipmentsApi(requestQuery, controller.signal, scopeContext)
      .then((response) => {
        if (
          controller.signal.aborted ||
          requestId.current !== currentRequestId
        ) {
          return;
        }

        const validPage = getPageWithinResponse(
          page,
          response.meta.pagination.total_pages,
        );
        if (validPage !== page) {
          setPageState(validPage);
          return;
        }

        hasLoaded.current = true;
        setItems(response.data);
        setItemsContextKey(dataContextKey);
        setPagination(response.meta.pagination);
        setSelectedPublicIds((current) =>
          reconcilePageSelection(current, response.data),
        );
      })
      .catch((requestError: unknown) => {
        if (
          controller.signal.aborted ||
          requestId.current !== currentRequestId ||
          isAbortError(requestError)
        ) {
          return;
        }

        setError(requestError);
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          requestId.current === currentRequestId
        ) {
          setLoading(false);
          setRefetching(false);
        }
      });

    return () => {
      controller.abort();
      if (requestId.current === currentRequestId) {
        requestId.current += 1;
      }
    };
  }, [
    canRead,
    page,
    pageSize,
    requestKey,
    requestQuery,
    refreshVersion,
    dataContextKey,
    scopeChanged,
    scopeContext,
  ]);

  const clearPageSelection = useCallback(() => {
    setSelectedPublicIds(new Set());
  }, []);

  const updateDraftFilter = useCallback(
    <K extends keyof ShipmentFilterValues>(
      key: K,
      value: ShipmentFilterValues[K],
    ) => {
      setDraftFilters((current) => ({ ...current, [key]: value }));
      setFilterError(null);
      clearPageSelection();
    },
    [clearPageSelection],
  );

  const applyFilters = useCallback((): boolean => {
    const parsed = shipmentFilterSchema.safeParse(draftFilters);
    if (!parsed.success) {
      setFilterError(parsed.error);
      return false;
    }
    if (
      !branchFiltersSupported &&
      (parsed.data.origin_branch_id !== "" ||
        parsed.data.destination_branch_id !== "")
    ) {
      setFilterError(
        new Error(
          "Bộ lọc chi nhánh gửi/nhận chưa được Backend hỗ trợ; chỉ khả dụng ở Mock Mode.",
        ),
      );
      return false;
    }

    setAppliedFilters(parsed.data);
    setPageState(1);
    setItems([]);
    setPagination({ ...EMPTY_PAGINATION, per_page: pageSize });
    hasLoaded.current = false;
    setError(null);
    setFilterError(null);
    clearPageSelection();
    return true;
  }, [
    branchFiltersSupported,
    clearPageSelection,
    draftFilters,
    pageSize,
  ]);

  const resetFilters = useCallback(() => {
    const defaults = createDefaultShipmentFilters();
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setPageState(1);
    setPageSizeState(DEFAULT_SHIPMENT_PAGE_SIZE);
    setSortingState(DEFAULT_SHIPMENT_SORTING);
    setPagination(EMPTY_PAGINATION);
    setItems([]);
    hasLoaded.current = false;
    setError(null);
    setFilterError(null);
    clearPageSelection();
  }, [clearPageSelection]);

  const setPage = useCallback(
    (nextPage: number) => {
      const validated = shipmentListQuerySchema.safeParse({
        ...requestQuery,
        page: nextPage,
      });
      if (!validated.success || nextPage === page) return false;
      setPageState(nextPage);
      setItems([]);
      hasLoaded.current = false;
      clearPageSelection();
      return true;
    },
    [clearPageSelection, page, requestQuery],
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      if (
        !Number.isInteger(nextPageSize) ||
        nextPageSize < 1 ||
        nextPageSize > MAX_SHIPMENT_PAGE_SIZE
      ) {
        return false;
      }
      if (nextPageSize === pageSize) return true;

      setPageSizeState(nextPageSize);
      setPageState(1);
      setPagination((current) => ({
        ...current,
        page: 1,
        per_page: nextPageSize,
      }));
      setItems([]);
      hasLoaded.current = false;
      clearPageSelection();
      return true;
    },
    [clearPageSelection, pageSize],
  );

  const setSorting = useCallback(
    (sortBy: ShipmentSortField, sortDirection: SortDirection) => {
      const validated = shipmentListQuerySchema.safeParse({
        ...requestQuery,
        page: 1,
        sort_by: sortBy,
        sort_direction: sortDirection,
      });
      if (!validated.success) return false;
      if (
        sorting.sortBy === sortBy &&
        sorting.sortDirection === sortDirection
      ) {
        return true;
      }

      setSortingState({ sortBy, sortDirection });
      setPageState(1);
      setItems([]);
      hasLoaded.current = false;
      clearPageSelection();
      return true;
    },
    [clearPageSelection, requestQuery, sorting],
  );

  const toggleRowSelection = useCallback(
    (publicId: string, checked?: boolean) => {
      setSelectedPublicIds((current) => {
        if (!items.some((item) => item.public_id === publicId)) return current;
        const next = new Set(current);
        const shouldSelect = checked ?? !next.has(publicId);
        if (shouldSelect) next.add(publicId);
        else next.delete(publicId);
        return next;
      });
    },
    [items],
  );

  const setCurrentPageSelection = useCallback(
    (checked: boolean) => {
      setSelectedPublicIds((current) => {
        const next = new Set(current);
        for (const { public_id: publicId } of items) {
          if (checked) next.add(publicId);
          else next.delete(publicId);
        }
        return next;
      });
    },
    [items],
  );

  const refetch = useCallback(() => {
    setRefreshVersion((current) => current + 1);
  }, []);

  return {
    items: hasCurrentDataContext ? items : [],
    draftFilters,
    appliedFilters,
    filterError,
    loading,
    refetching,
    error,
    pagination,
    page,
    pageSize,
    sorting,
    selectedPublicIds: hasCurrentDataContext
      ? selectedPublicIds
      : new Set<string>(),
    branchScope: {
      key: scopeKey,
      branchId: activeBranchId,
      warehouseId: activeWarehouseId,
    },
    canRead,
    capabilities: {
      branchFilters: branchFiltersSupported,
      warehouseScopeMockData:
        shipmentListCapabilities.warehouseScopeMockData,
      forwarding: shipmentListCapabilities.forwarding,
      mockPermissionsConfirmed:
        shipmentListCapabilities.mockPermissionsConfirmed,
    },
    updateDraftFilter,
    applyFilters,
    resetFilters,
    setPage,
    setPageSize,
    setSorting,
    toggleRowSelection,
    setCurrentPageSelection,
    clearPageSelection,
    refetch,
    permissionCode: SHIPMENT_LIST_PERMISSIONS.read,
  };
}
