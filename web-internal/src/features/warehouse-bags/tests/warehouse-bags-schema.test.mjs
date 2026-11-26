import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BAG_STATUSES,
  BAG_STATUS_LABELS,
  BAG_STATUS_BADGE_CLASSES,
} from "../warehouse-bags.constants.ts";
import {
  bagStatusSchema,
  sealNumberSchema,
  bagClosingFormSchema,
  shipmentScanFormSchema,
  bagLookupFormSchema,
} from "../warehouse-bags.schema.ts";

test("Chỉ chấp nhận năm trạng thái túi theo schema", () => {
  assert.deepEqual(BAG_STATUSES, ["open", "sealed", "in_transit", "opened", "cancelled"]);
  for (const status of BAG_STATUSES) {
    assert.equal(bagStatusSchema.parse(status), status);
    assert.ok(BAG_STATUS_LABELS[status]);
    assert.ok(BAG_STATUS_BADGE_CLASSES[status]);
  }
  for (const status of ["draft", "completed", "locked", "SEALED", "", null]) {
    assert.equal(bagStatusSchema.safeParse(status).success, false);
  }
});

test("Seal bắt buộc và có giới hạn 40 ký tự", () => {
  for (const value of ["", "   ", "\t\n", "a".repeat(41), 123, null]) {
    assert.equal(sealNumberSchema.safeParse(value).success, false);
  }
  assert.equal(sealNumberSchema.parse("a".repeat(40)).length, 40);
});

test("Seal giữ số 0 đầu, dấu và nguyên văn chuỗi", () => {
  for (const value of ["0000123", "00-Seal/26.11", "Niêm phong #01", " 001 "]) {
    assert.equal(sealNumberSchema.parse(value), value);
  }
});

test("Form đóng túi yêu cầu chọn kho đích và nhập Seal", () => {
  const valid = { destination_warehouse_id: "selected-warehouse", seal_number: "00001" };
  assert.deepEqual(bagClosingFormSchema.parse(valid), valid);
  for (const destination_warehouse_id of ["", "  ", null, undefined]) {
    const result = bagClosingFormSchema.safeParse({ ...valid, destination_warehouse_id });
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues[0].path, ["destination_warehouse_id"]);
  }
  assert.equal(bagClosingFormSchema.safeParse({ ...valid, seal_number: "" }).success, false);
});

test("Quét thủ công yêu cầu mã và không tự chuẩn hóa mã", () => {
  for (const tracking_code of ["", "  ", null, 123]) {
    assert.equal(shipmentScanFormSchema.safeParse({ tracking_code }).success, false);
  }
  assert.equal(shipmentScanFormSchema.parse({ tracking_code: "000VS-01" }).tracking_code, "000VS-01");
});

test("Tra cứu áp dụng đúng giới hạn mã túi hoặc Seal", () => {
  assert.equal(bagLookupFormSchema.safeParse({ lookupBy: "bag_code", value: "a".repeat(35) }).success, true);
  assert.equal(bagLookupFormSchema.safeParse({ lookupBy: "bag_code", value: "a".repeat(36) }).success, false);
  assert.equal(bagLookupFormSchema.safeParse({ lookupBy: "seal_number", value: "a".repeat(40) }).success, true);
  assert.equal(bagLookupFormSchema.safeParse({ lookupBy: "seal_number", value: "a".repeat(41) }).success, false);
  for (const input of [
    { lookupBy: "bag_code", value: " " },
    { lookupBy: "seal_number", value: "" },
    { lookupBy: "id", value: "1" },
  ]) {
    assert.equal(bagLookupFormSchema.safeParse(input).success, false);
  }
});
