import { getBranches, getWarehouses } from "@/features/network-org/api/network-org.api";
import { pricingCatalogApi } from "@/features/pricing-catalog/api/pricing-catalog.api";
import { USE_MOCK } from "@/core/api/axiosClient";
import mockFixture from "@/mocks/ops-config.mock.json";
import {
  createOpsConfigMockService,
  parseOpsConfigMockSeed,
  type OpsConfigMockService,
} from "./ops-config.mock";
import { requireOpsConfigMock } from "./ops-config-api-mode";
export { OpsConfigApiBlockedError } from "./ops-config-api-mode";
import type {
  OpsConfigListParams,
  OpsConfigLookups,
} from "../types/ops-config.types";

let mockService: OpsConfigMockService;

async function getMockLookups(): Promise<OpsConfigLookups> {
  const [serviceResponse, branches, warehouses] = await Promise.all([
    pricingCatalogApi.serviceTypes.list({ page: 1, per_page: 100 }),
    getBranches(),
    getWarehouses(),
  ]);
  return {
    service_types: serviceResponse.data.map((service) => ({
      id: service.id,
      code: service.code,
      name: service.name,
      is_active: service.is_active,
    })),
    branches: branches.map(({ id, code, name, is_active }) => ({
      id,
      code,
      name,
      is_active,
    })),
    warehouses: warehouses.map(({ id, branch_id, code, name, is_active }) => ({
      id,
      branch_id,
      code,
      name,
      is_active,
    })),
    partners: mockService.getPartnerLookups(),
    drivers: mockService.getDriverLookups(),
  };
}

const mockSeed = parseOpsConfigMockSeed(mockFixture.data);
mockService = createOpsConfigMockService(mockSeed, getMockLookups);

function requireMock(): void {
  requireOpsConfigMock(USE_MOCK);
}

export async function getOpsConfigLookups(): Promise<OpsConfigLookups> {
  requireMock();
  return getMockLookups();
}

function listParams(params?: Partial<OpsConfigListParams>) {
  return {
    page: params?.page ?? 1,
    per_page: params?.per_page ?? 20,
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.filters ? { filters: params.filters } : {}),
    ...(params?.signal ? { signal: params.signal } : {}),
  };
}

export const opsConfigApi = {
  slaDeadlines: {
    list: (params?: Partial<OpsConfigListParams>) => {
      requireMock();
      return mockService.listSlaDeadlines(listParams(params));
    },
    create: (payload: unknown) => {
      requireMock();
      return mockService.createSlaDeadline(payload);
    },
    update: (id: string | number, payload: unknown) => {
      requireMock();
      return mockService.updateSlaDeadline(id, payload);
    },
  },
  routingRules: {
    list: (params?: Partial<OpsConfigListParams>) => {
      requireMock();
      return mockService.listRoutingRules(listParams(params));
    },
    create: (payload: unknown) => {
      requireMock();
      return mockService.createRoutingRule(payload);
    },
    update: (id: string | number, payload: unknown) => {
      requireMock();
      return mockService.updateRoutingRule(id, payload);
    },
  },
  partners: {
    list: (params?: Partial<OpsConfigListParams>) => {
      requireMock();
      return mockService.listPartners(listParams(params));
    },
    create: (payload: unknown) => {
      requireMock();
      return mockService.createPartner(payload);
    },
    update: (id: string | number, payload: unknown) => {
      requireMock();
      return mockService.updatePartner(id, payload);
    },
  },
  vehicles: {
    list: (params?: Partial<OpsConfigListParams>) => {
      requireMock();
      return mockService.listVehicles(listParams(params));
    },
    create: (payload: unknown) => {
      requireMock();
      return mockService.createVehicle(payload);
    },
    update: (id: string | number, payload: unknown) => {
      requireMock();
      return mockService.updateVehicle(id, payload);
    },
  },
};
