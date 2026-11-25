import { z } from "zod";
import { INT_UNSIGNED_MAX } from "../constants/ops-config.constants.ts";

const databaseIdStringSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Vui lòng chọn một bản ghi hợp lệ.")
  .refine(
    (value) => BigInt(value) <= 18_446_744_073_709_551_615n,
    "Mã bản ghi vượt giới hạn BIGINT UNSIGNED.",
  )
  .transform((value) => {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : value;
  });

const databaseIdInputSchema = z.union([
  z.number().int().positive().safe(),
  databaseIdStringSchema,
]);

const optionalDatabaseIdInputSchema = z
  .union([z.literal(""), z.null(), databaseIdInputSchema])
  .transform((value) => (value === "" ? null : value));

const unsignedPositiveIntInputSchema = z.union([
  z.number().int().positive().max(INT_UNSIGNED_MAX),
  z
    .string()
    .trim()
    .regex(/^\d+$/, "Giá trị phải là số nguyên dương.")
    .refine((value) => {
      const normalized = value.replace(/^0+(?=\d)/, "");
      const numeric = Number(normalized);
      return (
        Number.isSafeInteger(numeric) &&
        numeric > 0 &&
        numeric <= INT_UNSIGNED_MAX
      );
    }, "Giá trị phải nằm trong giới hạn INT UNSIGNED và lớn hơn 0.")
    .transform((value) => Number(value)),
]);

const activeInputSchema = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => (value === true || value === 1 ? 1 : 0));

const optionalTextSchema = (max: number, label: string) =>
  z.union([
    z
      .string()
      .trim()
      .max(max, `${label} không được vượt quá ${max} ký tự.`)
      .transform((value) => (value === "" ? null : value)),
    z.null(),
  ]);

const optionalUrlSchema = z.union([
  z
    .string()
    .trim()
    .max(255, "API endpoint không được vượt quá 255 ký tự.")
    .refine((value) => {
      if (value === "") return true;
      try {
        const parsed = new URL(value);
        return (
          (parsed.protocol === "http:" || parsed.protocol === "https:") &&
          parsed.username === "" &&
          parsed.password === ""
        );
      } catch {
        return false;
      }
    }, "API endpoint phải là URL HTTP hoặc HTTPS hợp lệ.")
    .transform((value) => (value === "" ? null : value)),
  z.null(),
]);

const decimal102InputSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/,
    "Tải trọng phải là số dương, tối đa 2 chữ số thập phân và không vượt DECIMAL(10,2).",
  )
  .refine((value) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")) > 0n;
  }, "Tải trọng phải lớn hơn 0.")
  .transform((value) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return `${whole}.${fraction.padEnd(2, "0")}`;
  });

const baseFormShape = {
  is_active: activeInputSchema,
};

export const slaDeadlineSchema = z
  .object({
    service_type_id: databaseIdInputSchema,
    route_scope: z.enum([
      "intra_province",
      "intra_region",
      "inter_region",
      "remote_area",
    ]),
    pickup_sla_minutes: unsignedPositiveIntInputSchema,
    warehouse_inbound_sla_minutes: unsignedPositiveIntInputSchema,
    linehaul_sla_hours: unsignedPositiveIntInputSchema,
    delivery_sla_hours: unsignedPositiveIntInputSchema,
    max_storage_days_before_return: unsignedPositiveIntInputSchema,
    ...baseFormShape,
  })
  .strict();

export const branchRoutingRuleSchema = z
  .object({
    origin_warehouse_id: databaseIdInputSchema,
    destination_branch_id: databaseIdInputSchema,
    next_hop_warehouse_id: databaseIdInputSchema,
    transport_mode: z.enum(["motorbike", "truck", "air_cargo"]),
    estimated_transit_hours: unsignedPositiveIntInputSchema,
    ...baseFormShape,
  })
  .strict()
  .refine(
    (value) => String(value.origin_warehouse_id) !== String(value.next_hop_warehouse_id),
    {
      path: ["next_hop_warehouse_id"],
      message: "Kho xuất phát và kho kế tiếp không được trùng nhau.",
    },
  );

export const thirdPartyPartnerSchema = z
  .object({
    code: z.string().trim().min(1, "Mã đối tác là bắt buộc.").max(30),
    name: z.string().trim().min(1, "Tên đối tác là bắt buộc.").max(150),
    partner_type: z.enum([
      "linehaul_carrier",
      "airline_agent",
      "lastmile_3pl",
    ]),
    contact_person: optionalTextSchema(100, "Người liên hệ"),
    contact_phone: optionalTextSchema(20, "Số điện thoại"),
    api_endpoint: optionalUrlSchema,
    ...baseFormShape,
  })
  .strict();

export const vehicleSchema = z
  .object({
    branch_id: databaseIdInputSchema,
    partner_id: optionalDatabaseIdInputSchema,
    plate_number: z
      .string()
      .trim()
      .min(1, "Biển số hoặc mã hiệu là bắt buộc.")
      .max(25),
    vehicle_type: z.enum([
      "motorbike",
      "van",
      "truck_light",
      "truck_heavy",
      "air_flight",
    ]),
    max_payload_kg: decimal102InputSchema,
    default_driver_id: optionalDatabaseIdInputSchema,
    status: z.enum(["available", "in_transit", "maintenance", "retired"]),
  })
  .strict();

export type SlaDeadlineFormInput = z.input<typeof slaDeadlineSchema>;
export type SlaDeadlineFormOutput = z.output<typeof slaDeadlineSchema>;
export type BranchRoutingRuleFormInput = z.input<
  typeof branchRoutingRuleSchema
>;
export type BranchRoutingRuleFormOutput = z.output<
  typeof branchRoutingRuleSchema
>;
export type ThirdPartyPartnerFormInput = z.input<
  typeof thirdPartyPartnerSchema
>;
export type ThirdPartyPartnerFormOutput = z.output<
  typeof thirdPartyPartnerSchema
>;
export type VehicleFormInput = z.input<typeof vehicleSchema>;
export type VehicleFormOutput = z.output<typeof vehicleSchema>;
