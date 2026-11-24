import { z } from "zod";
import { MAX_UINT64, PRINT_DOCUMENT_TYPES, TRACKING_RANGE_STATUSES } from "../constants/waybillPrint.constants.ts";

// Domain/UI values only. The HTTP serialization and writable fields await contract approval.
export const unsignedBigIntStringSchema = z.string()
  .regex(/^\d+$/, "Nhập số nguyên không âm, không dùng dấu thập phân hoặc số mũ.")
  .refine((value) => /^\d+$/.test(value) && BigInt(value) <= MAX_UINT64, "Giá trị vượt giới hạn BIGINT UNSIGNED.");

export const positiveIdStringSchema = unsignedBigIntStringSchema.refine(
  (value) => /^\d+$/.test(value) && BigInt(value) > 0n,
  "Định danh phải lớn hơn 0.",
);
export const printDocumentTypeSchema = z.enum(PRINT_DOCUMENT_TYPES);
export const trackingRangeStatusSchema = z.enum(TRACKING_RANGE_STATUSES);

const rangeFields = {
  prefix: z.string().min(1, "Nhập tiền tố.").max(15, "Tiền tố tối đa 15 ký tự.")
    .refine((value) => value.trim().length > 0, "Tiền tố không được chỉ chứa khoảng trắng."),
  start_number: unsignedBigIntStringSchema,
  end_number: unsignedBigIntStringSchema,
};

export const trackingRangeInputSchema = z.object({
  ...rangeFields,
  branch_id: positiveIdStringSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (/^\d+$/.test(value.start_number) && /^\d+$/.test(value.end_number)
      && BigInt(value.start_number) > BigInt(value.end_number)) {
    context.addIssue({ code: "custom", path: ["end_number"], message: "Số kết thúc phải lớn hơn hoặc bằng số bắt đầu." });
  }
});

export const trackingRangeRecordSchema = z.object({
  ...rangeFields,
  id: positiveIdStringSchema,
  branch_id: positiveIdStringSchema.nullable(),
  current_number: unsignedBigIntStringSchema,
  status: trackingRangeStatusSchema,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict().superRefine((value, context) => {
  const numeric = [value.start_number, value.end_number, value.current_number].every((part) => /^\d+$/.test(part));
  if (!numeric) return;
  if (BigInt(value.start_number) > BigInt(value.end_number)) {
    context.addIssue({ code: "custom", path: ["end_number"], message: "Khoảng số không hợp lệ." });
  }
  if (BigInt(value.current_number) > BigInt(value.end_number)) {
    context.addIssue({ code: "custom", path: ["current_number"], message: "Số đã cấp vượt số kết thúc." });
  }
});
