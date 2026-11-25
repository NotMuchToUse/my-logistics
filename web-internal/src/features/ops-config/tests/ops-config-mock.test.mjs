import { test } from "node:test";
import assert from "node:assert/strict";
import { OpsConfigMockError } from "../api/ops-config.mock.ts";
import { createOpsConfigHarness } from "./ops-config.test-helpers.mjs";

const validSla = {
  service_type_id: 1,
  route_scope: "inter_region",
  pickup_sla_minutes: 180,
  warehouse_inbound_sla_minutes: 240,
  linehaul_sla_hours: 24,
  delivery_sla_hours: 36,
  max_storage_days_before_return: 5,
  is_active: 1,
};

const validRouting = {
  origin_warehouse_id: 3,
  destination_branch_id: 1,
  next_hop_warehouse_id: 2,
  transport_mode: "air_cargo",
  estimated_transit_hours: 19,
  is_active: 1,
};

const validPartner = (code) => ({
  code,
  name: "Đối tác tổng hợp",
  partner_type: "linehaul_carrier",
  contact_person: null,
  contact_phone: null,
  api_endpoint: null,
  is_active: 1,
});

const validVehicle = (plate_number, overrides = {}) => ({
  branch_id: 3,
  partner_id: null,
  plate_number,
  vehicle_type: "van",
  max_payload_kg: "1500.00",
  default_driver_id: null,
  status: "available",
  ...overrides,
});

async function assertApiError(promise, code, field) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof OpsConfigMockError);
    assert.equal(error.response.error.code, code);
    if (field) assert.ok(error.response.error.details[field]);
    return true;
  });
}

test("Mock envelopes, fixture data and list pagination use the shared response shape", async () => {
  const { fixture, service } = createOpsConfigHarness();
  assert.equal(fixture.success_response.success, true);
  assert.equal(fixture.pagination_response.meta.pagination.per_page, 20);
  assert.equal(fixture.error_responses.bad_request.error.code, "400_BAD_REQUEST");
  assert.equal(fixture.error_responses.forbidden.error.code, "403_FORBIDDEN");
  assert.equal(fixture.error_responses.not_found.error.code, "404_NOT_FOUND");
  assert.ok(fixture.data.sla_deadlines.some((row) => row.is_active === 0));
  assert.ok(fixture.data.routing_rules.some((row) => row.is_active === 0));
  assert.ok(fixture.data.partners.some((row) => row.is_active === 0));
  assert.deepEqual(
    new Set(fixture.data.vehicles.map((row) => row.status)),
    new Set(["available", "maintenance", "in_transit", "retired"]),
  );

  const firstPage = await service.listRoutingRules({ page: 1, per_page: 1 });
  assert.equal(firstPage.success, true);
  assert.equal(firstPage.data.length, 1);
  assert.deepEqual(firstPage.meta.pagination, {
    page: 1,
    per_page: 1,
    total: 3,
    total_pages: 3,
  });
  await assertApiError(
    service.listRoutingRules({ page: 1, per_page: 101 }),
    "400_BAD_REQUEST",
  );
});

test("Mock list filters are combined before pagination and empty results stay valid", async () => {
  const { service } = createOpsConfigHarness();
  await service.createPartner(validPartner("MOCK-3PL-04"));
  await service.createPartner({
    ...validPartner("MOCK-3PL-03"),
    partner_type: "airline_agent",
  });

  const filtered = await service.listPartners({
    page: 1,
    per_page: 1,
    search: "MOCK-3PL",
    filters: { partner_type: "airline_agent", is_active: "1" },
  });
  assert.equal(filtered.meta.pagination.total, 1);
  assert.equal(filtered.data[0].code, "MOCK-3PL-03");

  const inactive = await service.listPartners({
    page: 1,
    per_page: 20,
    filters: { partner_type: "lastmile_3pl", is_active: "0" },
  });
  assert.equal(inactive.data.length, 1);
  assert.equal(inactive.data[0].code, "MOCK-3PL-02");
  assert.equal(inactive.meta.pagination.total_pages, 1);

  const empty = await service.listPartners({
    page: 1,
    per_page: 20,
    search: "NO-MATCH",
  });
  assert.deepEqual(empty.data, []);
  assert.equal(empty.meta.pagination.total_pages, 0);
});

test("SLA mock validates FKs and keeps unique keys across inactive records", async () => {
  const { service } = createOpsConfigHarness();
  const existing = service.snapshot().sla_deadlines[0];
  await service.updateSlaDeadline(existing.id, {
    ...validSla,
    service_type_id: existing.service_type_id,
    route_scope: existing.route_scope,
    is_active: 0,
  });
  await assertApiError(
    service.createSlaDeadline({
      ...validSla,
      service_type_id: 1,
      route_scope: existing.route_scope,
    }),
    "422_VALIDATION_ERROR",
    "route_scope",
  );
  await assertApiError(
    service.createSlaDeadline({ ...validSla, service_type_id: 99 }),
    "422_VALIDATION_ERROR",
    "service_type_id",
  );

  const sameRecordUpdate = await service.updateSlaDeadline(existing.id, {
    ...validSla,
    service_type_id: existing.service_type_id,
    route_scope: existing.route_scope,
  });
  assert.equal(sameRecordUpdate.data.id, existing.id);
});

