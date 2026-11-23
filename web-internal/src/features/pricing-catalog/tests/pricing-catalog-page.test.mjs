import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync(new URL("../pages/PricingCatalogPage.tsx", import.meta.url), "utf8");
const routerSource = fs.readFileSync(new URL("../../../core/router/AppRouter.tsx", import.meta.url), "utf8");
const sidebarSource = fs.readFileSync(new URL("../../../layouts/components/DynamicSidebar.tsx", import.meta.url), "utf8");

test("TC01-TC03 PricingCatalogPage has 4 tabs and route content", () => {
  assert.match(pageSource, /export function PricingCatalogPage/);
  assert.match(pageSource, /value="service-types"/);
  assert.match(pageSource, /value="value-added-services"/);
  assert.match(pageSource, /value="surcharges"/);
  assert.match(pageSource, /value="tariffs-and-rules"/);
});

test("TC04-TC07 four tabs cover all 5 resources", () => {
  assert.match(pageSource, /ServiceTypesTab/);
  assert.match(pageSource, /ValueAddedServicesTab/);
  assert.match(pageSource, /SurchargesTab/);
  assert.match(pageSource, /usePricingTariffs/);
  assert.match(pageSource, /useWeightConversionRules/);
});

test("TC15-TC18 route, authentication layout and sidebar are integrated", () => {
  assert.match(routerSource, /<ProtectedRoute>/);
  assert.match(routerSource, /path="pricing-catalog"/);
  assert.match(sidebarSource, /to: "\/pricing-catalog"/);
  assert.match(sidebarSource, /Danh mục & bảng giá/);
});

test("TC17 RBAC controls manage operations", () => {
  assert.match(pageSource, /system_admin/);
  assert.match(pageSource, /system_dev/);
  assert.match(pageSource, /canManage/);
});

test("TC21 Page and components do not call axios directly", () => {
  assert.doesNotMatch(pageSource, /from "axios"|axios\./);
  assert.doesNotMatch(
    fs.readFileSync(new URL("../components/CatalogResourcePanel.tsx", import.meta.url), "utf8"),
    /from "axios"|axios\./,
  );
});
