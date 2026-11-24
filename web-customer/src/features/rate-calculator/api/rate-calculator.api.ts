import { USE_MOCK } from "@/core/api/axiosClient";
import branchesMock from "@/mocks/branches.mock.json";
import rateCalculatorMock from "@/mocks/rateCalculator.mock.json";
import masterDataMock from "../../../../../web-internal/src/mocks/masterData.mock.json";
import type {
  ActiveFlag,
  District,
  FeeType,
  Province,
  RateCalculationSuccessResponse,
  RateCalculatorFormValues,
  RateResultSurcharge,
  RateResultValueAddedService,
  ServiceType,
  ValueAddedService,
  WeightConversionRule,
} from "../types/rate-calculator.types";

export interface MockRateCalculationOutcome {
  source: "mock";
  notice: string;
  response: RateCalculationSuccessResponse;
}

function assertMockEnabled(): void {
  if (!USE_MOCK) {
    throw new Error(
      "Rate calculator chưa kết nối Backend; hãy bật chế độ mock để dùng dữ liệu minh họa.",
    );
  }
}

function toActiveFlag(value: number, fieldName: string): ActiveFlag {
  if (value === 0 || value === 1) {
    return value;
  }

  throw new Error(`Giá trị ${fieldName} không hợp lệ trong dữ liệu mock.`);
}

function toFeeType(value: string): FeeType {
  if (value === "fixed" || value === "percentage") {
    return value;
  }

  throw new Error("Loại phí không hợp lệ trong dữ liệu mock tính cước.");
}

export async function getRateCalculatorProvinces(): Promise<Province[]> {
  assertMockEnabled();

  return branchesMock.success_response.data.provinces
    .filter((province) => province.is_active === 1)
    .map((province) => ({
      id: province.id,
      code: province.code,
      name: province.name,
      region: province.region,
      is_active: toActiveFlag(province.is_active, "is_active"),
    }));
}

export async function getRateCalculatorDistricts(
  provinceId: number,
): Promise<District[]> {
  assertMockEnabled();

  return branchesMock.success_response.data.districts
    .filter(
      (district) =>
        district.province_id === provinceId && district.is_active === 1,
    )
    .map((district) => ({
      id: district.id,
      province_id: district.province_id,
      code: district.code,
      name: district.name,
      is_remote_area: toActiveFlag(
        district.is_remote_area,
        "is_remote_area",
      ),
      is_active: toActiveFlag(district.is_active, "is_active"),
    }));
}

export async function getRateCalculatorServiceTypes(): Promise<ServiceType[]> {
  assertMockEnabled();

  return masterDataMock.success_response.data.service_types
    .filter((service) => service.is_active === 1)
    .map((service) => ({
      id: service.id,
      code: service.code,
      name: service.name,
      description: service.description,
      estimated_days_min: service.estimated_days_min,
      estimated_days_max: service.estimated_days_max,
      is_active: toActiveFlag(service.is_active, "is_active"),
    }));
}

export async function getRateCalculatorValueAddedServices(): Promise<
  ValueAddedService[]
> {
  assertMockEnabled();

  return masterDataMock.success_response.data.value_added_services
    .filter((service) => service.is_active === 1)
    .map((service) => ({
      id: service.id,
      code: service.code,
      name: service.name,
      fee_type: toFeeType(service.fee_type),
      fee_value: service.fee_value,
      min_fee: service.min_fee,
      max_fee: service.max_fee,
      is_active: toActiveFlag(service.is_active, "is_active"),
    }));
}

export async function getRateCalculatorWeightConversionRules(
  serviceTypeId?: number,
): Promise<WeightConversionRule[]> {
  assertMockEnabled();

  return masterDataMock.success_response.data.weight_conversion_rules
    .filter(
      (rule) =>
        rule.is_active === 1 &&
        (serviceTypeId === undefined || rule.service_type_id === serviceTypeId),
    )
    .map((rule) => ({
      id: rule.id,
      service_type_id: rule.service_type_id,
      divisor: rule.divisor,
      min_chargeable_gram: rule.min_chargeable_gram,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to,
      is_active: toActiveFlag(rule.is_active, "is_active"),
    }));
}

function getMockRateCalculation(): MockRateCalculationOutcome {
  const mockResponse = rateCalculatorMock.success_response;
  const mockResult = mockResponse.data;

  if (mockResponse.success !== true) {
    throw new Error("Fixture tính cước không chứa kết quả thành công hợp lệ.");
  }

  return {
    source: "mock",
    notice:
      "Đây là dữ liệu minh họa cố định, không được tính từ thông số bạn vừa nhập và chưa phải báo giá thực tế từ Backend.",
    response: {
      success: true,
      message: mockResponse.message,
      data: {
        ...mockResult,
        value_added_services: mockResult.value_added_services.map(
          (service): RateResultValueAddedService => ({
            id: service.id,
            code: service.code,
            name: service.name,
            fee_type: toFeeType(service.fee_type),
            fee_value: service.fee_value,
          }),
        ),
        surcharges: mockResult.surcharges.map(
          (surcharge): RateResultSurcharge => ({
            id: surcharge.id,
            code: surcharge.code,
            name: surcharge.name,
            fee_type: toFeeType(surcharge.fee_type),
            fee_value: surcharge.fee_value,
          }),
        ),
      },
      meta: {
        timestamp: mockResponse.meta.timestamp,
      },
    },
  };
}

export async function calculateRate(
  _formValues: RateCalculatorFormValues,
): Promise<MockRateCalculationOutcome> {
  assertMockEnabled();
  return getMockRateCalculation();
}
