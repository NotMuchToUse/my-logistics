import { z } from "zod";
import {
  BAG_CODE_MAX_LENGTH,
  BAG_STATUSES,
  SEAL_NUMBER_MAX_LENGTH,
} from "./warehouse-bags.constants.ts";

export const bagStatusSchema = z.enum(BAG_STATUSES);

// Chỉ kiểm tra khoảng trắng để bắt buộc nhập; giữ nguyên giá trị Seal.
export const sealNumberSchema = z.string()
  .max(SEAL_NUMBER_MAX_LENGTH, "Số Seal không được vượt quá 40 ký tự.")
  .refine((value) => value.trim().length > 0, "Vui lòng nhập số Seal.");

export const bagCodeSchema = z.string()
  .max(BAG_CODE_MAX_LENGTH, "Mã túi không được vượt quá 35 ký tự.")
  .refine((value) => value.trim().length > 0, "Vui lòng nhập mã túi.");

// Giá trị lựa chọn của form, chưa phải định danh trong payload API.
export const bagClosingFormSchema = z.object({
  destination_warehouse_id: z.string().refine(
    (value) => value.trim().length > 0,
    "Vui lòng chọn kho đích.",
  ),
  seal_number: sealNumberSchema,
});

export const shipmentScanFormSchema = z.object({
  tracking_code: z.string().refine(
    (value) => value.trim().length > 0,
    "Vui lòng nhập hoặc quét mã vận đơn.",
  ),
});

export const bagLookupFormSchema = z.discriminatedUnion("lookupBy", [
  z.object({ lookupBy: z.literal("bag_code"), value: bagCodeSchema }),
  z.object({ lookupBy: z.literal("seal_number"), value: sealNumberSchema }),
]);
