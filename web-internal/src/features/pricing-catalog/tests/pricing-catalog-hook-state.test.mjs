import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCatalogMutationGuard,
  isStaleCatalogRequest,
  normalizeCatalogError,
} from "../hooks/pricing-catalog-state.ts";

test("TC01/TC02 fetch state helper is not destructive", () => {
  assert.equal(isStaleCatalogRequest(1, 2), true);
  assert.equal(isStaleCatalogRequest(2, 2), false);
});

test("TC03/TC09 API error is normalized without losing details", () => {
  const error = normalizeCatalogError({
    success: false,
    error: {
      code: "422_VALIDATION_ERROR",
      message: "Dữ liệu không hợp lệ",
      details: { code: ["Mã đã tồn tại"] },
    },
  });
  assert.equal(error.code, "422_VALIDATION_ERROR");
  assert.equal(error.details.code[0], "Mã đã tồn tại");
});

test("TC10 duplicate mutation is blocked", async () => {
  const guard = createCatalogMutationGuard();
  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const firstRun = guard.run(() => first);
  const duplicateRun = guard.run(() => Promise.resolve("duplicate"));
  assert.equal(firstRun !== null, true);
  assert.equal(duplicateRun, null);
  resolveFirst("first");
  await firstRun;
});

test("TC11 stale request is ignored", () => {
  assert.equal(isStaleCatalogRequest(3, 4), true);
  assert.equal(isStaleCatalogRequest(4, 4), false);
});

test("TC35/TC36/TC38 errors keep standard codes", () => {
  assert.equal(normalizeCatalogError({ success: false, error: { code: "401_UNAUTHORIZED", message: "Chưa đăng nhập" } }).code, "401_UNAUTHORIZED");
  assert.equal(normalizeCatalogError({ success: false, error: { code: "403_FORBIDDEN", message: "Không đủ quyền" } }).code, "403_FORBIDDEN");
  assert.equal(normalizeCatalogError({ success: false, error: { code: "500_INTERNAL_ERROR", message: "Lỗi máy chủ" } }).code, "500_INTERNAL_ERROR");
});
