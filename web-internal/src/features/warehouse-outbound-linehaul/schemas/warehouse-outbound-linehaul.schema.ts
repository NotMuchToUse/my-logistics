import { z } from "zod";

export const outboundScanSchema = z
  .string()
  .trim()
  .min(1, "Quét hoặc nhập mã vận đơn / mã Seal.")
  .max(64, "Mã quét không được vượt quá 64 ký tự.")
  .transform((value) => value.toUpperCase());

export const mawbNumberSchema = z
  .string()
  .trim()
  .min(1, "Đại lý hàng không yêu cầu nhập số MAWB.")
  .max(32, "Số MAWB không được vượt quá 32 ký tự.")
  .regex(/^[A-Z0-9-]+$/i, "Số MAWB chỉ được chứa chữ, số và dấu gạch ngang.");
