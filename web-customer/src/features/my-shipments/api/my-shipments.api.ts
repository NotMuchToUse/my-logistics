import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import customerShipmentsMock from "@/mocks/customerShipments.mock.json";
import type {
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "@/types/api.types";
import type {
  CustomerShipmentsData,
  PickupRequestRecord,
  ShipmentRecord,
} from "@/features/my-shipments/types/my-shipments.types";

type MockShipmentRecord = Omit<ShipmentRecord, "kind">;

const mockShipments: ShipmentRecord[] =
  customerShipmentsMock.pagination_response.data.map(
    (shipment) => ({ ...shipment, kind: "shipment" }) as ShipmentRecord,
  );
let mockPickupRequests: PickupRequestRecord[] =
  customerShipmentsMock.pickup_requests_response.data.map((request) => ({
    ...request,
    status: request.status as PickupRequestRecord["status"],
    kind: "pickup_request",
  }));

function getMockData(): CustomerShipmentsData {
  return {
    shipments: mockShipments.map((shipment) => ({
      ...shipment,
      shipment_parcels: shipment.shipment_parcels.map((parcel) => ({
        ...parcel,
      })),
      shipment_status_history: shipment.shipment_status_history.map((item) => ({
        ...item,
      })),
    })),
    pickupRequests: mockPickupRequests.map((request) => ({ ...request })),
  };
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  return error instanceof Error ? error.message : "";
}

export async function fetchCustomerShipmentsApi(): Promise<CustomerShipmentsData> {
  if (USE_MOCK) {
    return getMockData();
  }

  try {
    const [shipmentsResponse, pickupRequestsResponse] = await Promise.all([
      axiosClient.get<ApiPaginationResponse<MockShipmentRecord>>(
        "/api/v1/customer/shipments",
      ),
      axiosClient.get<ApiPaginationResponse<PickupRequestRecord>>(
        "/api/v1/customer/pickup-requests",
      ),
    ]);

    return {
      shipments: shipmentsResponse.data.data.map((shipment) => ({
        ...shipment,
        kind: "shipment",
      })),
      pickupRequests: pickupRequestsResponse.data.data.map((request) => ({
        ...request,
        kind: "pickup_request",
      })),
    };
  } catch (error: unknown) {
    const mockData = getMockData();

    if (mockData.shipments.length || mockData.pickupRequests.length) {
      return mockData;
    }

    throw error;
  }
}

export async function cancelPickupRequestApi(
  publicId: string,
  reason: string,
): Promise<PickupRequestRecord> {
  const mockRequest = mockPickupRequests.find(
    (request) => request.public_id === publicId,
  );

  if (USE_MOCK) {
    if (!mockRequest) {
      throw new Error("Không tìm thấy yêu cầu lấy hàng trong dữ liệu mẫu.");
    }

    return updateMockPickupRequest(mockRequest);
  }

  try {
    const response = await axiosClient.patch<
      ApiSuccessResponse<PickupRequestRecord>
    >(
      `/api/v1/customer/pickup-requests/${encodeURIComponent(publicId)}/cancel`,
      { reason },
    );

    return { ...response.data.data, kind: "pickup_request" };
  } catch (error: unknown) {
    if (!mockRequest || !getErrorMessage(error)) {
      throw error;
    }

    return updateMockPickupRequest(mockRequest);
  }
}

function updateMockPickupRequest(
  request: PickupRequestRecord,
): PickupRequestRecord {
  const cancelledRequest: PickupRequestRecord = {
    ...request,
    status: "cancelled",
    version: (request.version ?? 0) + 1,
  };
  mockPickupRequests = mockPickupRequests.map((item) =>
    item.public_id === request.public_id ? cancelledRequest : item,
  );

  const linkedShipment = mockShipments.find(
    (shipment) => shipment.tracking_code === request.tracking_code,
  );

  if (linkedShipment && linkedShipment.status === "pending_pickup") {
    linkedShipment.status = "cancelled";
    linkedShipment.shipment_status_history = [
      ...linkedShipment.shipment_status_history,
      {
        from_status: "pending_pickup",
        to_status: "cancelled",
        description: "Yêu cầu lấy hàng đã được khách hàng hủy.",
        is_public_visible: 1,
        occurred_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      },
    ];
  }

  return cancelledRequest;
}
