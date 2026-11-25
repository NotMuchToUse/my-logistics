import { test } from "node:test";
import assert from "node:assert/strict";
import axios, { AxiosHeaders, CanceledError } from "axios";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createShipmentListApi } from "../api/shipment-list.service.ts";

const fixture = JSON.parse(readFileSync(
  fileURLToPath(new URL("../../../mocks/shipment-list.mock.json", import.meta.url)),
  "utf8",
));
const records = fixture.data.pagination_response.data;

function createHarness({
  useMock = true,
  responseFor = () => fixture.data.pagination_response,
} = {}) {
  const requests = [];
  const client = axios.create({
    baseURL: "https://api.example.invalid",
    adapter: async (config) => {
      requests.push(config);
      const data = await responseFor(config);
      return {
        data,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        config,
      };
    },
  });

  return {
    api: createShipmentListApi({ client, useMock, fixture }),
    requests,
  };
}

test("API mode sends only verified snake_case list parameters with defaults", async () => {
  const { api, requests } = createHarness({ useMock: false });
  const response = await api.fetchShipmentsApi({
    tracking_code: " VS26112300001 ",
    phone: "",
    status: "draft",
    service_type_id: 1,
    is_priority: false,
    from_date: "2026-11-01",
    to_date: "",
    sort_by: "created_at",
    sort_direction: "ASC",
  });

  assert.equal(response.success, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "get");
  assert.equal(requests[0].url, "/api/v1/shipments");
  assert.deepEqual(requests[0].params, {
    page: 1,
    per_page: 20,
    tracking_code: "VS26112300001",
    status: "draft",
    service_type_id: 1,
    is_priority: 0,
    from_date: "2026-11-01",
    sort_by: "created_at",
    sort_direction: "ASC",
  });
  assert.equal("origin_branch_id" in requests[0].params, false);
  assert.equal("destination_branch_id" in requests[0].params, false);
  const requestUrl = new URL(
    axios.getUri(requests[0]),
    "https://api.example.invalid",
  );
  assert.equal(requestUrl.searchParams.has("phone"), false);
  assert.equal(requestUrl.searchParams.get("is_priority"), "0");
});

test("API mode serializes both priority values without dropping zero", async () => {
  const { api, requests } = createHarness({ useMock: false });
  await api.fetchShipmentsApi({ is_priority: 1 });
  await api.fetchShipmentsApi({ is_priority: 0 });

  assert.equal(requests[0].params.is_priority, 1);
  assert.equal(requests[1].params.is_priority, 0);
  assert.equal("tracking_code" in requests[0].params, false);
  assert.equal("phone" in requests[0].params, false);
});

test("API mode rejects MOCK ONLY branch filters instead of silently ignoring them", async () => {
  const { api, requests } = createHarness({ useMock: false });
  await assert.rejects(
    () => api.fetchShipmentsApi({ destination_branch_id: 9 }),
    /chỉ khả dụng ở Mock Mode/u,
  );
  assert.equal(requests.length, 0);

  await api.fetchShipmentsApi({}, undefined, { branchId: 3, warehouseId: null });
  assert.equal(requests.length, 1);
  assert.equal("branch_id" in requests[0].params, false);
});

test("API mode propagates request failures without falling back to Mock", async () => {
  const failure = Object.assign(new Error("network unavailable"), {
    code: "ERR_NETWORK",
  });
  const { api } = createHarness({
    useMock: false,
    responseFor: () => Promise.reject(failure),
  });

  await assert.rejects(() => api.fetchShipmentsApi(), (error) => error === failure);
  await assert.rejects(
    () =>
      api.updateShipmentPriorityApi(records[0].public_id, {
        is_priority: true,
        version: records[0].version,
      }),
    (error) => error === failure,
  );
});

