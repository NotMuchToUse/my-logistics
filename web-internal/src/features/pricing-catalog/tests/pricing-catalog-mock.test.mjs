import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  serviceTypeSchema,
  valueAddedServiceSchema,
  surchargeSchema,
  pricingTariffSchema,
  weightConversionRuleSchema,
} from "../schemas/pricing-catalog.schema.ts";

const mock = JSON.parse(
  fs.readFileSync(
    new URL("../../../mocks/pricingCatalog.mock.json", import.meta.url),
    "utf8",
  ),
);

test("Mock success envelope is valid", () => {
  assert.equal(mock.success_response.success, true);
  assert.ok(Array.isArray(mock.success_response.data.service_types));
  assert.ok(Array.isArray(mock.success_response.data.value_added_services));
  assert.ok(Array.isArray(mock.success_response.data.surcharges));
  assert.ok(Array.isArray(mock.success_response.data.pricing_tariffs));
  assert.ok(Array.isArray(mock.success_response.data.weight_conversion_rules));
  assert.ok(mock.success_response.meta.timestamp);
});

test("Mock pagination envelope is valid", () => {
  assert.equal(mock.pagination_response.success, true);
  assert.equal(mock.pagination_response.meta.pagination.page, 1);
  assert.equal(mock.pagination_response.meta.pagination.per_page, 20);
  assert.equal(mock.pagination_response.meta.pagination.total, 1);
});

test("Mock error envelope is valid", () => {
  assert.equal(mock.error_response.success, false);
  assert.equal(mock.error_response.error.code, "422_VALIDATION_ERROR");
  assert.ok(Array.isArray(mock.error_response.error.details.code));
});

test("Service type mock satisfies Zod schema", () => {
  const row = mock.success_response.data.service_types[0];
  assert.equal(serviceTypeSchema.safeParse(row).success, true);
});

test("Value-added service mock satisfies Zod schema", () => {
  const row = mock.success_response.data.value_added_services[0];
  assert.equal(valueAddedServiceSchema.safeParse(row).success, true);
});

test("Surcharge mock satisfies Zod schema", () => {
  const row = mock.success_response.data.surcharges[0];
  assert.equal(surchargeSchema.safeParse(row).success, true);
});

test("Pricing tariff mock satisfies Zod schema", () => {
  const row = mock.success_response.data.pricing_tariffs[0];
  assert.equal(pricingTariffSchema.safeParse(row).success, true);
});

test("Weight conversion mock satisfies Zod schema", () => {
  const row = mock.success_response.data.weight_conversion_rules[0];
  assert.equal(weightConversionRuleSchema.safeParse(row).success, true);
});
