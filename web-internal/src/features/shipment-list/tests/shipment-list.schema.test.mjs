import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shipmentCancelMutationSchema,
  shipmentFilterSchema,
  shipmentListQuerySchema,
  shipmentPriorityMutationSchema,
  shipmentPublicIdSchema,
} from "../schemas/shipment-list.schema.ts";

const emptyFilters = {
  tracking_code: "",
  phone: "",
  origin_branch_id: "",
  destination_branch_id: "",
  service_type_id: "",
  status: "",
  from_date: "",
  to_date: "",
  is_priority: "all",
};

test("filter schema preserves zero-priority selection and validates supported filters", () => {
  const result = shipmentFilterSchema.safeParse({
    ...emptyFilters,
    tracking_code: " VS26112300001 ",
    phone: "+84 901 234 567",
    service_type_id: "2",
    status: "in_warehouse",
    from_date: "2026-11-01",
    to_date: "2026-11-30",
    is_priority: "0",
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.is_priority, "0");
});

test("filter schema rejects invalid phone, date, and reversed range", () => {
  assert.equal(shipmentFilterSchema.safeParse({ ...emptyFilters, phone: "09012" }).success, false);
  assert.equal(shipmentFilterSchema.safeParse({ ...emptyFilters, from_date: "2026-02-30" }).success, false);
  assert.equal(shipmentFilterSchema.safeParse({
    ...emptyFilters,
    from_date: "2026-11-20",
    to_date: "2026-11-19",
  }).success, false);
});

test("API query accepts only verified status, sort fields and bounded pagination", () => {
  const query = {
    page: 1,
    per_page: 100,
    is_priority: false,
    sort_by: "created_at",
    sort_direction: "DESC",
  };
  assert.equal(shipmentListQuerySchema.safeParse(query).success, true);
  assert.equal(shipmentListQuerySchema.safeParse({ ...query, per_page: 101 }).success, false);
  assert.equal(shipmentListQuerySchema.safeParse({ ...query, sort_by: "unknown" }).success, false);
  assert.equal(shipmentListQuerySchema.safeParse({ ...query, status: "incident_hold" }).success, false);
});

test("mutation schemas require a positive version and a valid public ULID", () => {
  assert.equal(shipmentPriorityMutationSchema.safeParse({ is_priority: false, version: 3 }).success, true);
  assert.equal(shipmentPriorityMutationSchema.safeParse({ is_priority: 1, version: 3 }).success, false);
  assert.equal(shipmentCancelMutationSchema.safeParse({ version: 1, cancel_reason: " Lý do " }).success, true);
  assert.equal(shipmentCancelMutationSchema.safeParse({ version: 0 }).success, false);
  assert.equal(shipmentPublicIdSchema.safeParse("01JDC9X8K2M4N6P8Q0R2S4T6V8").success, true);
  assert.equal(shipmentPublicIdSchema.safeParse("123").success, false);
});
