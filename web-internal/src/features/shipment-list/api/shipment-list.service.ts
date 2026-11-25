import type { AxiosInstance } from "axios";
import { z } from "zod";
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/types/api.types";
import {
  CANCELLABLE_SHIPMENT_STATUSES,
  DEFAULT_SHIPMENT_PAGE_SIZE,
  MAX_SHIPMENT_PAGE_SIZE,
  SHIPMENT_STATUSES,
} from "../constants/shipment-list.constants.ts";
import {
  shipmentCancelMutationSchema,
  shipmentListQuerySchema,
  shipmentPriorityMutationSchema,
  shipmentPublicIdSchema,
} from "../schemas/shipment-list.schema.ts";
import type {
  ShipmentCancelMutation,
  ShipmentListItem,
  ShipmentListQuery,
  ShipmentListResponse,
  ShipmentPriorityMutation,
} from "../types/shipment-list.types";

interface MockShipmentListItem extends ShipmentListItem {
  origin_branch_id: number;
  destination_branch_id: number;
  service_type_id: number;
}

interface ShipmentListMockRecord extends Omit<ShipmentListItem, "status"> {
  status: string;
  origin_branch_id: number;
  destination_branch_id: number;
  service_type_id: number;
}

interface ShipmentListMockError {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
    trace_id?: string;
  };
}

interface ShipmentListMockFixture {
  data: {
    mock_only: {
      branch_scope_fixtures: Array<{
        public_id: string;
        branch_id: number;
      }>;
      phone_search_fixtures: Array<{
        public_id: string;
        sender_phone: string;
        recipient_phone: string;
      }>;
    };
    pagination_response: { data: ShipmentListMockRecord[] };
    error_responses: {
      forbidden: ShipmentListMockError;
      version_conflict: ShipmentListMockError;
      validation: ShipmentListMockError;
    };
  };
}

/** Branch ID filters are MOCK ONLY and are rejected in API mode. */
export type ShipmentListApiQuery = Omit<
  Partial<ShipmentListQuery>,
  "is_priority"
> & {
  is_priority?: boolean | 0 | 1 | "0" | "1";
  origin_branch_id?: number;
  destination_branch_id?: number;
};

export interface ShipmentListRequestScope {
  branchId: number | null;
  warehouseId: number | null;
}

interface ShipmentListApiDependencies {
  client: Pick<AxiosInstance, "get" | "patch" | "post">;
  useMock: boolean;
  fixture: ShipmentListMockFixture;
}

const branchIdSchema = z.number().int().positive();
const queryPrioritySchema = z
  .union([
    z.boolean(),
    z.literal(0),
    z.literal(1),
    z.literal("0"),
    z.literal("1"),
  ])
  .optional();
const mockErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.enum([
      "403_FORBIDDEN",
      "409_VERSION_CONFLICT",
      "422_VALIDATION_ERROR",
    ]),
    message: z.string().min(1),
    details: z.record(z.string(), z.array(z.string())).optional(),
    trace_id: z.string().optional(),
  }),
});

const shipmentListItemSchema = z
  .object({
    public_id: shipmentPublicIdSchema,
    tracking_code: z.string().min(1).max(50),
    status: z.enum(SHIPMENT_STATUSES),
    sender_name: z.string(),
    sender_phone_masked: z.string(),
    recipient_name: z.string(),
    recipient_phone_masked: z.string(),
    origin_branch_name: z.string(),
    destination_branch_name: z.string(),
    service_type_name: z.string(),
    assigned_driver_name: z.string().nullable(),
    parcel_count: z.number().int().nonnegative(),
    chargeable_weight_gram: z.number().int().nonnegative(),
    total_freight_amount: z.union([
      z.number().finite().nonnegative(),
      z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    ]),
    cod_amount: z.union([
      z.number().finite().nonnegative(),
      z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    ]),
    is_priority: z.boolean(),
    version: z.number().int().positive(),
    created_at: z.string().min(1),
  })
  .passthrough();

