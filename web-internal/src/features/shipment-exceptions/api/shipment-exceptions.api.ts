import { z } from "zod";
import { USE_MOCK } from "@/core/api/axiosClient";
import shipmentMock from "@/mocks/shipment.mock.json";
import type {
  ApiErrorResponse,
  ApiPaginationResponse,
  ShipmentStatus,
} from "@/types/api.types";
import type {
  ShipmentExceptionCapabilities,
  ShipmentExceptionsQuery,
  ShipmentExceptionListItem,
  ShipmentExceptionsTab,
  ShipmentInheritedInfo,
  ForwardShipmentRequest,
} from "@/features/shipment-exceptions/types/shipment-exceptions.types";

export interface ShipmentExceptionsApiQuery
  extends Omit<ShipmentExceptionsQuery, "status"> {
  tab: ShipmentExceptionsTab;
}

const shipmentStatusSchema = z.enum([
  "draft",
  "pending_pickup",
  "picked_up",
  "in_warehouse",
  "bagged",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "pending_return",
  "returning",
  "returned",
  "incident",
  "cancelled",
] as const);

const shipmentTypeSchema = z.enum([
  "standard",
  "return_shipment",
  "forward_shipment",
] as const);

const shipmentParcelSchema = z.object({
  parcel_index: z.number().int().positive(),
  parcel_barcode: z.string().min(1),
  length_cm: z.number().nonnegative(),
  width_cm: z.number().nonnegative(),
  height_cm: z.number().nonnegative(),
  actual_weight_gram: z.number().int().nonnegative(),
  volumetric_weight_gram: z.number().int().nonnegative(),
  chargeable_weight_gram: z.number().int().nonnegative(),
  description: z.string().nullable(),
});

const shipmentStatusHistorySchema = z.object({
  client_event_uuid: z.string().optional(),
  from_status: shipmentStatusSchema.nullable(),
  to_status: shipmentStatusSchema,
  branch_id: z.number().int().positive().optional(),
  warehouse_id: z.number().int().positive().nullable().optional(),
  actor_id: z.number().int().positive().optional(),
  description: z.string(),
  is_public_visible: z.union([z.literal(0), z.literal(1)]),
  occurred_at: z.string().min(1),
});

const mockShipmentListItemSchema = z
  .object({
    public_id: z.string().min(1),
    tracking_code: z.string().min(1),
    shipment_type: shipmentTypeSchema.optional(),
    status: shipmentStatusSchema,
    origin_branch_id: z.number().int().positive(),
    destination_branch_id: z.number().int().positive(),
    current_branch_id: z.number().int().positive(),
    current_warehouse_id: z.number().int().positive().optional(),
    assigned_driver_id: z.number().int().positive().optional(),
    service_type_id: z.number().int().positive(),
    cargo_category_id: z.number().int().positive(),
    parcel_count: z.number().int().nonnegative(),
    chargeable_weight_gram: z.number().int().nonnegative(),
    total_freight_amount: z.union([
      z.number().finite().nonnegative(),
      z.string(),
    ]),
    cod_amount: z.union([z.number().finite().nonnegative(), z.string()]),
    delivery_attempt_count: z.number().int().nonnegative().optional(),
    note: z.string().optional(),
    sender_name: z.string().optional(),
    sender_phone_masked: z.string().optional(),
    recipient_name: z.string().optional(),
    recipient_phone_masked: z.string().optional(),
    version: z.number().int().positive(),
    created_at: z.string().min(1),
    shipment_parcels: z.array(shipmentParcelSchema),
    shipment_status_history: z.array(shipmentStatusHistorySchema),
    parent_shipment_id: z.number().int().positive().optional(),
  })
  .passthrough();

const mockShipmentDetailSchema = z
  .object({
    public_id: z.string().min(1),
    tracking_code: z.string().min(1),
    status: shipmentStatusSchema,
    origin_branch_id: z.number().int().positive(),
    destination_branch_id: z.number().int().positive(),
    current_branch_id: z.number().int().positive(),
    current_warehouse_id: z.number().int().positive().nullable(),
    sender_name: z.string(),
    sender_phone_masked: z.string(),
    sender_province_id: z.number().int().positive(),
    sender_district_id: z.number().int().positive(),
    sender_ward_id: z.number().int().positive(),
    sender_address: z.string(),
    recipient_name: z.string(),
    recipient_phone_masked: z.string(),
    recipient_province_id: z.number().int().positive(),
    recipient_district_id: z.number().int().positive(),
    recipient_ward_id: z.number().int().positive(),
    recipient_address: z.string(),
    parcel_count: z.number().int().nonnegative(),
    cod_amount: z.union([z.number().finite().nonnegative(), z.string()]),
    delivery_attempt_count: z.number().int().nonnegative(),
    note: z.string().nullable(),
    version: z.number().int().positive(),
  })
  .passthrough();

const mockFixtureSchema = z.object({
  success_response: z.object({
    data: mockShipmentDetailSchema,
  }),
  pagination_response: z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(mockShipmentListItemSchema),
    meta: z.object({
      pagination: z.object({
        page: z.number().int().positive(),
        per_page: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        total_pages: z.number().int().nonnegative(),
      }),
      timestamp: z.string(),
    }),
  }),
});

function createTimestamp(): string {
  return new Date().toISOString();
}

function createBackendUnavailableError(): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: "500_INTERNAL_ERROR",
      message:
        "Backend Shipment chưa khả dụng trên nhánh nhan; không thể tải dữ liệu vận đơn.",
    },
  };
}

function createInvalidQueryError(field: "page" | "per_page"): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: "422_VALIDATION_ERROR",
      message: "Tham số phân trang không hợp lệ.",
      details: {
        [field]: ["Giá trị phải là số nguyên dương."],
      },
    },
  };
}

