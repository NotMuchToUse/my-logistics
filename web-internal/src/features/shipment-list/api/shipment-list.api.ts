import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import shipmentListMock from "@/mocks/shipment-list.mock.json";
import { createShipmentListApi } from "./shipment-list.service";

export const shipmentListCapabilities = {
  branchFilters: USE_MOCK,
  branchScopeMockData: USE_MOCK,
  warehouseScopeMockData: false,
  forwarding: false,
  mockPermissionsConfirmed: false,
} as const;

const shipmentListApi = createShipmentListApi({
  client: axiosClient,
  useMock: USE_MOCK,
  fixture: shipmentListMock,
});

export const fetchShipmentsApi = shipmentListApi.fetchShipmentsApi;
export const updateShipmentPriorityApi =
  shipmentListApi.updateShipmentPriorityApi;
export const cancelShipmentApi = shipmentListApi.cancelShipmentApi;
