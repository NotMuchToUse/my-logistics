import { z } from "zod";
import { APPROVAL_REQUEST_TYPES } from "../types/branch-approvals.types";

const httpUrlSchema = z
  .string()
  .trim()
  .url("Vui lòng nhập URL hợp lệ.")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "URL chứng từ phải bắt đầu bằng http:// hoặc https://.");

const evidenceUrlsSchema = z
  .string()
  .transform((value) =>
    value
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean),
  )
  .pipe(z.array(httpUrlSchema).max(10, "Tối đa 10 URL chứng từ."));

export const createApprovalSchema = z.object({
  tracking_number: z.string().trim().min(1, "Vui lòng nhập mã vận đơn."),
  request_type: z.enum(APPROVAL_REQUEST_TYPES),
  branch_id: z.number().int().positive("Vui lòng chọn chi nhánh."),
  reason: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập lý do.")
    .max(1000, "Lý do không được vượt quá 1000 ký tự."),
  evidence_urls: evidenceUrlsSchema,
});

export const reviewApprovalSchema = z.object({
  review_note: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập ghi chú xét duyệt.")
    .max(1000, "Ghi chú không được vượt quá 1000 ký tự."),
});

export type CreateApprovalFormInput = z.input<typeof createApprovalSchema>;
export type CreateApprovalFormOutput = z.output<typeof createApprovalSchema>;
