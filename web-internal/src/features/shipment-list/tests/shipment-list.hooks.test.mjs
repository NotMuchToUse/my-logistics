import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildShipmentListQuery,
  canCancelShipmentStatus,
  createDefaultShipmentFilters,
  DEFAULT_SHIPMENT_SORTING,
  getPageWithinResponse,
  hasShipmentPermission,
  isMutationOutcomeUncertain,
  isShipmentRequestAborted,
  reconcilePageSelection,
  shouldRefetchAfterMutationError,
  toggleCurrentPageSelection,
  toggleVisibleShipmentSelection,
} from "../hooks/shipment-list.hook-logic.ts";

test("list query defaults to first page, page size 20, and confirmed sorting", () => {
  const query = buildShipmentListQuery(
    createDefaultShipmentFilters(),
    1,
    20,
    DEFAULT_SHIPMENT_SORTING,
    true,
  );
  assert.deepEqual(query, {
    page: 1,
    per_page: 20,
    sort_by: "created_at",
    sort_direction: "DESC",
  });
});

test("list query maps applied filters, preserves priority zero, and omits blanks", () => {
  const filters = {
    ...createDefaultShipmentFilters(),
    tracking_code: " VS26112300001 ",
    phone: "0000000000",
    origin_branch_id: "3",
    destination_branch_id: "4",
    service_type_id: "2",
    status: "draft",
    from_date: "2026-11-01",
    to_date: "2026-11-23",
    is_priority: "0",
  };
  const query = buildShipmentListQuery(filters, 1, 50, {
    sortBy: "cod_amount",
    sortDirection: "ASC",
  }, true);

  assert.deepEqual(query, {
    page: 1,
    per_page: 50,
    sort_by: "cod_amount",
    sort_direction: "ASC",
    tracking_code: "VS26112300001",
    phone: "0000000000",
    status: "draft",
    service_type_id: 2,
    is_priority: false,
    from_date: "2026-11-01",
    to_date: "2026-11-23",
    origin_branch_id: 3,
    destination_branch_id: 4,
  });
});

test("invalid dates, phone, pagination, and API-only branch filters fail before requests", () => {
  const empty = createDefaultShipmentFilters();
  assert.throws(() =>
    buildShipmentListQuery(
      { ...empty, from_date: "2026-11-24", to_date: "2026-11-01" },
      1,
      20,
      DEFAULT_SHIPMENT_SORTING,
      true,
    ),
  );
  assert.throws(() =>
    buildShipmentListQuery(
      { ...empty, phone: "090***0101" },
      1,
      20,
      DEFAULT_SHIPMENT_SORTING,
      true,
    ),
  );
  assert.throws(() =>
    buildShipmentListQuery(
      { ...empty, origin_branch_id: "3" },
      1,
      20,
      DEFAULT_SHIPMENT_SORTING,
      false,
    ),
  );
  assert.throws(() =>
    buildShipmentListQuery(empty, 1, 101, DEFAULT_SHIPMENT_SORTING, true),
  );
});

test("pagination is clamped to available pages, including an empty result", () => {
  assert.equal(getPageWithinResponse(4, 2), 2);
  assert.equal(getPageWithinResponse(1, 0), 1);
  assert.equal(getPageWithinResponse(1, 5), 1);
});

test("selection is keyed by public_id, page-scoped, and pruned after rows change", () => {
  const rows = [
    { public_id: "shipment-a" },
    { public_id: "shipment-b" },
  ];
  const selected = toggleCurrentPageSelection(new Set(), rows, true);
  assert.deepEqual([...selected].sort(), ["shipment-a", "shipment-b"]);

  const toggled = toggleVisibleShipmentSelection(
    selected,
    "shipment-a",
    rows,
    false,
  );
  assert.deepEqual([...toggled], ["shipment-b"]);

  const reconciled = reconcilePageSelection(toggled, [
    { public_id: "shipment-a" },
  ]);
  assert.deepEqual([...reconciled], []);
  assert.deepEqual(
    [...toggleVisibleShipmentSelection(selected, "not-visible", rows)],
    ["shipment-a", "shipment-b"],
  );
});

test("cancellation status rules and permission checks use confirmed codes only", () => {
  assert.equal(canCancelShipmentStatus("draft"), true);
  assert.equal(canCancelShipmentStatus("pending_pickup"), true);
  for (const status of [
    "picked_up",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "pending_return",
    "returning",
    "returned",
    "incident",
    "cancelled",
  ]) {
    assert.equal(canCancelShipmentStatus(status), false);
  }

  assert.equal(hasShipmentPermission([], "read"), false);
  assert.equal(
    hasShipmentPermission(["shipment.priority"], "priority"),
    true,
  );
  assert.equal(
    hasShipmentPermission(["shipment.read"], "cancel"),
    false,
  );
});

test("mutation error classification refetches conflicts and uncertain outcomes without retry", () => {
  const conflict = {
    success: false,
    error: { code: "409_VERSION_CONFLICT", message: "Conflict" },
  };
  const unavailable = {
    success: false,
    error: { code: "500_INTERNAL_ERROR", message: "Unavailable" },
  };
  const invalid = {
    success: false,
    error: { code: "422_VALIDATION_ERROR", message: "Invalid" },
  };

  assert.equal(shouldRefetchAfterMutationError(conflict), true);
  assert.equal(shouldRefetchAfterMutationError(unavailable), true);
  assert.equal(isMutationOutcomeUncertain(unavailable), true);
  assert.equal(shouldRefetchAfterMutationError(invalid), false);
  assert.equal(isMutationOutcomeUncertain(invalid), false);
  assert.equal(isShipmentRequestAborted({ name: "AbortError" }), true);
  assert.equal(isShipmentRequestAborted({ code: "ERR_CANCELED" }), true);
});