test("routing uniqueness ignores transport and inactive status; foreign keys are checked", async () => {
  const { service } = createOpsConfigHarness();
  const existing = service.snapshot().routing_rules[0];
  await service.updateRoutingRule(existing.id, {
    origin_warehouse_id: existing.origin_warehouse_id,
    destination_branch_id: existing.destination_branch_id,
    next_hop_warehouse_id: existing.next_hop_warehouse_id,
    transport_mode: existing.transport_mode,
    estimated_transit_hours: existing.estimated_transit_hours,
    is_active: 0,
  });
  await assertApiError(
    service.createRoutingRule({
      ...validRouting,
      origin_warehouse_id: existing.origin_warehouse_id,
      destination_branch_id: existing.destination_branch_id,
      transport_mode: "motorbike",
    }),
    "422_VALIDATION_ERROR",
    "destination_branch_id",
  );
  await assertApiError(
    service.createRoutingRule({ ...validRouting, origin_warehouse_id: 99 }),
    "422_VALIDATION_ERROR",
    "origin_warehouse_id",
  );

  const updated = await service.updateRoutingRule(existing.id, {
    ...validRouting,
    origin_warehouse_id: existing.origin_warehouse_id,
    destination_branch_id: existing.destination_branch_id,
    next_hop_warehouse_id: existing.next_hop_warehouse_id,
  });
  assert.equal(updated.data.id, existing.id);
});

test("partner CRUD enforces unique codes and refreshes vehicle lookup data", async () => {
  const { service } = createOpsConfigHarness();
  const created = await service.createPartner(validPartner("MOCK-3PL-03"));
  assert.equal(created.data.name, "Đối tác tổng hợp");
  assert.ok(service.getPartnerLookups().some((item) => item.id === created.data.id));

  await assertApiError(
    service.createPartner(validPartner("mock-3pl-03")),
    "422_VALIDATION_ERROR",
    "code",
  );

  const updated = await service.updatePartner(created.data.id, {
    ...validPartner("MOCK-3PL-03"),
    name: "Đối tác đã cập nhật",
    is_active: 0,
  });
  assert.equal(updated.data.name, "Đối tác đã cập nhật");
  assert.equal(
    service.getPartnerLookups().find((item) => item.id === created.data.id)
      .is_active,
    0,
  );
});

test("vehicle mock validates branch, partner, driver, plate uniqueness and nullable ownership", async () => {
  const { service } = createOpsConfigHarness();
  assert.equal(
    service.getPartnerLookups().find((item) => item.id === "3202").is_active,
    0,
  );
  const vehicle = await service.createVehicle(
    validVehicle("MOCK-VAN-03", {
      partner_id: "3201",
      default_driver_id: "7001",
    }),
  );
  assert.equal(String(vehicle.data.partner_id), "3201");
  assert.equal(String(vehicle.data.default_driver_id), "7001");
  assert.equal(vehicle.data.max_payload_kg, "1500.00");

  const companyVehicle = await service.createVehicle(
    validVehicle("MOCK-TRUCK-03"),
  );
  assert.equal(companyVehicle.data.partner_id, null);
  assert.equal(companyVehicle.data.default_driver_id, null);

  await assertApiError(
    service.createVehicle(validVehicle("MOCK-VAN-04", { branch_id: 999 })),
    "422_VALIDATION_ERROR",
    "branch_id",
  );
  await assertApiError(
    service.createVehicle(
      validVehicle("MOCK-VAN-06", { partner_id: "3202" }),
    ),
    "422_VALIDATION_ERROR",
    "partner_id",
  );
  await assertApiError(
    service.createVehicle(
      validVehicle("MOCK-VAN-05", { default_driver_id: "9999" }),
    ),
    "422_VALIDATION_ERROR",
    "default_driver_id",
  );
  await assertApiError(
    service.createVehicle(validVehicle("mock-van-03")),
    "422_VALIDATION_ERROR",
    "plate_number",
  );

  const updated = await service.updateVehicle(vehicle.data.id, {
    ...validVehicle("MOCK-VAN-03"),
    branch_id: vehicle.data.branch_id,
    status: "maintenance",
  });
  assert.equal(updated.data.status, "maintenance");
  assert.equal(updated.data.partner_id, null);
});

test("mock list request cancellation rejects with AbortError", async () => {
  const { service } = createOpsConfigHarness();
  const controller = new AbortController();
  const request = service.listPartners({ signal: controller.signal });
  controller.abort();
  await assert.rejects(request, (error) => error.name === "AbortError");
});
