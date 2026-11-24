import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import { pricingCatalogMockService } from "./pricing-catalog.mock";
import type {
  MasterDataListResponse,
  PricingTariff,
  ServiceType,
  Surcharge,
  ValueAddedService,
  WeightConversionRule,
} from "../types/pricing-catalog.types";

interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta: { timestamp: string };
}

type ListParams = {
  page: number;
  per_page: number;
  search?: string;
};

function cleanParams(params: ListParams) {
  return {
    page: params.page,
    per_page: params.per_page,
    ...(params.search ? { search: params.search } : {}),
  };
}

async function listRequest<T>(endpoint: string, params: ListParams): Promise<MasterDataListResponse<T>> {
  const response = await axiosClient.get<MasterDataListResponse<T>>(
    `/api/v1/master-data/${endpoint}`,
    { params: cleanParams(params) },
  );
  return response.data;
}

async function detailRequest<T>(endpoint: string, id: number): Promise<SuccessEnvelope<T>> {
  const response = await axiosClient.get<SuccessEnvelope<T>>(
    `/api/v1/master-data/${endpoint}/${id}`,
  );
  return response.data;
}

async function createRequest<T, P>(endpoint: string, payload: P): Promise<SuccessEnvelope<T>> {
  const response = await axiosClient.post<SuccessEnvelope<T>>(
    `/api/v1/master-data/${endpoint}`,
    payload,
  );
  return response.data;
}

async function updateRequest<T, P>(endpoint: string, id: number, payload: P): Promise<SuccessEnvelope<T>> {
  const response = await axiosClient.put<SuccessEnvelope<T>>(
    `/api/v1/master-data/${endpoint}/${id}`,
    payload,
  );
  return response.data;
}

async function deleteRequest(endpoint: string, id: number): Promise<SuccessEnvelope<null>> {
  const response = await axiosClient.delete<SuccessEnvelope<null>>(
    `/api/v1/master-data/${endpoint}/${id}`,
  );
  return response.data;
}

export const pricingCatalogApi = {
  serviceTypes: {
    list: (params: ListParams) => USE_MOCK
      ? pricingCatalogMockService.listServiceTypes(params)
      : listRequest<ServiceType>("service-types", params),
    detail: (id: number) => USE_MOCK
      ? pricingCatalogMockService.detailServiceType(id)
      : detailRequest<ServiceType>("service-types", id),
    create: (payload: Omit<ServiceType, "id">) => USE_MOCK
      ? pricingCatalogMockService.createServiceType(payload)
      : createRequest<ServiceType, Omit<ServiceType, "id">>("service-types", payload),
    update: (id: number, payload: Omit<ServiceType, "id">) => USE_MOCK
      ? pricingCatalogMockService.updateServiceType(id, payload)
      : updateRequest<ServiceType, Omit<ServiceType, "id">>("service-types", id, payload),
    remove: (id: number) => USE_MOCK
      ? pricingCatalogMockService.deleteServiceType(id)
      : deleteRequest("service-types", id),
  },
  valueAddedServices: {
    list: (params: ListParams) => USE_MOCK
      ? pricingCatalogMockService.listValueAddedServices(params)
      : listRequest<ValueAddedService>("value-added-services", params),
    detail: (id: number) => USE_MOCK
      ? pricingCatalogMockService.detailValueAddedService(id)
      : detailRequest<ValueAddedService>("value-added-services", id),
    create: (payload: Omit<ValueAddedService, "id">) => USE_MOCK
      ? pricingCatalogMockService.createValueAddedService(payload)
      : createRequest<ValueAddedService, Omit<ValueAddedService, "id">>("value-added-services", payload),
    update: (id: number, payload: Omit<ValueAddedService, "id">) => USE_MOCK
      ? pricingCatalogMockService.updateValueAddedService(id, payload)
      : updateRequest<ValueAddedService, Omit<ValueAddedService, "id">>("value-added-services", id, payload),
    remove: (id: number) => USE_MOCK
      ? pricingCatalogMockService.deleteValueAddedService(id)
      : deleteRequest("value-added-services", id),
  },
  surcharges: {
    list: (params: ListParams) => USE_MOCK
      ? pricingCatalogMockService.listSurcharges(params)
      : listRequest<Surcharge>("surcharges", params),
    detail: (id: number) => USE_MOCK
      ? pricingCatalogMockService.detailSurcharge(id)
      : detailRequest<Surcharge>("surcharges", id),
    create: (payload: Omit<Surcharge, "id">) => USE_MOCK
      ? pricingCatalogMockService.createSurcharge(payload)
      : createRequest<Surcharge, Omit<Surcharge, "id">>("surcharges", payload),
    update: (id: number, payload: Omit<Surcharge, "id">) => USE_MOCK
      ? pricingCatalogMockService.updateSurcharge(id, payload)
      : updateRequest<Surcharge, Omit<Surcharge, "id">>("surcharges", id, payload),
    remove: (id: number) => USE_MOCK
      ? pricingCatalogMockService.deleteSurcharge(id)
      : deleteRequest("surcharges", id),
  },
  pricingTariffs: {
    list: (params: ListParams) => USE_MOCK
      ? pricingCatalogMockService.listPricingTariffs(params)
      : listRequest<PricingTariff>("pricing-tariffs", params),
    detail: (id: number) => USE_MOCK
      ? pricingCatalogMockService.detailPricingTariff(id)
      : detailRequest<PricingTariff>("pricing-tariffs", id),
    create: (payload: Omit<PricingTariff, "id">) => USE_MOCK
      ? pricingCatalogMockService.createPricingTariff(payload)
      : createRequest<PricingTariff, Omit<PricingTariff, "id">>("pricing-tariffs", payload),
    update: (id: number, payload: Omit<PricingTariff, "id">) => USE_MOCK
      ? pricingCatalogMockService.updatePricingTariff(id, payload)
      : updateRequest<PricingTariff, Omit<PricingTariff, "id">>("pricing-tariffs", id, payload),
    remove: (id: number) => USE_MOCK
      ? pricingCatalogMockService.deletePricingTariff(id)
      : deleteRequest("pricing-tariffs", id),
  },
  weightConversionRules: {
    list: (params: ListParams) => USE_MOCK
      ? pricingCatalogMockService.listWeightConversionRules(params)
      : listRequest<WeightConversionRule>("weight-conversion-rules", params),
    detail: (id: number) => USE_MOCK
      ? pricingCatalogMockService.detailWeightConversionRule(id)
      : detailRequest<WeightConversionRule>("weight-conversion-rules", id),
    create: (payload: Omit<WeightConversionRule, "id">) => USE_MOCK
      ? pricingCatalogMockService.createWeightConversionRule(payload)
      : createRequest<WeightConversionRule, Omit<WeightConversionRule, "id">>("weight-conversion-rules", payload),
    update: (id: number, payload: Omit<WeightConversionRule, "id">) => USE_MOCK
      ? pricingCatalogMockService.updateWeightConversionRule(id, payload)
      : updateRequest<WeightConversionRule, Omit<WeightConversionRule, "id">>("weight-conversion-rules", id, payload),
    remove: (id: number) => USE_MOCK
      ? pricingCatalogMockService.deleteWeightConversionRule(id)
      : deleteRequest("weight-conversion-rules", id),
  },
};
