import type { ApiErrorCode } from "@/types/api.types";
import {
  CANCELLABLE_SHIPMENT_STATUSES,
  SHIPMENT_LIST_PERMISSIONS,
} from "../constants/shipment-list.constants.ts";
import { shipmentFilterSchema, shipmentListQuerySchema } from "../schemas/shipment-list.schema.ts";
import type {
  ShipmentFilterValues,
  ShipmentListItem,
  ShipmentSortField,
  SortDirection,
} from "../types/shipment-list.types";
import type { ShipmentListApiQuery } from "../api/shipment-list.service";

export interface ShipmentListSorting {
  sortBy: ShipmentSortField;
  sortDirection: SortDirection;
}

export const DEFAULT_SHIPMENT_SORTING: ShipmentListSorting = {
  sortBy: "created_at",
  sortDirection: "DESC",
};

export function createDefaultShipmentFilters(): ShipmentFilterValues {
  return {
    tracking_code: "",
    phone: "",
    origin_branch_id: "",
    destination_branch_id: "",
    service_type_id: "",
    status: "",
    from_date: "",
    to_date: "",
    is_priority: "all",
  };
}

export class MockOnlyShipmentFilterError extends Error {
  constructor() {
    super("Bộ lọc chi nhánh gửi/nhận chỉ khả dụng ở Mock Mode.");
    this.name = "MockOnlyShipmentFilterError";
  }
}

export function buildShipmentListQuery(
  inputFilters: ShipmentFilterValues,
  page: number,
  perPage: number,
  sorting: ShipmentListSorting,
  branchFiltersSupported: boolean,
): ShipmentListApiQuery {
  const filters = shipmentFilterSchema.parse(inputFilters);
  const hasMockOnlyBranchFilters =
    filters.origin_branch_id !== "" || filters.destination_branch_id !== "";

  if (!branchFiltersSupported && hasMockOnlyBranchFilters) {
    throw new MockOnlyShipmentFilterError();
  }

  const query: ShipmentListApiQuery = {
    page,
    per_page: perPage,
    sort_by: sorting.sortBy,
    sort_direction: sorting.sortDirection,
  };
  const trackingCode = filters.tracking_code.trim();
  const phone = filters.phone.trim();

  if (trackingCode) query.tracking_code = trackingCode;
  if (phone) query.phone = phone;
  if (filters.status) query.status = filters.status;
  if (filters.service_type_id) {
    query.service_type_id = Number(filters.service_type_id);
  }
  if (filters.is_priority !== "all") {
    query.is_priority = filters.is_priority === "1";
  }
  if (filters.from_date) query.from_date = filters.from_date;
  if (filters.to_date) query.to_date = filters.to_date;
  if (filters.origin_branch_id) {
    query.origin_branch_id = Number(filters.origin_branch_id);
  }
  if (filters.destination_branch_id) {
    query.destination_branch_id = Number(filters.destination_branch_id);
  }

  const validatedQuery = shipmentListQuerySchema.parse(query);

  return {
    ...validatedQuery,
    ...(query.origin_branch_id !== undefined
      ? { origin_branch_id: query.origin_branch_id }
      : {}),
    ...(query.destination_branch_id !== undefined
      ? { destination_branch_id: query.destination_branch_id }
      : {}),
  };
}

export function canCancelShipmentStatus(status: ShipmentListItem["status"]): boolean {
  return CANCELLABLE_SHIPMENT_STATUSES.some((value) => value === status);
}

export function getPageWithinResponse(
  requestedPage: number,
  totalPages: number,
): number {
  return totalPages === 0
    ? 1
    : Math.min(requestedPage, totalPages);
}

export function reconcilePageSelection(
  selectedPublicIds: ReadonlySet<string>,
  visibleItems: readonly ShipmentListItem[],
): Set<string> {
  const visiblePublicIds = new Set(visibleItems.map((item) => item.public_id));
  return new Set(
    [...selectedPublicIds].filter((publicId) => visiblePublicIds.has(publicId)),
  );
}

export function toggleVisibleShipmentSelection(
  selectedPublicIds: ReadonlySet<string>,
  publicId: string,
  visibleItems: readonly ShipmentListItem[],
  checked?: boolean,
): Set<string> {
  if (!visibleItems.some((item) => item.public_id === publicId)) {
    return new Set(selectedPublicIds);
  }

  const next = new Set(selectedPublicIds);
  const shouldSelect = checked ?? !next.has(publicId);
  if (shouldSelect) next.add(publicId);
  else next.delete(publicId);
  return next;
}

export function toggleCurrentPageSelection(
  selectedPublicIds: ReadonlySet<string>,
  visibleItems: readonly ShipmentListItem[],
  checked: boolean,
): Set<string> {
  const next = new Set(selectedPublicIds);
  for (const { public_id: publicId } of visibleItems) {
    if (checked) next.add(publicId);
    else next.delete(publicId);
  }
  return next;
}

const API_ERROR_CODES: readonly ApiErrorCode[] = [
  "400_BAD_REQUEST",
  "401_UNAUTHORIZED",
  "403_FORBIDDEN",
  "403_BRANCH_SCOPE",
  "404_NOT_FOUND",
  "409_VERSION_CONFLICT",
  "409_IDEMPOTENCY_DUPLICATE",
  "422_VALIDATION_ERROR",
  "429_TOO_MANY_REQUESTS",
  "500_INTERNAL_ERROR",
];

export function getShipmentApiErrorCode(error: unknown): ApiErrorCode | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("error" in error)
  ) {
    return undefined;
  }

  const apiError = error.error;
  if (
    typeof apiError !== "object" ||
    apiError === null ||
    !("code" in apiError) ||
    typeof apiError.code !== "string"
  ) {
    return undefined;
  }

  return API_ERROR_CODES.find((code) => code === apiError.code);
}

export function isShipmentRequestAborted(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("name" in error && (error.name === "AbortError" || error.name === "CanceledError")) {
    return true;
  }
  return "code" in error && error.code === "ERR_CANCELED";
}

export function isMutationOutcomeUncertain(error: unknown): boolean {
  const code = getShipmentApiErrorCode(error);
  if (code === "500_INTERNAL_ERROR") return true;

  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (
    error.code === "ERR_NETWORK" ||
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT"
  );
}

export function shouldRefetchAfterMutationError(error: unknown): boolean {
  return (
    getShipmentApiErrorCode(error) === "409_VERSION_CONFLICT" ||
    isMutationOutcomeUncertain(error)
  );
}

export function hasShipmentPermission(
  permissions: readonly string[],
  action: "read" | "priority" | "cancel",
): boolean {
  return (
    permissions.includes("*") ||
    permissions.includes(SHIPMENT_LIST_PERMISSIONS[action])
  );
}
