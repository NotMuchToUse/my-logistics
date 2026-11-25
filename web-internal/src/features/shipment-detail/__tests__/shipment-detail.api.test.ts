import { AxiosHeaders } from "axios";
import type { ApiSuccessResponse } from "@/types/api.types";
import axiosClient from "@/core/api/axiosClient";
import { getShipmentDetail } from "../api/shipment-detail.api";
import type { ShipmentDetail } from "../types/shipment-detail.types";
import { shipmentFixture } from "./shipment-detail.fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/axiosClient", () => ({
  default: { get: vi.fn() },
  USE_MOCK: false,
}));

const mockedGet = vi.mocked(axiosClient.get);

describe("getShipmentDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a shipment by its encoded public ID and returns response data", async () => {
    const responseBody: ApiSuccessResponse<ShipmentDetail> = {
      success: true,
      message: "OK",
      data: shipmentFixture,
      meta: { timestamp: "2026-11-24T10:00:00Z" },
    };
    mockedGet.mockResolvedValue({
      data: responseBody,
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    });

    const result = await getShipmentDetail("SHIP/TEST-001");

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/shipments/SHIP%2FTEST-001");
    expect(result).toBe(shipmentFixture);
  });
});
