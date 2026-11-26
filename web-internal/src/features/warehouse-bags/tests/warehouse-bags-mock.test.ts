/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import fixture from "../../../mocks/warehouse-bags.mock.json" with { type: "json" };
import { BAG_STATUSES } from "../warehouse-bags.constants.ts";
import {
  bagClosingFormSchema,
  bagCodeSchema,
  bagLookupFormSchema,
  bagStatusSchema,
  sealNumberSchema,
  shipmentScanFormSchema,
} from "../warehouse-bags.schema.ts";
import type { BagSummaryData } from "../warehouse-bags.types.ts";

// Projection UI: thiếu trọng lượng có chủ đích; không phải DTO KHA-39.
type StaticBag = Omit<BagSummaryData, "status" | "total_weight_gram"> & {
  status: string;
  id: number;
  origin_warehouse_id: number;
  destination_warehouse_id: number;
};
const bags: StaticBag[] = fixture.success_response.data.manifest_bags;
const { warehouses, shipments, manifest_bag_items: items } = fixture.success_response.data;

test("Tất cả fixture dùng envelope và snake_case, không chứa endpoint/payload", () => {
  const checkKeys = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(checkKeys);
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.match(key, /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
      assert.ok(!["endpoint", "method", "payload", "permissions", "token"].includes(key));
      checkKeys(child);
    }
  };
  checkKeys(fixture);
  for (const response of Object.values(fixture)) {
    assert.equal(Number.isNaN(Date.parse(response.meta.timestamp)), false);
    if ("data" in response) {
      assert.equal(response.success, true);
      assert.equal(typeof response.message, "string");
      assert.ok("data" in response);
      assert.ok(!("error" in response));
    } else {
      assert.equal(response.success, false);
      assert.ok(!("data" in response));
      assert.equal(typeof response.error.message, "string");
      for (const messages of Object.values(response.error.details)) {
        assert.ok(Array.isArray(messages));
        assert.ok(messages.every((message) => typeof message === "string"));
      }
    }
  }
});

test("Đủ năm trạng thái, định danh ULID và Seal duy nhất giữ số 0 đầu", () => {
  assert.deepEqual(bags.map((bag) => bagStatusSchema.parse(bag.status)), [...BAG_STATUSES]);
  for (const rows of [warehouses, bags, shipments]) {
    assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
    assert.equal(new Set(rows.map((row) => row.public_id)).size, rows.length);
    for (const row of rows) assert.match(row.public_id, /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  }
  for (const bag of bags) {
    assert.equal(sealNumberSchema.parse(bag.seal_number), bag.seal_number);
    assert.match(bag.seal_number, /^000/);
    bagCodeSchema.parse(bag.bag_code);
    assert.ok(Number.isInteger(bag.version) && bag.version >= 1);
  }
  assert.equal(new Set(bags.map((bag) => bag.seal_number)).size, bags.length);
  assert.equal(new Set(bags.map((bag) => bag.bag_code)).size, bags.length);
});

test("Kho, túi, items, vận đơn nhất quán và không trùng cùng túi", () => {
  for (const bag of bags) {
    assert.ok(warehouses.some((warehouse) => warehouse.id === bag.origin_warehouse_id));
    assert.ok(warehouses.some((warehouse) => warehouse.id === bag.destination_warehouse_id));
    const members = items.filter((item) => item.bag_id === bag.id);
    assert.equal(bag.shipment_count, members.length);
    assert.equal(new Set(members.map((item) => item.shipment_id)).size, members.length);
  }
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.equal(new Set(shipments.map((shipment) => shipment.tracking_code)).size, shipments.length);
  for (const item of items) {
    assert.ok(bags.some((bag) => bag.id === item.bag_id));
    assert.ok(shipments.some((shipment) => shipment.id === item.shipment_id));
    assert.ok(Number.isInteger(item.scanned_in_by));
    assert.equal(item.unpacked_by === null, item.unpacked_at === null);
  }
  for (const shipment of shipments) {
    assert.ok(shipment.current_warehouse_id === null || warehouses.some((warehouse) => warehouse.id === shipment.current_warehouse_id));
    if (shipment.status === "in_transit") assert.equal(shipment.current_warehouse_id, null);
  }
});

test("Dữ liệu nhập hai tab tái sử dụng Zod, không tự điền trọng lượng", () => {
  for (const bag of bags) {
    bagClosingFormSchema.parse({ destination_warehouse_id: String(bag.destination_warehouse_id), seal_number: bag.seal_number });
    bagLookupFormSchema.parse({ lookupBy: "bag_code", value: bag.bag_code });
    bagLookupFormSchema.parse({ lookupBy: "seal_number", value: bag.seal_number });
    assert.ok(!("total_weight_gram" in bag));
  }
  for (const shipment of shipments) {
    shipmentScanFormSchema.parse({ tracking_code: shipment.tracking_code });
    for (const key of ["actual_weight_gram", "volumetric_weight_gram", "chargeable_weight_gram"]) {
      assert.ok(!(key in shipment));
    }
  }
});

test("Pagination và danh sách rỗng có tổng nhất quán", () => {
  assert.deepEqual(fixture.pagination_response.data, bags);
  for (const response of [fixture.pagination_response, fixture.empty_response]) {
    const pagination = response.meta.pagination;
    assert.equal(pagination.page, 1);
    assert.equal(pagination.total, response.data.length);
    assert.equal(pagination.total_pages, Math.ceil(pagination.total / pagination.per_page));
  }
  assert.deepEqual(fixture.empty_response.data, []);
});

test("Lỗi chuẩn, không tìm thấy và trùng mã chỉ là envelope hiển thị", () => {
  const expected = {
    unauthorized_response: "401_UNAUTHORIZED",
    forbidden_response: "403_FORBIDDEN",
    branch_scope_response: "403_BRANCH_SCOPE",
    bag_not_found_response: "404_NOT_FOUND",
    shipment_not_found_response: "404_NOT_FOUND",
    version_conflict_response: "409_VERSION_CONFLICT",
    idempotency_duplicate_response: "409_IDEMPOTENCY_DUPLICATE",
    duplicate_tracking_response: "422_VALIDATION_ERROR",
    duplicate_seal_response: "422_VALIDATION_ERROR",
    invalid_form_response: "422_VALIDATION_ERROR",
    server_error_response: "500_INTERNAL_ERROR",
  } as const;
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    assert.equal(fixture[key].success, false);
    assert.equal(fixture[key].error.code, expected[key]);
  }
  assert.ok(fixture.duplicate_tracking_response.error.details.tracking_code.length);
  assert.ok(fixture.duplicate_seal_response.error.details.seal_number.length);
  assert.deepEqual(Object.keys(fixture.invalid_form_response.error.details).sort(), ["destination_warehouse_id", "seal_number"]);
});
