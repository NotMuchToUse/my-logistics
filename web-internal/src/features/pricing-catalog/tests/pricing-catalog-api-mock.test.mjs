import { test } from "node:test";
import assert from "node:assert/strict";
import { pricingCatalogMockService } from "../api/pricing-catalog.mock.ts";

test("Mock service lists all 5 resources with pagination envelope", async () => {
  const params = { page: 1, per_page: 20 };
  const [types, vas, surcharges, tariffs, rules] = await Promise.all([
    pricingCatalogMockService.listServiceTypes(params),
    pricingCatalogMockService.listValueAddedServices(params),
    pricingCatalogMockService.listSurcharges(params),
    pricingCatalogMockService.listPricingTariffs(params),
    pricingCatalogMockService.listWeightConversionRules(params),
  ]);
  for (const response of [types, vas, surcharges, tariffs, rules]) {
    assert.equal(response.success, true);
    assert.equal(response.meta.pagination.page, 1);
    assert.ok(Array.isArray(response.data));
  }
});

test("Mock service performs create, update and soft delete for service types", async () => {
  const payload = {
    code: "TEST_SERVICE",
    name: "Dịch vụ kiểm thử",
    description: null,
    estimated_days_min: 1,
    estimated_days_max: 2,
    is_active: true,
  };
  const created = await pricingCatalogMockService.createServiceType(payload);
  assert.equal(created.success, true);
  assert.equal(created.data.code, "TEST_SERVICE");
  const updated = await pricingCatalogMockService.updateServiceType(created.data.id, {
    ...payload,
    name: "Dịch vụ kiểm thử đã cập nhật",
  });
  assert.equal(updated.data.name, "Dịch vụ kiểm thử đã cập nhật");
  await pricingCatalogMockService.deleteServiceType(created.data.id);
  await assert.rejects(
    () => pricingCatalogMockService.detailServiceType(created.data.id),
    (error) => error.success === false && error.error.code === "404_NOT_FOUND",
  );
});

test("Mock service rejects duplicate service type code", async () => {
  await assert.rejects(
    () =>
      pricingCatalogMockService.createServiceType({
        code: "EXPRESS",
        name: "Trùng mã",
        description: null,
        estimated_days_min: 1,
        estimated_days_max: 1,
        is_active: true,
      }),
    (error) => error.success === false && error.error.code === "422_VALIDATION_ERROR",
  );
});

test("Mock service creates and soft deletes the remaining resources", async () => {
  const vas = await pricingCatalogMockService.createValueAddedService({
    code: "TEST_VAS",
    name: "DVGT kiểm thử",
    fee_type: "fixed",
    fee_value: 1000,
    min_fee: 1000,
    max_fee: 1000,
    is_active: true,
  });
  await pricingCatalogMockService.deleteValueAddedService(vas.data.id);

  const surcharge = await pricingCatalogMockService.createSurcharge({
    code: "TEST_SURCHARGE",
    name: "Phụ phí kiểm thử",
    fee_type: "percentage",
    fee_value: 5,
    is_auto_applied: true,
    is_active: true,
  });
  await pricingCatalogMockService.deleteSurcharge(surcharge.data.id);

  const tariff = await pricingCatalogMockService.createPricingTariff({
    service_type_id: 1,
    zone_type: "intra_province",
    min_weight_gram: 0,
    max_weight_gram: 1000,
    base_price: 10000,
    step_weight_gram: 500,
    step_price: 1000,
    effective_from: "2026-01-01",
    effective_to: null,
    is_active: true,
  });
  await pricingCatalogMockService.deletePricingTariff(tariff.data.id);

  const rule = await pricingCatalogMockService.createWeightConversionRule({
    service_type_id: 1,
    divisor: 5000,
    min_chargeable_gram: 1000,
    effective_from: "2026-01-01",
    effective_to: null,
    is_active: true,
  });
  await pricingCatalogMockService.deleteWeightConversionRule(rule.data.id);
});
