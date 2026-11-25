import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getShipmentImportColumnKey,
  shipmentBulkImportRowSchema,
} from "../schemas/shipment-bulk-import.schema.ts";

const validRow = {
  sender_name: "Nguyen Van A",
  sender_phone: "0912345678",
  sender_address: "1 Duong A",
  sender_province_id: "1",
  sender_district_id: "2",
  sender_ward_id: "3",
  recipient_name: "Tran Thi B",
  recipient_phone: "0987654321",
  recipient_address: "2 Duong B",
  recipient_province_id: "4",
  recipient_district_id: "5",
  recipient_ward_id: "6",
  destination_branch_id: "7",
  service_type_id: "1",
  cargo_category_id: "1",
  payment_method: "ngttn",
  cod_amount: "0",
  declared_value: "0",
  creation_mode: "driver_pickup",
  parcels_json:
    '[{"actual_weight_gram":1000,"length_cm":"20","width_cm":"15","height_cm":"10","description":""}]',
  vas_ids: "2,3",
  surcharge_ids: "",
};

test("shipment import parses parcel JSON and comma-separated IDs into API fields", () => {
  const parsed = shipmentBulkImportRowSchema.safeParse(validRow);

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual(parsed.data.vas_ids, [2, 3]);
  assert.deepEqual(parsed.data.surcharge_ids, []);
  assert.equal(parsed.data.parcels[0].actual_weight_gram, 1000);
  assert.equal("parcels_json" in parsed.data, false);
});

test("shipment import validation reports invalid cell paths", () => {
  const parsed = shipmentBulkImportRowSchema.safeParse({
    ...validRow,
    sender_phone: "123",
    parcels_json:
      '[{"actual_weight_gram":1000,"length_cm":"0","width_cm":"15","height_cm":"10","description":""}]',
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;
  const fields = parsed.error.issues.map((issue) =>
    issue.path.map(String).join("."),
  );
  assert.equal(fields.includes("sender_phone"), true);
  assert.equal(
    fields.some((field) => getShipmentImportColumnKey(field) === "parcels_json"),
    true,
  );
});
