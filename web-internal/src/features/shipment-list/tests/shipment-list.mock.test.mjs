import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  CANCELLABLE_SHIPMENT_STATUSES,
  SHIPMENT_STATUSES,
} from "../constants/shipment-list.constants.ts";
import { shipmentPublicIdSchema } from "../schemas/shipment-list.schema.ts";

const fixture = JSON.parse(readFileSync(
  fileURLToPath(new URL("../../../mocks/shipment-list.mock.json", import.meta.url)),
  "utf8",
));

const shipmentRowSchema = z.object({
  public_id: shipmentPublicIdSchema,
  tracking_code: z.string().min(1).max(35),
  status: z.enum(SHIPMENT_STATUSES),
  sender_name: z.string().min(1),
  sender_phone_masked: z.string().min(1),
  recipient_name: z.string().min(1),
  recipient_phone_masked: z.string().min(1),
  origin_branch_name: z.string().min(1),
  destination_branch_name: z.string().min(1),
  service_type_name: z.string().min(1),
  assigned_driver_name: z.string().nullable(),
  parcel_count: z.number().int().positive(),
  chargeable_weight_gram: z.number().int().nonnegative(),
  total_freight_amount: z.union([
    z.number().finite().nonnegative(),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) >= 0),
  ]),
  cod_amount: z.union([
    z.number().finite().nonnegative(),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) >= 0),
  ]),
  is_priority: z.boolean(),
  version: z.number().int().positive(),
  created_at: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  origin_branch_id: z.number().int().positive(),
  destination_branch_id: z.number().int().positive(),
  service_type_id: z.number().int().positive(),
});

const successEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
  data: z.unknown(),
  meta: z.object({ timestamp: z.string().min(1) }),
});

const paginationEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
  data: z.array(shipmentRowSchema),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().positive(),
      per_page: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      total_pages: z.number().int().nonnegative(),
    }),
    timestamp: z.string().min(1),
  }),
});

const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.enum(["403_FORBIDDEN", "409_VERSION_CONFLICT", "422_VALIDATION_ERROR"]),
    message: z.string().min(1),
    details: z.record(z.string(), z.array(z.string())),
    trace_id: z.string().min(1),
  }),
});

test("shipment list mock JSON has valid success and pagination envelopes", () => {
  successEnvelopeSchema.parse(fixture);
  assert.equal(fixture.success, true);
  assert.ok(Number.isFinite(Date.parse(fixture.meta.timestamp)));
  assert.equal(fixture.data.mock_only.sensitive_fields_included, false);

  const singleResponse = fixture.data.success_response;
  successEnvelopeSchema.parse(singleResponse);
  shipmentRowSchema.parse(singleResponse.data);
  assert.ok(Number.isFinite(Date.parse(singleResponse.meta.timestamp)));

  const paginationResponse = fixture.data.pagination_response;
  paginationEnvelopeSchema.parse(paginationResponse);
  const pagination = paginationResponse.meta.pagination;
  assert.ok(Number.isInteger(pagination.page) && pagination.page > 0);
  assert.ok(Number.isInteger(pagination.per_page) && pagination.per_page > 0);
  assert.equal(paginationResponse.data.length, pagination.per_page);
  assert.equal(paginationResponse.data.length, pagination.total);
  assert.equal(pagination.total_pages, Math.ceil(pagination.total / pagination.per_page));
});

test("mock rows have unique valid ULIDs and cover statuses, priorities, and cancellation eligibility", () => {
  const rows = fixture.data.pagination_response.data;
  const ids = rows.map((row) => row.public_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(rows.map((row) => row.tracking_code)).size, rows.length);
  rows.forEach((row) => {
    assert.ok(SHIPMENT_STATUSES.includes(row.status));
    assert.ok(row.version > 0);
    const isoDate = row.created_at.replace(" ", "T");
    const parsedDate = Date.parse(`${isoDate}+07:00`);
    assert.ok(Number.isFinite(parsedDate));
    assert.equal(
      new Date(parsedDate + 7 * 60 * 60 * 1000).toISOString().slice(0, 19),
      isoDate,
    );
  });
  assert.deepEqual(
    [...new Set(rows.map((row) => row.status))].sort(),
    [...SHIPMENT_STATUSES].sort(),
  );
  assert.deepEqual(new Set(rows.map((row) => row.is_priority)), new Set([true, false]));
  assert.ok(rows.some((row) => CANCELLABLE_SHIPMENT_STATUSES.includes(row.status)));
  assert.ok(rows.some((row) => !CANCELLABLE_SHIPMENT_STATUSES.includes(row.status)));
  assert.ok(rows.some((row) => row.cod_amount === "0.00"));
  assert.ok(rows.some((row) => Number(row.cod_amount) > 0));
  assert.ok(rows.some((row) => row.total_freight_amount === "0.00"));
  assert.ok(rows.some((row) => Number(row.total_freight_amount) > 0));
  assert.ok(new Set(rows.map((row) => row.origin_branch_id)).size > 1);
  assert.ok(new Set(rows.map((row) => row.destination_branch_id)).size > 1);
  assert.ok(new Set(rows.map((row) => row.service_type_id)).size > 1);
  assert.ok(new Set(rows.map((row) => row.created_at.slice(0, 10))).size > 10);
  assert.ok(rows.some((row) => /[À-ỹ]/u.test(row.sender_name)));
  assert.ok(rows.some((row) => row.sender_name.startsWith("=")));
  assert.ok(rows.some((row) => row.sender_name.includes("\n")));

  const branchScopes = fixture.data.mock_only.branch_scope_fixtures;
  assert.equal(branchScopes.length, rows.length);
  assert.equal(
    new Set(branchScopes.map((scope) => scope.public_id)).size,
    rows.length,
  );
  assert.deepEqual(
    new Set(branchScopes.map((scope) => scope.branch_id)),
    new Set([3, 4]),
  );
});

test("mock error cases use the standard error envelope and expected codes", () => {
  const errors = Object.values(fixture.data.error_responses);
  errors.forEach((error) => errorEnvelopeSchema.parse(error));
  assert.deepEqual(
    new Set(errors.map((error) => error.error.code)),
    new Set(["403_FORBIDDEN", "409_VERSION_CONFLICT", "422_VALIDATION_ERROR"]),
  );
});

test("mock contains no private phone, hash, encrypted, or credential fields", () => {
  const serialized = JSON.stringify(fixture);
  for (const forbidden of ["phone_hash", "phone_encrypted", "access_token", "password"]) {
    assert.equal(serialized.includes(forbidden), false);
  }

  const searchPhones = fixture.data.mock_only.phone_search_fixtures.flatMap(
    ({ sender_phone, recipient_phone }) => [sender_phone, recipient_phone],
  );
  assert.ok(searchPhones.length > 0);
  searchPhones.forEach((phone) => assert.match(phone, /^000000000[0-5]$/));
});
