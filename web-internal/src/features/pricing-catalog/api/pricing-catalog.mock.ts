import type {
  MasterDataListResponse,
  PricingTariff,
  ServiceType,
  Surcharge,
  ValueAddedService,
  WeightConversionRule,
} from "../types/pricing-catalog.types";

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: { timestamp: string };
}

interface ApiError {
  success: false;
  error: {
    code: "400_BAD_REQUEST" | "401_UNAUTHORIZED" | "403_FORBIDDEN" | "404_NOT_FOUND" | "422_VALIDATION_ERROR" | "500_INTERNAL_ERROR";
    message: string;
    details?: Record<string, string[]>;
  };
}

const serviceTypes: ServiceType[] = [
  {
    id: 1,
    code: "EXPRESS",
    name: "Hỏa tốc",
    description: "Dịch vụ chuyển phát ưu tiên nhanh.",
    estimated_days_min: 1,
    estimated_days_max: 1,
    is_active: 1,
  },
];
const valueAddedServices: ValueAddedService[] = [
  {
    id: 1,
    code: "DECLARED_VALUE_INSURANCE",
    name: "Bảo hiểm khai giá",
    fee_type: "percentage",
    fee_value: 0.5,
    min_fee: 5000,
    max_fee: 500000,
    is_active: 1,
  },
];
const surcharges: Surcharge[] = [
  {
    id: 1,
    code: "REMOTE_AREA",
    name: "Phụ phí vùng sâu",
    fee_type: "fixed",
    fee_value: 15000,
    is_auto_applied: 1,
    is_active: 1,
  },
];
const pricingTariffs: PricingTariff[] = [
  {
    id: 1,
    service_type_id: 1,
    zone_type: "intra_province",
    min_weight_gram: 0,
    max_weight_gram: 1000,
    base_price: 35000,
    step_weight_gram: 500,
    step_price: 5000,
    effective_from: "2026-01-01",
    effective_to: null,
    is_active: 1,
  },
];
const weightConversionRules: WeightConversionRule[] = [
  {
    id: 1,
    service_type_id: 1,
    divisor: 5000,
    min_chargeable_gram: 1000,
    effective_from: "2026-01-01",
    effective_to: null,
    is_active: 1,
  },
];

let nextIds = {
  service_types: 2,
  value_added_services: 2,
  surcharges: 2,
  pricing_tariffs: 2,
  weight_conversion_rules: 2,
};

function paginated<T>(data: T[], page: number, perPage: number, message: string): MasterDataListResponse<T> {
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const total = data.length;
  const offset = (safePage - 1) * safePerPage;
  return {
    success: true,
    message,
    data: data.slice(offset, offset + safePerPage),
    meta: {
      pagination: {
        page: safePage,
        per_page: safePerPage,
        total,
        total_pages: Math.ceil(total / safePerPage),
      },
      timestamp: new Date().toISOString(),
    },
  };
}

function success<T>(data: T, message: string): SuccessResponse<T> {
  return { success: true, message, data, meta: { timestamp: new Date().toISOString() } };
}

function notFound(message: string): never {
  const error: ApiError = {
    success: false,
    error: { code: "404_NOT_FOUND", message },
  };
  throw error;
}

function duplicate(field: string): never {
  const error: ApiError = {
    success: false,
    error: {
      code: "422_VALIDATION_ERROR",
      message: "Dữ liệu danh mục không hợp lệ",
      details: { [field]: ["Mã danh mục đã được sử dụng."] },
    },
  };
  throw error;
}

