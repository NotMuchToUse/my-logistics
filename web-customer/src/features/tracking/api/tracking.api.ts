import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import trackingMock from "@/mocks/tracking.mock.json";
import type { ApiSuccessResponse } from "@/types/api.types";
import { MOCK_TRACKING_CODE } from "@/features/tracking/constants/tracking.constants";
import type { PublicTrackingShipment } from "@/features/tracking/types/tracking.types";

const mockShipment: PublicTrackingShipment =
  trackingMock.success_response.data;

function getMockShipment(trackingCode: string): PublicTrackingShipment | null {
  return trackingCode.toUpperCase() === MOCK_TRACKING_CODE
    ? mockShipment
    : null;
}

export async function fetchPublicTrackingApi(
  trackingCode: string,
): Promise<PublicTrackingShipment> {
  const normalizedCode = trackingCode.trim().toUpperCase();

  if (USE_MOCK) {
    const shipment = getMockShipment(normalizedCode);

    if (!shipment) {
      throw new Error(trackingMock.error_response.error.message);
    }

    return shipment;
  }

  try {
    const response = await axiosClient.get<
      ApiSuccessResponse<PublicTrackingShipment>
    >(`/api/v1/public/tracking/${encodeURIComponent(normalizedCode)}`);

    return response.data.data;
  } catch (error: unknown) {
    const shipment = getMockShipment(normalizedCode);

    if (shipment) {
      return shipment;
    }

    throw error;
  }
}
