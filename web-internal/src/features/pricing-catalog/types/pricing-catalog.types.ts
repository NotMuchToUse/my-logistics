export interface ServiceType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: number | boolean;
}

export interface ValueAddedService {
  id: number;
  code: string;
  name: string;
  fee_type: "fixed" | "percentage";
  fee_value: number;
  min_fee: number;
  max_fee: number;
  is_active: number | boolean;
}

export interface Surcharge {
  id: number;
  code: string;
  name: string;
  fee_type: "fixed" | "percentage";
  fee_value: number;
  is_auto_applied: number | boolean;
  is_active: number | boolean;
}

export interface PricingTariff {
  id: number;
  service_type_id: number;
  zone_type: "intra_province" | "inter_region_near" | "inter_region_far";
  min_weight_gram: number;
  max_weight_gram: number;
  base_price: number;
  step_weight_gram: number;
  step_price: number;
  effective_from: string;
  effective_to: string | null;
  is_active: number | boolean;
}

export interface WeightConversionRule {
  id: number;
  service_type_id: number;
  divisor: number;
  min_chargeable_gram: number;
  effective_from: string;
  effective_to: string | null;
  is_active: number | boolean;
}

export interface MasterDataListResponse<T> {
  success: true;
  message: string;
  data: T[];
  meta: {
    pagination: {
      page: number;
      per_page: number;
      total: number;
      total_pages: number;
    };
    timestamp: string;
  };
}

export type PricingCatalogResource =
  | "service_types"
  | "value_added_services"
  | "surcharges"
  | "pricing_tariffs"
  | "weight_conversion_rules";
