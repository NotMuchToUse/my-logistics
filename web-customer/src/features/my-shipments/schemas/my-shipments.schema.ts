import { z } from "zod";

export const cancelPickupRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Lý do hủy cần có ít nhất 5 ký tự.")
    .max(500, "Lý do hủy không được vượt quá 500 ký tự."),
});

export type CancelPickupRequestValues = z.infer<
  typeof cancelPickupRequestSchema
>;