test("list API forwards AbortSignal and reports an explicit cancellation", async () => {
  const controller = new AbortController();
  const requests = [];
  const client = axios.create({
    baseURL: "https://api.example.invalid",
    adapter: (config) => new Promise((resolve, reject) => {
      requests.push(config);
      config.signal.addEventListener("abort", () => reject(new CanceledError()), {
        once: true,
      });
    }),
  });
  const api = createShipmentListApi({ client, useMock: false, fixture });
  const request = api.fetchShipmentsApi({}, controller.signal);
  controller.abort();

  await assert.rejects(request, (error) => error.name === "AbortError");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].signal, controller.signal);
});

test("Mock Mode applies each supported and MOCK ONLY filter, including exact synthetic phones", async () => {
  const { api } = createHarness();
  const cases = [
    [{ tracking_code: "VS26112300001" }, ["VS26112300001"]],
    [{ status: "pending_pickup" }, ["VS26112300002", "VS26112300015"]],
    [{ service_type_id: 3 }, records.filter((row) => row.service_type_id === 3).map((row) => row.tracking_code)],
    [{ origin_branch_id: 3 }, records.filter((row) => row.origin_branch_id === 3).map((row) => row.tracking_code)],
    [{ destination_branch_id: 5 }, records.filter((row) => row.destination_branch_id === 5).map((row) => row.tracking_code)],
    [{ phone: "0000000000" }, ["VS26112300001"]],
    [{ is_priority: 0 }, records.filter((row) => !row.is_priority).map((row) => row.tracking_code)],
    [{ is_priority: 1 }, records.filter((row) => row.is_priority).map((row) => row.tracking_code)],
    [{ from_date: "2026-11-23", to_date: "2026-11-23" }, ["VS26112300001", "VS26112300002"]],
  ];

  for (const [filters, expected] of cases) {
    const response = await api.fetchShipmentsApi({
      ...filters,
      sort_by: "tracking_code",
      sort_direction: "ASC",
      per_page: 100,
    });
    assert.deepEqual(
      response.data.map((row) => row.tracking_code),
      expected.sort(),
    );
    assert.equal(response.meta.pagination.total, expected.length);
  }

  await assert.rejects(() => api.fetchShipmentsApi({ phone: "090***0101" }));
});

test("Mock Mode scopes rows by explicit synthetic Branch Scope assignments", async () => {
  const { api } = createHarness();
  const branchThree = await api.fetchShipmentsApi(
    { per_page: 100 },
    undefined,
    { branchId: 3, warehouseId: null },
  );
  const branchFour = await api.fetchShipmentsApi(
    { per_page: 100 },
    undefined,
    { branchId: 4, warehouseId: null },
  );

  assert.equal(branchThree.meta.pagination.total, 12);
  assert.equal(branchFour.meta.pagination.total, 12);
  assert.ok(
    branchThree.data.every((row) =>
      fixture.data.mock_only.branch_scope_fixtures.some(
        (scope) => scope.public_id === row.public_id && scope.branch_id === 3,
      ),
    ),
  );
  assert.ok(
    branchFour.data.every((row) =>
      fixture.data.mock_only.branch_scope_fixtures.some(
        (scope) => scope.public_id === row.public_id && scope.branch_id === 4,
      ),
    ),
  );
  await assert.rejects(() =>
    api.fetchShipmentsApi(
      {},
      undefined,
      { branchId: 3, warehouseId: 8 },
    ),
  );
});

test("Mock Mode combines filters with AND and sorts before paginating", async () => {
  const { api } = createHarness();
  const combined = await api.fetchShipmentsApi({
    origin_branch_id: 3,
    destination_branch_id: 5,
    service_type_id: 1,
    status: "draft",
    is_priority: 0,
    from_date: "2026-11-23",
    to_date: "2026-11-23",
    sort_by: "tracking_code",
    sort_direction: "DESC",
  });
  assert.deepEqual(combined.data.map((row) => row.tracking_code), ["VS26112300001"]);

  const sortedPage = await api.fetchShipmentsApi({
    sort_by: "tracking_code",
    sort_direction: "DESC",
    page: 2,
    per_page: 10,
  });
  assert.equal(sortedPage.meta.pagination.total, 24);
  assert.equal(sortedPage.meta.pagination.total_pages, 3);
  assert.deepEqual(
    sortedPage.data.map((row) => row.tracking_code),
    records
      .map((row) => row.tracking_code)
      .sort()
      .reverse()
      .slice(10, 20),
  );
});