export const pricingCatalogMockService = {
  async listServiceTypes(params: { page: number; per_page: number; search?: string }) {
    const search = params.search?.trim().toLowerCase();
    const rows = serviceTypes.filter((row) => row.is_active === 1 || row.is_active === true);
    const filtered = search
      ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(search))
      : rows;
    return paginated(filtered, params.page, params.per_page, "Lấy danh sách dịch vụ thành công.");
  },
  async detailServiceType(id: number) {
    const row = serviceTypes.find((item) => item.id === id && (item.is_active === 1 || item.is_active === true));
    if (!row) return notFound("Không tìm thấy loại dịch vụ.");
    return success({ ...row }, "Lấy thông tin dịch vụ thành công.");
  },
  async createServiceType(payload: Omit<ServiceType, "id">) {
    if (serviceTypes.some((row) => row.code === payload.code)) return duplicate("code");
    const row: ServiceType = { ...payload, id: nextIds.service_types++ };
    serviceTypes.push(row);
    return success({ ...row }, "Tạo dịch vụ thành công.");
  },
  async updateServiceType(id: number, payload: Omit<ServiceType, "id">) {
    const index = serviceTypes.findIndex((row) => row.id === id);
    if (index < 0) return notFound("Không tìm thấy loại dịch vụ.");
    if (serviceTypes.some((row) => row.id !== id && row.code === payload.code)) return duplicate("code");
    serviceTypes[index] = { ...payload, id };
    return success({ ...serviceTypes[index] }, "Cập nhật dịch vụ thành công.");
  },
  async deleteServiceType(id: number) {
    const row = serviceTypes.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy loại dịch vụ.");
    row.is_active = 0;
    return success(null, "Ngừng hoạt động dịch vụ thành công.");
  },

  async listValueAddedServices(params: { page: number; per_page: number; search?: string }) {
    const search = params.search?.trim().toLowerCase();
    const rows = valueAddedServices.filter((row) => row.is_active === 1 || row.is_active === true);
    const filtered = search
      ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(search))
      : rows;
    return paginated(filtered, params.page, params.per_page, "Lấy danh sách dịch vụ gia tăng thành công.");
  },
  async detailValueAddedService(id: number) {
    const row = valueAddedServices.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy dịch vụ gia tăng.");
    return success({ ...row }, "Lấy thông tin dịch vụ gia tăng thành công.");
  },
  async createValueAddedService(payload: Omit<ValueAddedService, "id">) {
    if (valueAddedServices.some((row) => row.code === payload.code)) return duplicate("code");
    const row: ValueAddedService = { ...payload, id: nextIds.value_added_services++ };
    valueAddedServices.push(row);
    return success({ ...row }, "Tạo dịch vụ gia tăng thành công.");
  },
  async updateValueAddedService(id: number, payload: Omit<ValueAddedService, "id">) {
    const index = valueAddedServices.findIndex((row) => row.id === id);
    if (index < 0) return notFound("Không tìm thấy dịch vụ gia tăng.");
    if (valueAddedServices.some((row) => row.id !== id && row.code === payload.code)) return duplicate("code");
    valueAddedServices[index] = { ...payload, id };
    return success({ ...valueAddedServices[index] }, "Cập nhật dịch vụ gia tăng thành công.");
  },
  async deleteValueAddedService(id: number) {
    const row = valueAddedServices.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy dịch vụ gia tăng.");
    row.is_active = 0;
    return success(null, "Ngừng hoạt động dịch vụ gia tăng thành công.");
  },

  async listSurcharges(params: { page: number; per_page: number; search?: string }) {
    const search = params.search?.trim().toLowerCase();
    const rows = surcharges.filter((row) => row.is_active === 1 || row.is_active === true);
    const filtered = search
      ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(search))
      : rows;
    return paginated(filtered, params.page, params.per_page, "Lấy danh sách phụ phí thành công.");
  },
  async detailSurcharge(id: number) {
    const row = surcharges.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy phụ phí.");
    return success({ ...row }, "Lấy thông tin phụ phí thành công.");
  },
  async createSurcharge(payload: Omit<Surcharge, "id">) {
    if (surcharges.some((row) => row.code === payload.code)) return duplicate("code");
    const row: Surcharge = { ...payload, id: nextIds.surcharges++ };
    surcharges.push(row);
    return success({ ...row }, "Tạo phụ phí thành công.");
  },
  async updateSurcharge(id: number, payload: Omit<Surcharge, "id">) {
    const index = surcharges.findIndex((row) => row.id === id);
    if (index < 0) return notFound("Không tìm thấy phụ phí.");
    if (surcharges.some((row) => row.id !== id && row.code === payload.code)) return duplicate("code");
    surcharges[index] = { ...payload, id };
    return success({ ...surcharges[index] }, "Cập nhật phụ phí thành công.");
  },
  async deleteSurcharge(id: number) {
    const row = surcharges.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy phụ phí.");
    row.is_active = 0;
    return success(null, "Ngừng hoạt động phụ phí thành công.");
  },

  async listPricingTariffs(params: { page: number; per_page: number; search?: string }) {
    const search = params.search?.trim().toLowerCase();
    const rows = pricingTariffs.filter((row) => row.is_active === 1 || row.is_active === true);
    const filtered = search
      ? rows.filter((row) => row.zone_type.toLowerCase().includes(search))
      : rows;
    return paginated(filtered, params.page, params.per_page, "Lấy danh sách bảng giá thành công.");
  },
  async detailPricingTariff(id: number) {
    const row = pricingTariffs.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy bảng giá.");
    return success({ ...row }, "Lấy thông tin bảng giá thành công.");
  },
  async createPricingTariff(payload: Omit<PricingTariff, "id">) {
    const row: PricingTariff = { ...payload, id: nextIds.pricing_tariffs++ };
    pricingTariffs.push(row);
    return success({ ...row }, "Tạo bảng giá thành công.");
  },
  async updatePricingTariff(id: number, payload: Omit<PricingTariff, "id">) {
    const index = pricingTariffs.findIndex((row) => row.id === id);
    if (index < 0) return notFound("Không tìm thấy bảng giá.");
    pricingTariffs[index] = { ...payload, id };
    return success({ ...pricingTariffs[index] }, "Cập nhật bảng giá thành công.");
  },
  async deletePricingTariff(id: number) {
    const row = pricingTariffs.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy bảng giá.");
    row.is_active = 0;
    return success(null, "Ngừng hoạt động bảng giá thành công.");
  },

  async listWeightConversionRules(params: { page: number; per_page: number; search?: string }) {
    const search = params.search?.trim().toLowerCase();
    const rows = weightConversionRules.filter((row) => row.is_active === 1 || row.is_active === true);
    const filtered = search
      ? rows.filter((row) => String(row.service_type_id).includes(search))
      : rows;
    return paginated(filtered, params.page, params.per_page, "Lấy danh sách quy tắc quy đổi trọng lượng thành công.");
  },
  async detailWeightConversionRule(id: number) {
    const row = weightConversionRules.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy quy tắc quy đổi trọng lượng.");
    return success({ ...row }, "Lấy thông tin quy tắc quy đổi trọng lượng thành công.");
  },
  async createWeightConversionRule(payload: Omit<WeightConversionRule, "id">) {
    const row: WeightConversionRule = { ...payload, id: nextIds.weight_conversion_rules++ };
    weightConversionRules.push(row);
    return success({ ...row }, "Tạo quy tắc quy đổi trọng lượng thành công.");
  },
  async updateWeightConversionRule(id: number, payload: Omit<WeightConversionRule, "id">) {
    const index = weightConversionRules.findIndex((row) => row.id === id);
    if (index < 0) return notFound("Không tìm thấy quy tắc quy đổi trọng lượng.");
    weightConversionRules[index] = { ...payload, id };
    return success({ ...weightConversionRules[index] }, "Cập nhật quy tắc quy đổi trọng lượng thành công.");
  },
  async deleteWeightConversionRule(id: number) {
    const row = weightConversionRules.find((item) => item.id === id);
    if (!row) return notFound("Không tìm thấy quy tắc quy đổi trọng lượng.");
    row.is_active = 0;
    return success(null, "Ngừng hoạt động quy tắc quy đổi trọng lượng thành công.");
  },
};