const mockShipmentListItemSchema = shipmentListItemSchema
  .extend({
    origin_branch_id: branchIdSchema,
    destination_branch_id: branchIdSchema,
    service_type_id: branchIdSchema,
  })
  .passthrough();

const paginationResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
  data: z.array(shipmentListItemSchema),
  meta: z.object({
    timestamp: z.string().min(1),
    pagination: z.object({
      page: z.number().int().positive(),
      per_page: z.number().int().positive().max(MAX_SHIPMENT_PAGE_SIZE),
      total: z.number().int().nonnegative(),
      total_pages: z.number().int().nonnegative(),
    }),
  }),
});

const priorityResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
  data: z.object({
    public_id: shipmentPublicIdSchema,
    is_priority: z.boolean(),
    version: z.number().int().positive(),
  }),
  meta: z.object({ timestamp: z.string().min(1) }),
});

const cancellationResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
  data: z.object({
    public_id: shipmentPublicIdSchema,
    status: z.literal("cancelled"),
    version: z.number().int().positive(),
  }),
  meta: z.object({ timestamp: z.string().min(1) }),
});

function abortError(): DOMException {
  return new DOMException("The request was aborted.", "AbortError");
}

async function runWithAbortSignal<T>(
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (signal?.aborted) {
    throw abortError();
  }

  try {
    return await operation();
  } catch (error) {
    if (signal?.aborted) {
      throw abortError();
    }
    throw error;
  }
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
}

function toApiShipment(row: MockShipmentListItem): ShipmentListItem {
  const {
    origin_branch_id: _originBranchId,
    destination_branch_id: _destinationBranchId,
    service_type_id: _serviceTypeId,
    ...shipment
  } = row;
  return { ...shipment };
}

function cloneApiError(error: ShipmentListMockError): ApiErrorResponse {
  const parsed = mockErrorEnvelopeSchema.parse(error);
  const details = parsed.error.details
    ? Object.fromEntries(
        Object.entries(parsed.error.details).map(([field, messages]) => [
          field,
          [...messages],
        ]),
      )
    : undefined;

  return {
    success: false,
    error: {
      ...parsed.error,
      details,
    },
  };
}

