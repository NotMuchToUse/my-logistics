import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9_]{2,50}$/, "Mã phải gồm 2–50 ký tự IN HOA, số và dấu gạch dưới.");

const activeSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((value) => value === true || value === 1);

export const serviceTypeSchema = z
  .object({
    code: codeSchema,
    name: z.string().trim().min(1, "Tên dịch vụ là bắt buộc.").max(150),
    description: z.string().trim().max(500).optional().nullable(),
    estimated_days_min: z.coerce.number().int().min(0),
    estimated_days_max: z.coerce.number().int().min(0),
    is_active: activeSchema,
  })
  .refine((value) => value.estimated_days_max >= value.estimated_days_min, {
    path: ["estimated_days_max"],
    message: "Số ngày tối đa không được nhỏ hơn số ngày tối thiểu.",
  });

export const valueAddedServiceSchema = z
  .object({
    code: codeSchema,
    name: z.string().trim().min(1, "Tên dịch vụ là bắt buộc.").max(150),
    fee_type: z.enum(["fixed", "percentage"]),
    fee_value: z.coerce.number().nonnegative(),
    min_fee: z.coerce.number().nonnegative(),
    max_fee: z.coerce.number().nonnegative(),
    is_active: activeSchema,
  })
  .refine((value) => value.max_fee >= value.min_fee, {
    path: ["max_fee"],
    message: "Mức phí tối đa không được nhỏ hơn mức phí tối thiểu.",
  })
  .refine((value) => value.fee_type !== "percentage" || value.fee_value <= 100, {
    path: ["fee_value"],
    message: "Tỷ lệ phần trăm không được vượt quá 100.",
  });

export const surchargeSchema = z
  .object({
    code: codeSchema,
    name: z.string().trim().min(1, "Tên phụ phí là bắt buộc.").max(150),
    fee_type: z.enum(["fixed", "percentage"]),
    fee_value: z.coerce.number().nonnegative(),
    is_auto_applied: activeSchema,
    is_active: activeSchema,
  })
  .refine((value) => value.fee_type !== "percentage" || value.fee_value <= 100, {
    path: ["fee_value"],
    message: "Tỷ lệ phần trăm không được vượt quá 100.",
  });

export const pricingTariffSchema = z
  .object({
    service_type_id: z.coerce.number().int().positive(),
    zone_type: z.enum(["intra_province", "inter_region_near", "inter_region_far"]),
    min_weight_gram: z.coerce.number().int().nonnegative(),
    max_weight_gram: z.coerce.number().int().positive(),
    base_price: z.coerce.number().nonnegative(),
    step_weight_gram: z.coerce.number().int().positive(),
    step_price: z.coerce.number().nonnegative(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD."),
    effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    is_active: activeSchema,
  })
  .refine((value) => value.max_weight_gram >= value.min_weight_gram, {
    path: ["max_weight_gram"],
    message: "Trọng lượng tối đa không được nhỏ hơn trọng lượng tối thiểu.",
  })
  .refine((value) => !value.effective_to || value.effective_to >= value.effective_from, {
    path: ["effective_to"],
    message: "Ngày kết thúc không được trước ngày bắt đầu.",
  });

export const weightConversionRuleSchema = z
  .object({
    service_type_id: z.coerce.number().int().positive(),
    divisor: z.coerce.number().int().positive(),
    min_chargeable_gram: z.coerce.number().int().positive(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD."),
    effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    is_active: activeSchema,
  })
  .refine((value) => !value.effective_to || value.effective_to >= value.effective_from, {
    path: ["effective_to"],
    message: "Ngày kết thúc không được trước ngày bắt đầu.",
  });
