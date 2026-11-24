import { pricingCatalogApi } from "../api/pricing-catalog.api";
import type {
  PricingTariff,
  ServiceType,
  Surcharge,
  ValueAddedService,
  WeightConversionRule,
} from "../types/pricing-catalog.types";
import { usePricingCatalogResource } from "./usePricingCatalogResource";

export function useServiceTypes() {
  return usePricingCatalogResource<ServiceType, Omit<ServiceType, "id">>({
    list: (params) => pricingCatalogApi.serviceTypes.list(params),
    detail: (id) => pricingCatalogApi.serviceTypes.detail(id),
    create: (payload) => pricingCatalogApi.serviceTypes.create(payload),
    update: (id, payload) => pricingCatalogApi.serviceTypes.update(id, payload),
    remove: (id) => pricingCatalogApi.serviceTypes.remove(id),
  });
}

export function useValueAddedServices() {
  return usePricingCatalogResource<ValueAddedService, Omit<ValueAddedService, "id">>({
    list: (params) => pricingCatalogApi.valueAddedServices.list(params),
    detail: (id) => pricingCatalogApi.valueAddedServices.detail(id),
    create: (payload) => pricingCatalogApi.valueAddedServices.create(payload),
    update: (id, payload) => pricingCatalogApi.valueAddedServices.update(id, payload),
    remove: (id) => pricingCatalogApi.valueAddedServices.remove(id),
  });
}

export function useSurcharges() {
  return usePricingCatalogResource<Surcharge, Omit<Surcharge, "id">>({
    list: (params) => pricingCatalogApi.surcharges.list(params),
    detail: (id) => pricingCatalogApi.surcharges.detail(id),
    create: (payload) => pricingCatalogApi.surcharges.create(payload),
    update: (id, payload) => pricingCatalogApi.surcharges.update(id, payload),
    remove: (id) => pricingCatalogApi.surcharges.remove(id),
  });
}

export function usePricingTariffs() {
  return usePricingCatalogResource<PricingTariff, Omit<PricingTariff, "id">>({
    list: (params) => pricingCatalogApi.pricingTariffs.list(params),
    detail: (id) => pricingCatalogApi.pricingTariffs.detail(id),
    create: (payload) => pricingCatalogApi.pricingTariffs.create(payload),
    update: (id, payload) => pricingCatalogApi.pricingTariffs.update(id, payload),
    remove: (id) => pricingCatalogApi.pricingTariffs.remove(id),
  });
}

export function useWeightConversionRules() {
  return usePricingCatalogResource<WeightConversionRule, Omit<WeightConversionRule, "id">>({
    list: (params) => pricingCatalogApi.weightConversionRules.list(params),
    detail: (id) => pricingCatalogApi.weightConversionRules.detail(id),
    create: (payload) => pricingCatalogApi.weightConversionRules.create(payload),
    update: (id, payload) => pricingCatalogApi.weightConversionRules.update(id, payload),
    remove: (id) => pricingCatalogApi.weightConversionRules.remove(id),
  });
}
