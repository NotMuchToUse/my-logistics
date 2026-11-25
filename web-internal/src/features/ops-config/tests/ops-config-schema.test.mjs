import { test } from "node:test";
import assert from "node:assert/strict";
import {
  branchRoutingRuleSchema,
  slaDeadlineSchema,
  thirdPartyPartnerSchema,
  vehicleSchema,
} from "../schemas/ops-config.schema.ts";

const validSla = {
  service_type_id: "1",
  route_scope: "intra_province",
  pickup_sla_minutes: "180",
  warehouse_inbound_sla_minutes: "240",
  linehaul_sla_hours: "24",
  delivery_sla_hours: "36",
  max_storage_days_before_return: "5",
  is_active: true,
};

const validRouting = {
  origin_warehouse_id: "1",
  destination_branch_id: "3",
  next_hop_warehouse_id: "2",
  transport_mode: "truck",
  estimated_transit_hours: "12",
  is_active: true,
};

const validPartner = {
  code: "  MOCK-3PL-02 ",
  name: "  Đối tác mẫu  ",
  partner_type: "lastmile_3pl",
  contact_person: "",
  contact_phone: "ABC",
  api_endpoint: "",
  is_active: true,
};

const validVehicle = {
  branch_id: "3",
  partner_id: "",
  plate_number: " MOCK-VAN-02 ",
  vehicle_type: "van",
  max_payload_kg: "1500",
  default_driver_id: "",
  status: "available",
};

test("SLA schema normalizes values and rejects invalid ENUM, empty, fractional and overflow", () => {
  const parsed = slaDeadlineSchema.safeParse(validSla);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.service_type_id, 1);
    assert.equal(parsed.data.pickup_sla_minutes, 180);
    assert.equal(parsed.data.is_active, 1);
  }

  assert.equal(
    slaDeadlineSchema.safeParse({ ...validSla, route_scope: "nearby" }).success,
    false,
  );
  assert.equal(
    slaDeadlineSchema.safeParse({ ...validSla, pickup_sla_minutes: "" }).success,
    false,
  );
  assert.equal(
    slaDeadlineSchema.safeParse({ ...validSla, pickup_sla_minutes: "1.5" }).success,
    false,
  );
  assert.equal(
    slaDeadlineSchema.safeParse({
      ...validSla,
      pickup_sla_minutes: "4294967296",
    }).success,
    false,
  );
});

test("BIGINT IDs preserve large values without unsafe Number conversion", () => {
  const parsed = slaDeadlineSchema.safeParse({
    ...validSla,
    service_type_id: "9007199254740993",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.service_type_id, "9007199254740993");

  assert.equal(
    slaDeadlineSchema.safeParse({
      ...validSla,
      service_type_id: "18446744073709551616",
    }).success,
    false,
  );
});

test("routing schema validates FK inputs, enum and self-loop guard", () => {
  assert.equal(branchRoutingRuleSchema.safeParse(validRouting).success, true);
  assert.equal(
    branchRoutingRuleSchema.safeParse({
      ...validRouting,
      next_hop_warehouse_id: "1",
    }).success,
    false,
  );
  assert.equal(
    branchRoutingRuleSchema.safeParse({
      ...validRouting,
      transport_mode: "rail",
    }).success,
    false,
  );
});

test("partner schema trims fields, normalizes blanks and only allows HTTP(S) endpoint URLs", () => {
  const parsed = thirdPartyPartnerSchema.safeParse(validPartner);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.code, "MOCK-3PL-02");
    assert.equal(parsed.data.name, "Đối tác mẫu");
    assert.equal(parsed.data.contact_person, null);
    assert.equal(parsed.data.api_endpoint, null);
    assert.equal(parsed.data.is_active, 1);
  }

  assert.equal(
    thirdPartyPartnerSchema.safeParse({
      ...validPartner,
      api_endpoint: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    thirdPartyPartnerSchema.safeParse({
      ...validPartner,
      api_endpoint: "https://user:password@example.test/api",
    }).success,
    false,
  );
  assert.equal(
    thirdPartyPartnerSchema.safeParse({
      ...validPartner,
      code: "x".repeat(31),
    }).success,
    false,
  );
});

test("vehicle schema preserves DECIMAL precision and null FK values", () => {
  const parsed = vehicleSchema.safeParse(validVehicle);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.max_payload_kg, "1500.00");
    assert.equal(parsed.data.partner_id, null);
    assert.equal(parsed.data.default_driver_id, null);
    assert.equal(parsed.data.plate_number, "MOCK-VAN-02");
  }

  for (const invalid of ["0", "0.00", "-1", "1.234", "100000000.00"]) {
    assert.equal(
      vehicleSchema.safeParse({
        ...validVehicle,
        max_payload_kg: invalid,
      }).success,
      false,
      `expected ${invalid} to be rejected`,
    );
  }

  assert.equal(
    vehicleSchema.safeParse({
      ...validVehicle,
      status: "deleted",
    }).success,
    false,
  );
  assert.equal(
    vehicleSchema.safeParse({
      ...validVehicle,
      created_by: 1,
    }).success,
    false,
  );
});
