/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import https from "node:https";
import { mock } from "node:test";
import fixture from "../../../mocks/warehouse-bags.mock.json" with { type: "json" };
import {
  createWarehouseBagsService,
  warehouseBagsApi,
  WarehouseBagsContractBlockedError,
} from "../api/warehouse-bags.api.ts";
import type { BagFixtureErrorName } from "../api/warehouse-bags.api.ts";

test("Đọc dataset và pagination Mock đúng envelope và dữ liệu", async () => {
  const service = createWarehouseBagsService({ useMock: true });
  assert.deepEqual(await service.readFixtureDataset(), fixture.success_response);
  assert.deepEqual(await service.listBags(), fixture.pagination_response);
});

test("Tra cứu bag_code/Seal giữ số 0, trả đúng thành viên cùng túi", async () => {
  const service = createWarehouseBagsService({ useMock: true });
  for (const bag of fixture.success_response.data.manifest_bags) {
    const byCode = await service.findBag({ lookupBy: "bag_code", value: bag.bag_code });
    const bySeal = await service.findBag({ lookupBy: "seal_number", value: bag.seal_number });
    assert.deepEqual(byCode, bySeal);
    assert.equal(byCode.success, true);
    assert.ok(byCode.message && byCode.meta.timestamp);
    assert.deepEqual(byCode.data.bag, bag);
    assert.equal(byCode.data.shipments.length, bag.shipment_count);
    assert.equal(byCode.data.manifest_bag_items.length, bag.shipment_count);
    assert.ok(byCode.data.manifest_bag_items.every((item) => item.bag_id === bag.id));
    assert.match(byCode.data.bag.seal_number, /^000/);
  }
});

test("Tra cứu tracking_code chỉ đọc, không thêm vào túi", async () => {
  const service = createWarehouseBagsService({ useMock: true });
  const before = await service.readFixtureDataset();
  for (const shipment of before.data.shipments) {
    const response = await service.findShipment(shipment.tracking_code);
    assert.equal(response.success, true);
    assert.deepEqual(response.data, shipment);
    assert.ok(response.meta.timestamp);
    assert.ok(!("total_weight_gram" in response.data));
  }
  assert.deepEqual(await service.readFixtureDataset(), before);
});

test("Chế độ fixture rỗng trả pagination và 404 nhất quán", async () => {
  const service = createWarehouseBagsService({ useMock: true, scenario: "empty" });
  assert.deepEqual(await service.listBags(), fixture.empty_response);
  const dataset = (await service.readFixtureDataset()).data;
  assert.deepEqual(dataset.manifest_bags, []);
  assert.deepEqual(dataset.shipments, []);
  assert.deepEqual(dataset.manifest_bag_items, []);
  await assert.rejects(service.findBag({ lookupBy: "bag_code", value: "UI-BAG-001" }), (error) => {
    assert.deepEqual(error, fixture.bag_not_found_response);
    return true;
  });
});

test("Mã không tồn tại trả đúng error envelope, không tìm gần đúng Seal", async () => {
  const service = createWarehouseBagsService({ useMock: true });
  for (const input of [
    { lookupBy: "bag_code", value: "UI-MISSING" },
    { lookupBy: "seal_number", value: "SEAL/1" },
  ] as const) {
    await assert.rejects(service.findBag(input), (error) => {
      assert.deepEqual(error, fixture.bag_not_found_response);
      return true;
    });
  }
  await assert.rejects(service.findShipment("UI-MISSING"), (error) => {
    assert.deepEqual(error, fixture.shipment_not_found_response);
    return true;
  });
});

test("Đầu vào không hợp lệ trả 422 details từ schema, giữ nguyên dữ liệu", async () => {
  const service = createWarehouseBagsService({ useMock: true });
  for (const pending of [
    service.findBag({ lookupBy: "seal_number", value: "" }),
    service.findBag({ lookupBy: "bag_code", value: "a".repeat(36) }),
    service.findShipment(" "),
  ]) {
    await assert.rejects(pending, (error: unknown) => {
      assert.ok(typeof error === "object" && error !== null && "error" in error);
      const details = error as { success: boolean; error: { code: string; details: Record<string, string[]> } };
      assert.equal(details.success, false);
      assert.equal(details.error.code, "422_VALIDATION_ERROR");
      assert.ok(Object.values(details.error.details).some((messages) => messages.length > 0));
      return true;
    });
  }
  assert.deepEqual(await service.readFixtureDataset(), fixture.success_response);
});

test("Lỗi mẫu được đọc nguyên vẹn, tách biệt với kết quả nghiệp vụ", async () => {
  const service = createWarehouseBagsService({ useMock: true });
  for (const [key, response] of Object.entries(fixture)) {
    if (!("error" in response)) continue;
    const result = await service.readErrorFixture(key as BagFixtureErrorName);
    assert.deepEqual(result, response);
    result.error.message = "changed by caller";
    assert.deepEqual(await service.readErrorFixture(key as BagFixtureErrorName), response);
  }
});

test("Kết quả đọc được clone, sửa ở caller không làm thay đổi fixture", async () => {
  const service = createWarehouseBagsService({ useMock: true });
  const dataset = await service.readFixtureDataset();
  dataset.data.manifest_bags[0]!.seal_number = "changed";
  const list = await service.listBags();
  list.data[0]!.version = 999;
  const detail = await service.findBag({ lookupBy: "bag_code", value: "UI-BAG-001" });
  detail.data.bag.status = "cancelled";
  detail.data.manifest_bag_items.length = 0;
  const shipment = await service.findShipment("UI-VS-0001");
  shipment.data.status = "cancelled";
  assert.deepEqual(await service.readFixtureDataset(), fixture.success_response);
});

test("API thật BLOCKED trước I/O, không fallback Mock, không có mutation", async () => {
  const fetchSpy = mock.method(globalThis, "fetch", () => { throw new Error("Unexpected fetch"); });
  const httpSpy = mock.method(http, "request", () => { throw new Error("Unexpected HTTP"); });
  const httpsSpy = mock.method(https, "request", () => { throw new Error("Unexpected HTTPS"); });
  try {
    for (const service of [createWarehouseBagsService({ useMock: false }), warehouseBagsApi]) {
      const calls = [
        () => service.readFixtureDataset(),
        () => service.listBags(),
        () => service.findBag({ lookupBy: "seal_number", value: "000-SEAL/1" }),
        () => service.findShipment("UI-VS-0001"),
        () => service.readErrorFixture("forbidden_response"),
      ];
      for (const call of calls) await assert.rejects(call, WarehouseBagsContractBlockedError);
      assert.deepEqual(Object.keys(service).sort(), ["findBag", "findShipment", "listBags", "readErrorFixture", "readFixtureDataset"]);
    }
    assert.equal(fetchSpy.mock.callCount(), 0);
    assert.equal(httpSpy.mock.callCount(), 0);
    assert.equal(httpsSpy.mock.callCount(), 0);
  } finally {
    fetchSpy.mock.restore();
    httpSpy.mock.restore();
    httpsSpy.mock.restore();
  }
});
