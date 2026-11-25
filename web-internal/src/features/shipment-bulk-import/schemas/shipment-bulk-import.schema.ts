import { z } from "zod";
import {
  SHIPMENT_IMPORT_COLUMN_KEYS,
  type ShipmentImportColumnKey,
} from "../constants/shipment-bulk-import.constants.ts";

const cellText = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).trim();

const requiredText = (maxLength: number) =>
  z.preprocess(
    cellText,
    z.string().min(1, "Trường này là bắt buộc.").max(maxLength),
  );

const positiveId = z.coerce
  .number()
  .int("Giá trị phải là số nguyên dương.")
  .positive("Giá trị phải là số nguyên dương.")
  .max(Number.MAX_SAFE_INTEGER);

const moneyAmount = z.preprocess(
  cellText,
  z
    .string()
    .regex(
      /^\d{1,13}(?:\.\d{1,2})?$/,
      "Nhập số không âm, tối đa 13 chữ số nguyên và 2 chữ số thập phân.",
    ),
);

const dimension = z.preprocess(
  cellText,
  z
    .string()
    .regex(
      /^\d{1,6}(?:\.\d{1,2})?$/,
      "Kích thước phải là số dương, tối đa 2 chữ số thập phân.",
    )
    .refine((value) => Number(value) > 0, "Kích thước phải lớn hơn 0."),
);

const parcelSchema = z.object({
  actual_weight_gram: z.coerce
    .number()
    .int("Trọng lượng phải là số nguyên dương (gram).")
    .positive("Trọng lượng phải là số nguyên dương (gram).")
    .max(4294967295),
  length_cm: dimension,
  width_cm: dimension,
  height_cm: dimension,
  description: z.preprocess(
    (value) => {
      const text = cellText(value);
      return text === "" ? null : text;
    },
    z.string().max(255).nullable(),
  ),
});

const parcelsFromJson = z
  .string()
  .min(1, "Cần nhập mảng kiện hàng dưới dạng JSON.")
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message: "JSON kiện hàng không hợp lệ.",
      });
      return z.NEVER;
    }
  })
  .pipe(z.array(parcelSchema).min(1, "Cần có ít nhất một kiện hàng."));

const idList = z.preprocess(
  (value) =>
    cellText(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map(Number),
  z.array(positiveId).refine((ids) => new Set(ids).size === ids.length, {
    message: "Danh sách mã không được trùng.",
  }),
);

const phone = z.preprocess(
  cellText,
  z.string().refine((value) => {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
    return /^0[0-9]{9,10}$/.test(digits);
  }, "Số điện thoại Việt Nam không hợp lệ."),
);

const shipmentImportInputSchema = z.object({
  sender_name: requiredText(150),
  sender_phone: phone,
  sender_address: requiredText(255),
  sender_province_id: positiveId,
  sender_district_id: positiveId,
  sender_ward_id: positiveId,
  recipient_name: requiredText(150),
  recipient_phone: phone,
  recipient_address: requiredText(255),
  recipient_province_id: positiveId,
  recipient_district_id: positiveId,
  recipient_ward_id: positiveId,
  destination_branch_id: positiveId,
  service_type_id: positiveId,
  cargo_category_id: positiveId,
  payment_method: z.enum(["ngttn", "ngtts", "nntn"]),
  cod_amount: moneyAmount,
  declared_value: moneyAmount,
  creation_mode: z.enum(["counter_dropoff", "driver_pickup"]),
  parcels_json: parcelsFromJson,
  vas_ids: idList,
  surcharge_ids: idList,
});

export const shipmentBulkImportRowSchema = shipmentImportInputSchema.transform(
  ({ parcels_json, ...shipment }) => ({
    ...shipment,
    parcels: parcels_json,
  }),
);

export type ShipmentBulkImportInput = z.output<
  typeof shipmentBulkImportRowSchema
>;

export interface ShipmentImportCellError {
  field: string;
  columnKey: ShipmentImportColumnKey | null;
  message: string;
}

export interface ShipmentImportPreviewRow {
  rowNumber: number;
  cells: Record<ShipmentImportColumnKey, string>;
  payload: ShipmentBulkImportInput | null;
  clientErrors: ShipmentImportCellError[];
  apiErrors: ShipmentImportCellError[];
  apiStatus?: "created" | "failed";
  publicId?: string;
}

export function getShipmentImportColumnKey(
  field: string,
): ShipmentImportColumnKey | null {
  const normalized = field.replace(/\[(\d+)\]/g, ".$1").split(".")[0];
  if (normalized === "parcels") return "parcels_json";
  return SHIPMENT_IMPORT_COLUMN_KEYS.find((key) => key === normalized) ?? null;
}
