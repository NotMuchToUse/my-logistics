import masterData from "../../../mocks/masterData.mock.json" with { type: "json" };
import type { RoleCode } from "../../../types/rbac.types";
import type { ShipmentDraft } from "../schemas/shipment-create.schema";

type MockZoneType = "intra_province" | "inter_region_near" | "inter_region_far";
export type MockFreightPaymentStatus =
  | "unpaid"
  | "paid_at_counter"
  | "collected_by_driver"
  | "invoiced_postpaid";

export interface MockRouteFixture {
  originProvinceId: number;
  destinationProvinceId: number;
  zoneType: MockZoneType;
  label: string;
  surchargeCodes: readonly string[];
}

export interface MockShipmentQuote {
  route: MockRouteFixture;
  actualWeightGram: number;
  volumetricWeightGram: number;
  chargeableWeightGram: number;
  baseFreight: number;
  surcharges: Array<{ code: string; name: string; amount: number }>;
  valueAddedServices: Array<{ code: string; name: string; amount: number }>;
  discount: number;
  vat: number;
  totalFreight: number;
  codAmount: number;
}

export interface MockShipmentCreateResult {
  mockPublicId: string;
  createdAt: string;
  freightPaymentStatus: MockFreightPaymentStatus;
}

export const MOCK_ROUTE_FIXTURES: readonly MockRouteFixture[] = [
  {
    originProvinceId: 901,
    destinationProvinceId: 901,
    zoneType: "intra_province",
    label: "Tỉnh mẫu A → Tỉnh mẫu A",
    surchargeCodes: ["FUEL"],
  },
  {
    originProvinceId: 901,
    destinationProvinceId: 902,
    zoneType: "inter_region_near",
    label: "Tỉnh mẫu A → Tỉnh mẫu B (fixture liên vùng gần)",
    surchargeCodes: ["FUEL"],
  },
  {
    originProvinceId: 902,
    destinationProvinceId: 901,
    zoneType: "inter_region_far",
    label: "Tỉnh mẫu B → Tỉnh mẫu A (fixture liên vùng xa)",
    surchargeCodes: ["FUEL", "REMOTE_AREA"],
  },
];

export const MOCK_PRICE_ADJUSTMENTS = {
  discountPercent: 5,
  vatPercent: 8,
} as const;

export const MOCK_COUNTER_COLLECTION_PERMISSIONS: Partial<Record<RoleCode, boolean>> = {
  receptionist: true,
  coordinator: false,
};

const catalog = masterData.success_response.data;
let nextMockShipmentNumber = 1;

function isActive(value: number | boolean | undefined) {
  return value !== 0 && value !== false;
}

function roundMoney(value: number) {
  return Math.round(value);
}

export function getMockServiceTypeName(serviceTypeId: number) {
  return catalog.service_types.find((row) => row.id === serviceTypeId)?.name ?? null;
}

export function getMockCargoCategory(cargoCategoryId: number) {
  return catalog.cargo_categories.find((row) => row.id === cargoCategoryId && isActive(row.is_active)) ?? null;
}

export function getMockRouteFixture(originProvinceId: number, destinationProvinceId: number) {
  return MOCK_ROUTE_FIXTURES.find(
    (fixture) =>
      fixture.originProvinceId === originProvinceId &&
      fixture.destinationProvinceId === destinationProvinceId,
  ) ?? null;
}

function getMockTariff(serviceTypeId: number, zoneType: MockZoneType, weightGram: number) {
  const tariffs = catalog.pricing_tariffs
    .filter((row) => row.service_type_id === serviceTypeId && row.zone_type === zoneType && isActive(row.is_active))
    .sort((left, right) => left.min_weight_gram - right.min_weight_gram);
  const matching = tariffs.find((row) => weightGram >= row.min_weight_gram && weightGram <= row.max_weight_gram);
  if (matching) return matching;
  return tariffs.length > 0 && weightGram > tariffs[tariffs.length - 1].max_weight_gram
    ? tariffs[tariffs.length - 1]
    : undefined;
}

