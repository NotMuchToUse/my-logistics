import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import mockFixture from "@/mocks/warehouseOutboundDelivery.mock.json";
import type { ApiErrorResponse, ApiSuccessResponse } from "@/types/api.types";
import {
  ELIGIBLE_DELIVERY_SHIPMENT_STATUSES,
  OUTBOUND_DELIVERY_ENDPOINT,
} from "../constants/warehouse-outbound-delivery.constants";
import {
  confirmOutboundDeliverySchema,
  createOutboundDeliverySchema,
  removeOutboundItemSchema,
  scanOutboundShipmentSchema,
} from "../schemas/warehouse-outbound-delivery.schema";
import type {
  ConfirmOutboundDeliveryPayload,
  CreateOutboundDeliveryPayload,
  OutboundDeliveryBootstrapData,
  OutboundDeliveryReceipt,
  OutboundDeliveryReceiptItem,
  RemoveOutboundDeliveryItemPayload,
  ScanOutboundDeliveryPayload,
} from "../types/warehouse-outbound-delivery.types";

let mockState: OutboundDeliveryBootstrapData = structuredClone(
  mockFixture.success_response.data as OutboundDeliveryBootstrapData,
);
let nextMockItemId = 1100;

function nowIsoLocal(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function buildApiError(
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

function wrapSuccess<T>(data: T, message: string): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data: structuredClone(data),
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

function recalculateReceiptTotals(
  receipt: OutboundDeliveryReceipt,
): OutboundDeliveryReceipt {
  const activeItems = receipt.items.filter((item) => item.removed_at === null);
  return {
    ...receipt,
    total_shipments: activeItems.length,
    total_weight_gram: activeItems.reduce(
      (sum, item) => sum + item.chargeable_weight_gram,
      0,
    ),
    total_cod_amount: activeItems.reduce(
      (sum, item) => sum + item.cod_amount,
      0,
    ),
  };
}

async function simulateDelay(ms = 180): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lấy thông tin kho, danh sách tài xế bưu cục, vận đơn sẵn sàng giao và phiếu nháp hiện tại.
 */
export async function fetchOutboundDeliveryBootstrapApi(
  warehouseId?: number | null,
): Promise<ApiSuccessResponse<OutboundDeliveryBootstrapData>> {
  if (USE_MOCK) {
    await simulateDelay();
    return wrapSuccess(
      mockState,
      "Lấy dữ liệu điều phối xuất kho giao hàng thành công.",
    );
  }

  const response = await axiosClient.get<
    ApiSuccessResponse<OutboundDeliveryBootstrapData>
  >(OUTBOUND_DELIVERY_ENDPOINT, {
    params: warehouseId ? { warehouse_id: warehouseId } : undefined,
  });
  return response.data;
}

/**
 * Tạo phiếu xuất kho giao hàng nháp (draft) gắn với tài xế bưu cục.
 */
export async function createOutboundDeliveryReceiptApi(
  payload: CreateOutboundDeliveryPayload,
): Promise<ApiSuccessResponse<OutboundDeliveryReceipt>> {
  const parsed = createOutboundDeliverySchema.safeParse(payload);
  if (!parsed.success) {
    throw buildApiError(
      "422_VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dữ liệu tạo phiếu không hợp lệ.",
    );
  }

  if (USE_MOCK) {
    await simulateDelay();
    const driver = mockState.drivers.find(
      (item) => item.id === parsed.data.driver_id && item.is_active,
    );
    if (!driver) {
      throw buildApiError(
        "404_NOT_FOUND",
        "Không tìm thấy tài xế giao hàng hoạt động thuộc bưu cục.",
      );
    }

    const timestamp = nowIsoLocal();
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const items: OutboundDeliveryReceiptItem[] = [];

    for (const rawCode of payload.tracking_codes ?? []) {
      const code = rawCode.trim().toUpperCase();
      const shipment = mockState.available_shipments.find(
        (entry) => entry.tracking_code === code,
      );
      if (shipment) {
        items.push({
          id: nextMockItemId++,
          shipment_id: shipment.shipment_id,
          shipment_public_id: shipment.shipment_public_id,
          tracking_code: shipment.tracking_code,
          shipment_status: shipment.status,
          recipient_name: shipment.recipient_name,
          recipient_phone_masked: shipment.recipient_phone_masked,
          recipient_address: shipment.recipient_address,
          chargeable_weight_gram: shipment.chargeable_weight_gram,
          parcel_count: shipment.parcel_count,
          cod_amount: shipment.cod_amount,
          scanned_at: timestamp,
          scanned_by_name: "Nguyễn Minh An",
          removed_at: null,
          remove_reason: null,
          removed_by_name: null,
        });
      }
    }

    const draft = recalculateReceiptTotals({
      public_id: `01JDC9OUT${Date.now()}`.slice(0, 26),
      receipt_code: `WHOUT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${suffix}`,
      receipt_type: "outbound_delivery",
      warehouse_id: mockState.warehouse.id,
      warehouse_code: mockState.warehouse.code,
      warehouse_name: mockState.warehouse.name,
      branch_id: mockState.warehouse.branch_id,
      branch_name: mockState.warehouse.branch_name,
      driver_id: driver.id,
      driver_code: driver.employee_code,
      driver_name: driver.full_name,
      driver_phone_masked: driver.phone_masked,
      total_shipments: 0,
      total_weight_gram: 0,
      total_cod_amount: 0,
      status: "draft",
      note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
      confirmed_at: null,
      confirmed_by_name: null,
      created_by_name: "Nguyễn Minh An",
      version: 1,
      created_at: timestamp,
      updated_at: timestamp,
      items,
    });

    mockState.active_draft = draft;
    return wrapSuccess(draft, "Tạo phiếu xuất kho giao hàng thành công.");
  }

  const response = await axiosClient.post<
    ApiSuccessResponse<OutboundDeliveryReceipt>
  >(OUTBOUND_DELIVERY_ENDPOINT, {
    ...parsed.data,
    ...(payload.tracking_codes ? { tracking_codes: payload.tracking_codes } : {}),
  });
  return response.data;
}

/**
 * Quét barcode mã vận đơn vào phiếu xuất kho giao hàng đang ở trạng thái nháp.
 */
export async function scanOutboundDeliveryShipmentApi(
  receiptPublicId: string,
  payload: ScanOutboundDeliveryPayload,
): Promise<ApiSuccessResponse<OutboundDeliveryReceipt>> {
  const parsed = scanOutboundShipmentSchema.safeParse(payload);
  if (!parsed.success) {
    throw buildApiError(
      "422_VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Mã vận đơn không hợp lệ.",
    );
  }

  const normalizedCode = parsed.data.tracking_code.toUpperCase();

  if (USE_MOCK) {
    await simulateDelay(140);
    const draft = mockState.active_draft;
    if (!draft || draft.public_id !== receiptPublicId) {
      throw buildApiError("404_NOT_FOUND", "Không tìm thấy phiếu xuất kho nháp.");
    }
    if (draft.status !== "draft") {
      throw buildApiError(
        "422_VALIDATION_ERROR",
        "Phiếu xuất kho đã chốt, không thể quét thêm vận đơn.",
      );
    }

    const alreadyActive = draft.items.some(
      (item) =>
        item.tracking_code === normalizedCode && item.removed_at === null,
    );
    if (alreadyActive) {
      throw buildApiError(
        "422_VALIDATION_ERROR",
        `Vận đơn ${normalizedCode} đã có trong danh sách giao hàng của phiếu này.`,
      );
    }

    const shipment = mockState.available_shipments.find(
      (entry) => entry.tracking_code === normalizedCode,
    );
    if (!shipment) {
      throw buildApiError(
        "404_NOT_FOUND",
        `Không tìm thấy vận đơn ${normalizedCode} trong tồn kho bưu cục.`,
      );
    }
    if (!ELIGIBLE_DELIVERY_SHIPMENT_STATUSES.includes(shipment.status)) {
      throw buildApiError(
        "422_VALIDATION_ERROR",
        `Vận đơn ${normalizedCode} đang ở trạng thái '${shipment.status}', không thể xuất giao hàng.`,
      );
    }

    const timestamp = nowIsoLocal();
    const updatedDraft = recalculateReceiptTotals({
      ...draft,
      version: draft.version + 1,
      updated_at: timestamp,
      items: [
        ...draft.items,
        {
          id: nextMockItemId++,
          shipment_id: shipment.shipment_id,
          shipment_public_id: shipment.shipment_public_id,
          tracking_code: shipment.tracking_code,
          shipment_status: shipment.status,
          recipient_name: shipment.recipient_name,
          recipient_phone_masked: shipment.recipient_phone_masked,
          recipient_address: shipment.recipient_address,
          chargeable_weight_gram: shipment.chargeable_weight_gram,
          parcel_count: shipment.parcel_count,
          cod_amount: shipment.cod_amount,
          scanned_at: timestamp,
          scanned_by_name: "Nguyễn Minh An",
          removed_at: null,
          remove_reason: null,
          removed_by_name: null,
        },
      ],
    });

    mockState.active_draft = updatedDraft;
    return wrapSuccess(
      updatedDraft,
      `Đã thêm vận đơn ${normalizedCode} vào phiếu xuất giao.`,
    );
  }

  const response = await axiosClient.post<
    ApiSuccessResponse<OutboundDeliveryReceipt>
  >(`${OUTBOUND_DELIVERY_ENDPOINT}/${receiptPublicId}/scan`, {
    tracking_code: normalizedCode,
  });
  return response.data;
}

/**
 * Gỡ vận đơn quét nhầm khỏi phiếu xuất kho nháp kèm lý do remove_reason.
 */
export async function removeOutboundDeliveryItemApi(
  receiptPublicId: string,
  payload: RemoveOutboundDeliveryItemPayload,
): Promise<ApiSuccessResponse<OutboundDeliveryReceipt>> {
  const parsed = removeOutboundItemSchema.safeParse({
    remove_reason: payload.remove_reason,
  });
  if (!parsed.success) {
    throw buildApiError(
      "422_VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Lý do gỡ đơn không hợp lệ.",
      {
        remove_reason: [
          parsed.error.issues[0]?.message ?? "Lý do gỡ đơn không hợp lệ.",
        ],
      },
    );
  }

  if (USE_MOCK) {
    await simulateDelay(150);
    const draft = mockState.active_draft;
    if (!draft || draft.public_id !== receiptPublicId) {
      throw buildApiError("404_NOT_FOUND", "Không tìm thấy phiếu xuất kho nháp.");
    }
    if (draft.status !== "draft") {
      throw buildApiError(
        "422_VALIDATION_ERROR",
        "Chỉ được phép gỡ vận đơn khi phiếu đang ở trạng thái nháp (draft).",
      );
    }
    if (draft.version !== payload.version) {
      throw buildApiError(
        "409_VERSION_CONFLICT",
        "Phiếu xuất kho vừa được cập nhật, vui lòng tải lại.",
      );
    }

    const targetItem = draft.items.find(
      (item) => item.id === payload.item_id && item.removed_at === null,
    );
    if (!targetItem) {
      throw buildApiError(
        "404_NOT_FOUND",
        "Không tìm thấy dòng vận đơn cần gỡ trong phiếu.",
      );
    }

    const timestamp = nowIsoLocal();
    const updatedDraft = recalculateReceiptTotals({
      ...draft,
      version: draft.version + 1,
      updated_at: timestamp,
      items: draft.items.map((item) =>
        item.id === payload.item_id
          ? {
              ...item,
              removed_at: timestamp,
              remove_reason: parsed.data.remove_reason,
              removed_by_name: "Nguyễn Minh An",
            }
          : item,
      ),
    });

    mockState.active_draft = updatedDraft;
    return wrapSuccess(
      updatedDraft,
      `Đã gỡ vận đơn ${targetItem.tracking_code} khỏi phiếu xuất giao.`,
    );
  }

  const response = await axiosClient.post<
    ApiSuccessResponse<OutboundDeliveryReceipt>
  >(`${OUTBOUND_DELIVERY_ENDPOINT}/${receiptPublicId}/remove-item`, {
    item_id: payload.item_id,
    remove_reason: parsed.data.remove_reason,
    version: payload.version,
  });
  return response.data;
}

/**
 * Chốt phiếu xuất kho giao hàng (confirmed) để chuyển trạng thái vận đơn sang out_for_delivery và đẩy sang App Tài xế.
 */
export async function confirmOutboundDeliveryReceiptApi(
  receiptPublicId: string,
  payload: ConfirmOutboundDeliveryPayload,
): Promise<ApiSuccessResponse<OutboundDeliveryReceipt>> {
  const parsed = confirmOutboundDeliverySchema.safeParse(payload);
  if (!parsed.success) {
    throw buildApiError(
      "422_VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dữ liệu chốt phiếu không hợp lệ.",
    );
  }

  if (USE_MOCK) {
    await simulateDelay(220);
    const draft = mockState.active_draft;
    if (!draft || draft.public_id !== receiptPublicId) {
      throw buildApiError("404_NOT_FOUND", "Không tìm thấy phiếu xuất kho nháp.");
    }
    if (draft.status !== "draft") {
      throw buildApiError(
        "422_VALIDATION_ERROR",
        "Phiếu xuất kho này đã được chốt trước đó.",
      );
    }
    if (draft.version !== payload.version) {
      throw buildApiError(
        "409_VERSION_CONFLICT",
        "Phiếu xuất kho vừa được người khác cập nhật, vui lòng tải lại.",
      );
    }

    const activeItems = draft.items.filter((item) => item.removed_at === null);
    if (activeItems.length === 0) {
      throw buildApiError(
        "422_VALIDATION_ERROR",
        "Phiếu xuất kho phải có ít nhất 1 vận đơn hợp lệ trước khi chốt.",
      );
    }

    const timestamp = nowIsoLocal();
    const confirmedReceipt: OutboundDeliveryReceipt = recalculateReceiptTotals({
      ...draft,
      status: "confirmed",
      note: parsed.data.note?.trim() ? parsed.data.note.trim() : draft.note,
      confirmed_at: timestamp,
      confirmed_by_name: "Nguyễn Minh An",
      updated_at: timestamp,
      version: draft.version + 1,
      items: draft.items.map((item) =>
        item.removed_at === null
          ? { ...item, shipment_status: "out_for_delivery" }
          : item,
      ),
    });

    const confirmedShipmentIds = new Set(
      activeItems.map((item) => item.shipment_id),
    );
    mockState.available_shipments = mockState.available_shipments.filter(
      (shipment) => !confirmedShipmentIds.has(shipment.shipment_id),
    );
    mockState.drivers = mockState.drivers.map((driver) =>
      driver.id === confirmedReceipt.driver_id
        ? {
            ...driver,
            active_delivery_count:
              driver.active_delivery_count + activeItems.length,
          }
        : driver,
    );
    mockState.recent_confirmed = [
      confirmedReceipt,
      ...mockState.recent_confirmed,
    ];
    mockState.active_draft = null;

    return wrapSuccess(
      confirmedReceipt,
      `Đã chốt phiếu ${confirmedReceipt.receipt_code} và đẩy ${activeItems.length} đơn sang App Tài xế.`,
    );
  }

  const response = await axiosClient.post<
    ApiSuccessResponse<OutboundDeliveryReceipt>
  >(`${OUTBOUND_DELIVERY_ENDPOINT}/${receiptPublicId}/confirm`, {
    ...(parsed.data.note ? { note: parsed.data.note } : {}),
    version: payload.version,
  });
  return response.data;
}