test("Mock Mode sorts each verified server sort field in both directions", async () => {
  const { api } = createHarness();
  for (const sort_by of [
    "created_at",
    "tracking_code",
    "cod_amount",
    "total_freight_amount",
  ]) {
    const ascending = await api.fetchShipmentsApi({
      sort_by,
      sort_direction: "ASC",
      per_page: 100,
    });
    const descending = await api.fetchShipmentsApi({
      sort_by,
      sort_direction: "DESC",
      per_page: 100,
    });
    const compare =
      sort_by === "created_at" || sort_by === "tracking_code"
        ? (left, right) => String(left[sort_by]).localeCompare(String(right[sort_by]))
        : (left, right) => Number(left[sort_by]) - Number(right[sort_by]);

    for (let index = 1; index < ascending.data.length; index += 1) {
      assert.ok(compare(ascending.data[index - 1], ascending.data[index]) <= 0);
      assert.ok(compare(descending.data[index - 1], descending.data[index]) >= 0);
    }
  }
});

test("Mock Mode returns valid empty pagination and enforces query validation", async () => {
  const { api } = createHarness();
  const defaults = await api.fetchShipmentsApi();
  assert.equal(defaults.meta.pagination.page, 1);
  assert.equal(defaults.meta.pagination.per_page, 20);
  assert.equal(defaults.meta.pagination.total, 24);
  assert.equal(defaults.meta.pagination.total_pages, 2);
  assert.equal(defaults.data.length, 20);

  const empty = await api.fetchShipmentsApi({ tracking_code: "UNKNOWN" });
  assert.deepEqual(empty.data, []);
  assert.equal(empty.meta.pagination.total, 0);
  assert.equal(empty.meta.pagination.total_pages, 0);

  for (const invalid of [
    { page: 0 },
    { per_page: 101 },
    { sort_by: "unverified" },
    { from_date: "2026-02-30" },
    { from_date: "2026-11-20", to_date: "2026-11-19" },
    { origin_branch_id: 0 },
  ]) {
    await assert.rejects(() => api.fetchShipmentsApi(invalid));
  }
});

test("Mock priority mutation updates only priority/version and refetch sees the change", async () => {
  const { api } = createHarness();
  const before = (await api.fetchShipmentsApi({ tracking_code: records[0].tracking_code })).data[0];
  const updated = await api.updateShipmentPriorityApi(before.public_id, {
    is_priority: true,
    version: before.version,
  });
  const after = (await api.fetchShipmentsApi({ tracking_code: before.tracking_code })).data[0];

  assert.equal(updated.data.is_priority, true);
  assert.equal(updated.data.version, before.version + 1);
  assert.equal(after.is_priority, true);
  assert.equal(after.version, before.version + 1);
  assert.equal(after.status, before.status);
  assert.equal(after.cod_amount, before.cod_amount);
  assert.equal(after.total_freight_amount, before.total_freight_amount);
});

test("Mock priority mutation rejects invalid IDs, payloads, and stale versions", async () => {
  const { api } = createHarness();
  const row = records[0];

  await assert.rejects(() =>
    api.updateShipmentPriorityApi("not-a-ulid", { is_priority: true, version: 1 }),
  );
  await assert.rejects(() =>
    api.updateShipmentPriorityApi(row.public_id, { is_priority: 1, version: row.version }),
  );
  await assert.rejects(
    () =>
      api.updateShipmentPriorityApi(row.public_id, {
        is_priority: true,
        version: row.version + 1,
      }),
    (error) => error.success === false && error.error.code === "409_VERSION_CONFLICT",
  );
});