export function calculateMockShipmentQuote(draft: ShipmentDraft): MockShipmentQuote | null {
  const route = getMockRouteFixture(draft.sender.provinceId, draft.receiver.provinceId);
  const service = catalog.service_types.find((row) => row.id === draft.serviceTypeId && isActive(row.is_active));
  const conversion = catalog.weight_conversion_rules.find(
    (row) => row.service_type_id === draft.serviceTypeId && isActive(row.is_active),
  );
  if (!route || !service || !conversion || draft.parcels.length === 0) return null;

  const hasTariff = catalog.pricing_tariffs.some(
    (row) => row.service_type_id === draft.serviceTypeId && row.zone_type === route.zoneType && isActive(row.is_active),
  );
  if (!hasTariff || conversion.divisor <= 0) return null;

  let actualWeightGram = 0;
  let volumetricWeightGram = 0;
  let chargeableWeightGram = 0;
  for (const parcel of draft.parcels) {
    const volumetricWeight = (parcel.lengthCm * parcel.widthCm * parcel.heightCm * 1000) / conversion.divisor;
    const chargeableWeight = Math.max(parcel.actualWeightGram, volumetricWeight);
    if (!Number.isFinite(volumetricWeight) || !Number.isFinite(chargeableWeight)) return null;
    actualWeightGram += parcel.actualWeightGram;
    volumetricWeightGram += volumetricWeight;
    chargeableWeightGram += chargeableWeight;
  }
  if (![actualWeightGram, volumetricWeightGram, chargeableWeightGram].every(Number.isFinite)) return null;

  const activeTariff = getMockTariff(draft.serviceTypeId, route.zoneType, chargeableWeightGram);
  if (!activeTariff || activeTariff.step_weight_gram <= 0) return null;
  const extraSteps = Math.max(
    0,
    Math.ceil((chargeableWeightGram - activeTariff.max_weight_gram) / activeTariff.step_weight_gram),
  );
  const baseFreight = activeTariff.base_price + extraSteps * activeTariff.step_price;

  const surcharges = route.surchargeCodes.flatMap((code) => {
    const row = catalog.surcharges.find(
      (item) => item.code === code && isActive(item.is_active) && isActive(item.is_auto_applied),
    );
    if (!row) return [];
    return [{
      code: row.code,
      name: row.name,
      amount: roundMoney(
        row.fee_type === "percentage" ? (baseFreight * row.fee_value) / 100 : row.fee_value,
      ),
    }];
  });

  const declaredValue = Number(draft.declaredValue);
  const valueAddedServices = draft.selectedVasIds.map((id) => {
    const row = catalog.value_added_services.find((item) => item.id === id && isActive(item.is_active));
    if (!row) return null;
    const percentageBase = row.code === "DECLARED_VALUE_INSURANCE" ? declaredValue : baseFreight;
    const rawAmount = row.fee_type === "percentage" ? (percentageBase * row.fee_value) / 100 : row.fee_value;
    return { code: row.code, name: row.name, amount: roundMoney(rawAmount) };
  });
  if (valueAddedServices.some((row) => row === null)) return null;

  const discount = roundMoney((baseFreight * MOCK_PRICE_ADJUSTMENTS.discountPercent) / 100);
  const subtotal =
    baseFreight +
    surcharges.reduce((sum, row) => sum + row.amount, 0) +
    valueAddedServices.reduce((sum, row) => sum + (row?.amount ?? 0), 0) -
    discount;
  const vat = roundMoney((Math.max(0, subtotal) * MOCK_PRICE_ADJUSTMENTS.vatPercent) / 100);
  const totalFreight = subtotal + vat;
  const moneyAmounts = [baseFreight, discount, vat, totalFreight];
  if (
    !moneyAmounts.every(Number.isSafeInteger) ||
    !Number.isFinite(declaredValue) ||
    !Number.isFinite(Number(draft.codAmount)) ||
    totalFreight < 0
  ) return null;

  return {
    route,
    actualWeightGram,
    volumetricWeightGram,
    chargeableWeightGram,
    baseFreight,
    surcharges,
    valueAddedServices: valueAddedServices.filter(
      (row): row is NonNullable<typeof row> => row !== null,
    ),
    discount,
    vat,
    totalFreight,
    codAmount: Number(draft.codAmount),
  };
}

export function canMockCollectAtCounter(
  roles: readonly RoleCode[],
  permissions: Partial<Record<RoleCode, boolean>> = MOCK_COUNTER_COLLECTION_PERMISSIONS,
) {
  return roles.some((role) => permissions[role] === true);
}

export function getMockFreightPaymentStatus(
  paymentMethod: ShipmentDraft["paymentMethod"],
  confirmedAtCounter: boolean,
): MockFreightPaymentStatus {
  if (paymentMethod === "ngtts") return "invoiced_postpaid";
  if (paymentMethod === "ngttn" && confirmedAtCounter) return "paid_at_counter";
  return "unpaid";
}

export function createMockShipment(
  paymentMethod: ShipmentDraft["paymentMethod"],
  confirmedAtCounter: boolean,
): MockShipmentCreateResult {
  const sequence = String(nextMockShipmentNumber++).padStart(6, "0");
  return {
    mockPublicId: `MOCK-SHP-${sequence}`,
    createdAt: new Date().toISOString(),
    freightPaymentStatus: getMockFreightPaymentStatus(paymentMethod, confirmedAtCounter),
  };
}

export function assertShipmentCreateMockEnabled(useMock: boolean) {
  if (!useMock) {
    throw new Error("POST /api/v1/shipments chưa được gọi vì Request DTO và contract Backend chưa được xác nhận.");
  }
}
