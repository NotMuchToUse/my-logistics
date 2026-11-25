import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatShipmentAmount,
  formatShipmentCreatedAt,
  getShipmentStatusPresentation,
} from "../utils/shipment-list-display.ts";

test("currency formatting preserves zero and avoids undefined or NaN output", () => {
  assert.match(formatShipmentAmount(0), /0/);
  assert.match(formatShipmentAmount("0"), /0/);
  assert.equal(formatShipmentAmount(null), "—");
  assert.equal(formatShipmentAmount("not-money"), "—");
  assert.equal(formatShipmentAmount(Number.NaN), "—");
});

test("created date formatting safely handles invalid and missing values", () => {
  assert.equal(formatShipmentCreatedAt(undefined), "—");
  assert.equal(formatShipmentCreatedAt("not-a-date"), "—");
  assert.match(formatShipmentCreatedAt("2026-11-24T10:00:00+07:00"), /24\/11\/2026/);
});

test("shipment status presentation uses confirmed labels and a neutral fallback", () => {
  assert.equal(
    getShipmentStatusPresentation("delivered").label,
    "Giao thành công",
  );
  assert.equal(getShipmentStatusPresentation("future_status").status, null);
  assert.equal(
    getShipmentStatusPresentation("future_status").label,
    "Không xác định",
  );
});