test("API Mode sends verified priority PATCH path, Boolean payload, and response", async () => {
  const result = {
    success: true,
    message: "Cập nhật ưu tiên vận đơn thành công.",
    data: { public_id: records[0].public_id, is_priority: true, version: 2 },
    meta: { timestamp: "2026-11-24T09:30:00+07:00" },
  };
  const { api, requests } = createHarness({
    useMock: false,
    responseFor: () => result,
  });
  const response = await api.updateShipmentPriorityApi(records[0].public_id, {
    is_priority: true,
    version: 1,
  });

  assert.deepEqual(response, result);
  assert.equal(requests[0].method, "patch");
  assert.equal(
    requests[0].url,
    `/api/v1/shipments/${records[0].public_id}/priority`,
  );
  assert.deepEqual(JSON.parse(requests[0].data), {
    is_priority: true,
    version: 1,
  });
});

test("Mock cancellation updates only status/version and preserves all money fields", async () => {
  const { api } = createHarness();
  const before = (await api.fetchShipmentsApi({
    tracking_code: "VS26112300001",
  })).data[0];
  const cancelled = await api.cancelShipmentApi(before.public_id, {
    version: before.version,
    cancel_reason: " Lý do mẫu ",
  });
  const after = (await api.fetchShipmentsApi({
    tracking_code: before.tracking_code,
  })).data[0];

  assert.equal(cancelled.data.status, "cancelled");
  assert.equal(cancelled.data.version, before.version + 1);
  assert.equal(after.status, "cancelled");
  assert.equal(after.version, before.version + 1);
  assert.equal(after.cod_amount, before.cod_amount);
  assert.equal(after.total_freight_amount, before.total_freight_amount);
});

test("Mock cancellation rejects ineligible status and stale version with error envelopes", async () => {
  const { api } = createHarness();
  const ineligible = records.find((row) => row.status === "in_transit");
  const eligible = records.find((row) => row.status === "draft");

  await assert.rejects(
    () => api.cancelShipmentApi(ineligible.public_id, { version: ineligible.version }),
    (error) => error.success === false && error.error.code === "422_VALIDATION_ERROR",
  );
  await assert.rejects(
    () => api.cancelShipmentApi(eligible.public_id, { version: eligible.version + 1 }),
    (error) => error.success === false && error.error.code === "409_VERSION_CONFLICT",
  );
  await assert.rejects(
    () => api.cancelShipmentApi(eligible.public_id, { version: 0 }),
  );
});

test("Mock cancellation blocks every non-cancellable shipment state", async () => {
  const { api } = createHarness();
  const ineligibleRows = records.filter(
    (row) => row.status !== "draft" && row.status !== "pending_pickup",
  );

  for (const row of ineligibleRows) {
    await assert.rejects(
      () => api.cancelShipmentApi(row.public_id, { version: row.version }),
      (error) => error.success === false && error.error.code === "422_VALIDATION_ERROR",
      row.status,
    );
  }
});

test("API Mode posts cancellation to the confirmed endpoint with optional reason", async () => {
  const result = {
    success: true,
    message: "Hủy vận đơn thành công.",
    data: { public_id: records[0].public_id, status: "cancelled", version: 2 },
    meta: { timestamp: "2026-11-24T09:30:00+07:00" },
  };
  const { api, requests } = createHarness({
    useMock: false,
    responseFor: () => result,
  });
  const response = await api.cancelShipmentApi(records[0].public_id, { version: 1 });

  assert.deepEqual(response, result);
  assert.equal(requests[0].method, "post");
  assert.equal(
    requests[0].url,
    `/api/v1/shipments/${records[0].public_id}/cancel`,
  );
  assert.deepEqual(JSON.parse(requests[0].data), { version: 1 });
});

test("Mock Mode does not call HTTP and mutations return not-found without fallback", async () => {
  const { api, requests } = createHarness();
  await assert.rejects(
    () => api.updateShipmentPriorityApi("01JDC9X8K2M4N6P8Q0R2S4T6VZ", {
      is_priority: true,
      version: 1,
    }),
    (error) => error.success === false && error.error.code === "404_NOT_FOUND",
  );
  assert.equal(requests.length, 0);
});