function normalizeTrackingCode(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase("vi-VN") ?? "";
}

function mapListItem(
  row: z.output<typeof mockShipmentListItemSchema>,
): ShipmentExceptionListItem {
  return {
    public_id: row.public_id,
    tracking_code: row.tracking_code,
    status: row.status,
    shipment_type: row.shipment_type,
    recipient_name: row.recipient_name,
    recipient_phone_masked: row.recipient_phone_masked,
    origin_branch_id: row.origin_branch_id,
    destination_branch_id: row.destination_branch_id,
    current_branch_id: row.current_branch_id,
    delivery_attempt_count: row.delivery_attempt_count,
    cod_amount: row.cod_amount,
    version: row.version,
    created_at: row.created_at,
    note: row.note,
    parent_shipment_id: row.parent_shipment_id,
  };
}

function filterByTab(
  tab: ShipmentExceptionsTab,
  status: ShipmentStatus,
): boolean {
  if (tab === "pending-return") {
    return status === "pending_return";
  }

  return status === "delivery_failed" || status === "incident";
}

export function getShipmentExceptionCapabilities(
  tab: ShipmentExceptionsTab,
  useMock: boolean = USE_MOCK,
): ShipmentExceptionCapabilities {
  if (!useMock) {
    return {
      canViewList: false,
      canOpenReturnModal: false,
      canCreateReturnShipment: false,
      canOpenForwardModal: false,
      canCreateForwardShipment: false,
      canApproveRedelivery: false,
      unavailableReason:
        "Backend Shipment chưa triển khai trên nhánh nhan.",
    };
  }

  if (tab === "pending-return") {
    return {
      canViewList: true,
      canOpenReturnModal: true,
      canCreateReturnShipment: false,
      canOpenForwardModal: true,
      canCreateForwardShipment: false,
      canApproveRedelivery: false,
      unavailableReason:
        "API chuyển hoàn, chuyển tiếp và duyệt giao lại chưa có contract khả dụng.",
    };
  }

  return {
    canViewList: true,
    canOpenReturnModal: false,
    canCreateReturnShipment: false,
    canOpenForwardModal: true,
    canCreateForwardShipment: false,
    canApproveRedelivery: false,
    unavailableReason:
      "API chuyển tiếp chưa khả dụng trên nhánh nhan và duyệt giao lại chưa có endpoint.",
  };
}

export async function fetchShipmentExceptionsApi(
  input: ShipmentExceptionsApiQuery,
  useMock: boolean = USE_MOCK,
): Promise<ApiPaginationResponse<ShipmentExceptionListItem>> {
  if (!useMock) {
    throw createBackendUnavailableError();
  }

  if (
    !Number.isSafeInteger(input.page) ||
    input.page < 1
  ) {
    throw createInvalidQueryError("page");
  }

  if (
    !Number.isSafeInteger(input.per_page) ||
    input.per_page < 1 ||
    input.per_page > 100
  ) {
    throw createInvalidQueryError("per_page");
  }

  const fixture = mockFixtureSchema.parse(shipmentMock);
  const trackingCode = normalizeTrackingCode(input.tracking_code);
  const filteredRows = fixture.pagination_response.data
    .filter((row) => filterByTab(input.tab, row.status))
    .filter((row) => {
      if (!trackingCode) {
        return true;
      }

      return row.tracking_code
        .toLocaleLowerCase("vi-VN")
        .includes(trackingCode);
    })
    .map(mapListItem);

  const total = filteredRows.length;
  const start = (input.page - 1) * input.per_page;
  const data = filteredRows.slice(start, start + input.per_page);

  return {
    success: true,
    message: "Lấy danh sách vận đơn chờ xử lý thành công.",
    data,
    meta: {
      timestamp: createTimestamp(),
      pagination: {
        page: input.page,
        per_page: input.per_page,
        total,
        total_pages: Math.ceil(total / input.per_page),
      },
    },
  };
}

export async function getShipmentInheritedInfo(
  publicId: string,
  useMock: boolean = USE_MOCK,
): Promise<ShipmentInheritedInfo | null> {
  if (!useMock) {
    throw createBackendUnavailableError();
  }

  const fixture = mockFixtureSchema.parse(shipmentMock);
  const detail = fixture.success_response.data;

  if (detail.public_id !== publicId) {
    return null;
  }

  return {
    public_id: detail.public_id,
    tracking_code: detail.tracking_code,
    shipment_type: undefined,
    sender_name: detail.sender_name,
    sender_phone_masked: detail.sender_phone_masked,
    sender_address: detail.sender_address,
    sender_province_id: detail.sender_province_id,
    sender_district_id: detail.sender_district_id,
    sender_ward_id: detail.sender_ward_id,
    parcel_count: detail.parcel_count,
    cod_amount: detail.cod_amount,
    recipient_name: detail.recipient_name,
    recipient_phone_masked: detail.recipient_phone_masked,
    recipient_address: detail.recipient_address,
    recipient_province_id: detail.recipient_province_id,
    recipient_district_id: detail.recipient_district_id,
    recipient_ward_id: detail.recipient_ward_id,
    destination_branch_id: detail.destination_branch_id,
  };
}

export async function createReturnShipmentApi(
  _publicId: string,
): Promise<never> {
  throw createBackendUnavailableError();
}

export async function createForwardShipmentApi(
  _publicId: string,
  _request: ForwardShipmentRequest,
): Promise<never> {
  throw createBackendUnavailableError();
}

export async function approveRedeliveryApi(
  _publicId: string,
): Promise<never> {
  throw createBackendUnavailableError();
}