function createMockError(
  code: ApiErrorResponse["error"]["code"],
  message: string,
  details?: Record<string, string[]>,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function compareRows(
  left: MockShipmentListItem,
  right: MockShipmentListItem,
  sortBy: ShipmentListQuery["sort_by"],
  direction: ShipmentListQuery["sort_direction"],
): number {
  const leftValue = left[sortBy];
  const rightValue = right[sortBy];
  const comparison =
    sortBy === "created_at" || sortBy === "tracking_code"
      ? String(leftValue).localeCompare(String(rightValue))
      : Number(leftValue) - Number(rightValue);

  return direction === "ASC" ? comparison : -comparison;
}

export function createShipmentListApi({
  client,
  useMock,
  fixture,
}: ShipmentListApiDependencies) {
  const phoneSearchFixtures = new Map(
    fixture.data.mock_only.phone_search_fixtures.map((entry) => [
      entry.public_id,
      [entry.sender_phone, entry.recipient_phone].map(normalizePhone),
    ]),
  );
  const branchScopeFixtures = new Map(
    fixture.data.mock_only.branch_scope_fixtures.map((entry) => [
      entry.public_id,
      branchIdSchema.parse(entry.branch_id),
    ]),
  );
  let mockRows: MockShipmentListItem[] =
    fixture.data.pagination_response.data.map((row) =>
      mockShipmentListItemSchema.parse(row),
    );

  function parseQuery(input: ShipmentListApiQuery) {
    const priority = queryPrioritySchema.parse(input.is_priority);
    const normalizedPriority =
      priority === undefined
        ? undefined
        : priority === true || priority === 1 || priority === "1";
    const query = shipmentListQuerySchema.parse({
      page: input.page ?? 1,
      per_page: input.per_page ?? DEFAULT_SHIPMENT_PAGE_SIZE,
      tracking_code: normalizeOptionalString(input.tracking_code),
      phone: normalizeOptionalString(input.phone),
      status: normalizeOptionalString(input.status),
      service_type_id: input.service_type_id,
      is_priority: normalizedPriority,
      from_date: normalizeOptionalString(input.from_date),
      to_date: normalizeOptionalString(input.to_date),
      sort_by: input.sort_by ?? "created_at",
      sort_direction: input.sort_direction ?? "DESC",
    });
    const branches = z
      .object({
        origin_branch_id: branchIdSchema.optional(),
        destination_branch_id: branchIdSchema.optional(),
      })
      .parse({
        origin_branch_id: input.origin_branch_id,
        destination_branch_id: input.destination_branch_id,
      });

    return { query, branches };
  }

  function listMockShipments(
    query: ShipmentListQuery,
    branches: { origin_branch_id?: number; destination_branch_id?: number },
    branchScopeId: number | undefined,
  ): ShipmentListResponse {
    const filteredRows = mockRows.filter((row) => {
      if (query.tracking_code && row.tracking_code !== query.tracking_code) return false;
      if (query.phone) {
        const testPhones = phoneSearchFixtures.get(row.public_id) ?? [];
        if (!testPhones.includes(normalizePhone(query.phone))) return false;
      }
      if (query.status && row.status !== query.status) return false;
      if (
        query.service_type_id !== undefined &&
        row.service_type_id !== query.service_type_id
      ) {
        return false;
      }
      if (
        query.is_priority !== undefined &&
        row.is_priority !== query.is_priority
      ) {
        return false;
      }
      if (
        branches.origin_branch_id !== undefined &&
        row.origin_branch_id !== branches.origin_branch_id
      ) {
        return false;
      }
      if (
        branches.destination_branch_id !== undefined &&
        row.destination_branch_id !== branches.destination_branch_id
      ) {
        return false;
      }
      if (
        branchScopeId !== undefined &&
        branchScopeFixtures.get(row.public_id) !== branchScopeId
      ) {
        return false;
      }
      const createdDate = row.created_at.slice(0, 10);
      if (query.from_date && createdDate < query.from_date) return false;
      if (query.to_date && createdDate > query.to_date) return false;
      return true;
    });

    filteredRows.sort((left, right) =>
      compareRows(left, right, query.sort_by, query.sort_direction),
    );
    const total = filteredRows.length;
    const start = (query.page - 1) * query.per_page;
    const data = filteredRows
      .slice(start, start + query.per_page)
      .map(toApiShipment);

    return paginationResponseSchema.parse({
      success: true,
      message: "Lấy danh sách vận đơn thành công.",
      data,
      meta: {
        pagination: {
          page: query.page,
          per_page: query.per_page,
          total,
          total_pages: Math.ceil(total / query.per_page),
        },
        timestamp: createTimestamp(),
      },
    });
  }

  return {
    async fetchShipmentsApi(
      input: ShipmentListApiQuery = {},
      signal?: AbortSignal,
      scope?: ShipmentListRequestScope,
    ): Promise<ShipmentListResponse> {
      const { query, branches } = parseQuery(input);
      if (signal?.aborted) throw abortError();

      if (useMock) {
        if (scope?.warehouseId !== undefined && scope.warehouseId !== null) {
          throw new Error(
            "Mock fixture chưa mô phỏng phạm vi kho; không tải danh sách ngoài scope đã xác nhận.",
          );
        }
        const branchScopeId =
          scope?.branchId === undefined || scope.branchId === null
            ? undefined
            : branchIdSchema.parse(scope.branchId);
        return listMockShipments(query, branches, branchScopeId);
      }
      if (
        branches.origin_branch_id !== undefined ||
        branches.destination_branch_id !== undefined
      ) {
        throw new Error(
          "Bộ lọc chi nhánh chỉ khả dụng ở Mock Mode; Backend chưa hỗ trợ.",
        );
      }

      const allParams = {
        page: query.page,
        per_page: query.per_page,
        tracking_code: query.tracking_code,
        phone: query.phone,
        status: query.status,
        service_type_id: query.service_type_id,
        is_priority:
          query.is_priority === undefined
            ? undefined
            : Number(query.is_priority),
        from_date: query.from_date,
        to_date: query.to_date,
        sort_by: query.sort_by,
        sort_direction: query.sort_direction,
      };
      const params = Object.fromEntries(
        Object.entries(allParams).filter(([, value]) => value !== undefined),
      );

      return runWithAbortSignal(signal, async () => {
        const response = await client.get<unknown>("/api/v1/shipments", {
          params,
          signal,
        });
        return paginationResponseSchema.parse(response.data);
      });
    },

    async updateShipmentPriorityApi(
      publicId: string,
      input: ShipmentPriorityMutation,
      signal?: AbortSignal,
    ): Promise<ApiSuccessResponse<{ public_id: string; is_priority: boolean; version: number }>> {
      const id = shipmentPublicIdSchema.parse(publicId);
      const payload = shipmentPriorityMutationSchema.parse(input);
      if (signal?.aborted) throw abortError();

      if (useMock) {
        const shipment = mockRows.find((row) => row.public_id === id);
        if (!shipment) {
          throw createMockError("404_NOT_FOUND", "Không tìm thấy vận đơn.");
        }
        if (shipment.version !== payload.version) {
          throw cloneApiError(fixture.data.error_responses.version_conflict);
        }

        shipment.is_priority = payload.is_priority;
        shipment.version += 1;
        return priorityResponseSchema.parse({
          success: true,
          message: "Cập nhật ưu tiên vận đơn thành công.",
          data: {
            public_id: shipment.public_id,
            is_priority: shipment.is_priority,
            version: shipment.version,
          },
          meta: { timestamp: createTimestamp() },
        });
      }

      return runWithAbortSignal(signal, async () => {
        const response = await client.patch<unknown>(
          `/api/v1/shipments/${id}/priority`,
          payload,
          { signal },
        );
        return priorityResponseSchema.parse(response.data);
      });
    },

    async cancelShipmentApi(
      publicId: string,
      input: ShipmentCancelMutation,
      signal?: AbortSignal,
    ): Promise<ApiSuccessResponse<{ public_id: string; status: "cancelled"; version: number }>> {
      const id = shipmentPublicIdSchema.parse(publicId);
      const payload = shipmentCancelMutationSchema.parse(input);
      if (signal?.aborted) throw abortError();

      if (useMock) {
        const shipment = mockRows.find((row) => row.public_id === id);
        if (!shipment) {
          throw createMockError("404_NOT_FOUND", "Không tìm thấy vận đơn.");
        }
        if (shipment.version !== payload.version) {
          throw cloneApiError(fixture.data.error_responses.version_conflict);
        }
        if (
          !CANCELLABLE_SHIPMENT_STATUSES.some(
            (status) => status === shipment.status,
          )
        ) {
          throw cloneApiError(fixture.data.error_responses.validation);
        }

        shipment.status = "cancelled";
        shipment.version += 1;
        return cancellationResponseSchema.parse({
          success: true,
          message: "Hủy vận đơn thành công.",
          data: {
            public_id: shipment.public_id,
            status: shipment.status,
            version: shipment.version,
          },
          meta: { timestamp: createTimestamp() },
        });
      }

      return runWithAbortSignal(signal, async () => {
        const response = await client.post<unknown>(
          `/api/v1/shipments/${id}/cancel`,
          payload,
          { signal },
        );
        return cancellationResponseSchema.parse(response.data);
      });
    },
  };
}
