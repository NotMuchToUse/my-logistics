import { z } from "zod";
import { isSupportedReceiptFormat, RECEIPT_MAX_BYTES } from "../constants/branch-remittance.constants";

const requiredText = (max: number) => z.string().trim().min(1, "Vui lòng nhập thông tin.").max(max, `Tối đa ${max} ký tự.`);

export const transferFormSchema = z.object({
  bank_name: requiredText(100),
  bank_account_no: requiredText(50),
  bank_reference_no: requiredText(100),
});

export const receiptFileSchema = z.custom<File>(
  (file): file is File =>
    typeof File !== "undefined" && file instanceof File &&
    file.size > 0 && file.size <= RECEIPT_MAX_BYTES &&
    isSupportedReceiptFormat(file.name, file.type),
  { message: "Chọn ảnh JPEG, PNG hoặc WebP hợp lệ, dung lượng tối đa 5 MB." },
);

export type TransferFormInput = z.input<typeof transferFormSchema>;
