import { z } from "zod";
import {
  MAX_SHIPMENT_PAGE_SIZE,
  SHIPMENT_SORT_FIELDS,
  SHIPMENT_STATUSES,
  SORT_DIRECTIONS,
} from "../constants/shipment-list.constants.ts";

const isValidCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const dateFilterSchema = z.string().refine(
  (value) => value === "" || isValidCalendarDate(value),
  "Ngày phải hợp lệ và theo định dạng YYYY-MM-DD.",
);

const positiveIdFilterSchema = z.string().refine(
  (value) =>
    value === "" ||
    (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))),
  "Giá trị phải là số nguyên dương.",
);

const phoneFilterSchema = z.string().trim().max(20).refine((value) => {
  if (value === "") return true;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
  return /^0\d{9,10}$/.test(digits);
}, "Số điện thoại Việt Nam không hợp lệ.");

export const shipmentFilterSchema = z
  .object({
    tracking_code: z.string().trim().max(35, "Mã vận đơn tối đa 35 ký tự."),
    phone: phoneFilterSchema,
    origin_branch_id: positiveIdFilterSchema,
    destination_branch_id: positiveIdFilterSchema,
    service_type_id: positiveIdFilterSchema,
    status: z.enum(SHIPMENT_STATUSES).or(z.literal("")),
    from_date: dateFilterSchema,
    to_date: dateFilterSchema,
    is_priority: z.enum(["all", "1", "0"]),
  })
  .superRefine((filters, context) => {
    if (
      filters.from_date !== "" &&
      filters.to_date !== "" &&
      filters.from_date > filters.to_date
    ) {
      context.addIssue({
        code: "custom",
        path: ["to_date"],
        message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.",
      });
    }
  });

export const shipmentListQuerySchema = z
  .object({
    page: z.number().int().positive(),
    per_page: z.number().int().positive().max(MAX_SHIPMENT_PAGE_SIZE),
    tracking_code: z.string().trim().max(35).optional(),
    phone: phoneFilterSchema.optional(),
    status: z.enum(SHIPMENT_STATUSES).optional(),
    service_type_id: z.number().int().positive().optional(),
    is_priority: z.boolean().optional(),
    from_date: z.string().refine(isValidCalendarDate).optional(),
    to_date: z.string().refine(isValidCalendarDate).optional(),
    sort_by: z.enum(SHIPMENT_SORT_FIELDS),
    sort_direction: z.enum(SORT_DIRECTIONS),
  })
  .superRefine((query, context) => {
    if (
      query.from_date !== undefined &&
      query.to_date !== undefined &&
      query.from_date > query.to_date
    ) {
      context.addIssue({
        code: "custom",
        path: ["to_date"],
        message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.",
      });
    }
  });

export const shipmentPublicIdSchema = z
  .string()
  .regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/, "public_id phải là ULID hợp lệ.");

export const shipmentPriorityMutationSchema = z.object({
  is_priority: z.boolean(),
  version: z.number().int().positive(),
});

export const shipmentCancelMutationSchema = z.object({
  version: z.number().int().positive(),
  cancel_reason: z.string().trim().max(500).optional(),
});
