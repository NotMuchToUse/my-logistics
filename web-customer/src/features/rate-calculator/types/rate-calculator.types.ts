export type ActiveFlag = 0 | 1;

export type FeeType = "fixed" | "percentage";

export interface Province {
  id: number;
  code: string;
  name: string;
  region: string;
  is_active: ActiveFlag;
}

export interface District {
  id: number;
  province_id: number;
  code: string;
  name: string;
  is_remote_area: ActiveFlag;
  is_active: ActiveFlag;
}

export interface ServiceType {
  id: number;
  code: string;
  name: string;
  description: string;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: ActiveFlag;
}

export interface ValueAddedService {
  id: number;
  code: string;
  name: string;
  fee_type: FeeType;
  fee_value: number;
  min_fee: number;
  max_fee: number;
  is_active: ActiveFlag;
}

export interface WeightConversionRule {
  id: number;
  service_type_id: number;
  divisor: number;
  min_chargeable_gram: number;
  effective_from: string;
  effective_to: string | null;
  is_active: ActiveFlag;
}

export interface RateResultValueAddedService {
  id: number;
  code: string;
  name: string;
  fee_type: FeeType;
  fee_value: number;
}

export interface RateResultSurcharge {
  id: number;
  code: string;
  name: string;
  fee_type: FeeType;
  fee_value: number;
}

export interface RateCalculationResult {
  origin_branch_id: number;
  destination_branch_id: number;
  service_type_id: number;
  cargo_category_id: number;
  chargeable_weight_gram: number;
  declared_value: number;
  cod_amount: number;
  base_freight_amount: number;
  surcharge_amount: number;
  vas_amount: number;
  vat_amount: number;
  total_freight_amount: number;
  value_added_services: RateResultValueAddedService[];
  surcharges: RateResultSurcharge[];
}

export interface RateCalculationSuccessResponse {
  success: true;
  message: string;
  data: RateCalculationResult;
  meta: {
    timestamp: string;
  };
}

export interface RateCalculationMockData {
  success_response: RateCalculationSuccessResponse;
}

export interface RateCalculatorFormValues {
  originProvinceId: number;
  originDistrictId: number;
  destinationProvinceId: number;
  destinationDistrictId: number;
  actualWeightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  serviceTypeId: number;
  valueAddedServiceIds: number[];
}
