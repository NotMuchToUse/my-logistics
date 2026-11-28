import { z } from "zod";
import type {
  ForwardShipmentRequest,
  ForwardShipmentFormInputValues,
} from "@/features/shipment-exceptions/types/shipment-exceptions.types";

const VIETNAMESE_PHONE_MESSAGE = "Số điện thoại người nhận không hợp lệ.";

function normalizeVietnamesePhone(phone: string): string {
  const digits = phone.replace(/\D+/g, "");

  if (digits.startsWith("84")) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

const forwardRecipientPhoneSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập số điện thoại người nhận.")
  .refine(
    (value) => !value.includes("*"),
    "Không sử dụng số điện thoại đã che.",
  )
  .transform(normalizeVietnamesePhone)
  .refine(
    (value) => /^0[0-9]{9,10}$/.test(value),
    VIETNAMESE_PHONE_MESSAGE,
  );

const safePositiveIdSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng chọn một giá trị.")
  .regex(/^[0-9]+$/, "Giá trị phải là số nguyên dương.")
  .transform((value) => Number(value))
  .refine(
    (value) => Number.isSafeInteger(value) && value > 0,
    "Giá trị phải là số nguyên dương an toàn.",
  );

export const forwardShipmentSchema = z.object({
  recipient_name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên người nhận.")
    .max(150, "Tên người nhận không được vượt quá 150 ký tự."),
  recipient_phone: forwardRecipientPhoneSchema,
  recipient_address: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập địa chỉ người nhận.")
    .max(255, "Địa chỉ người nhận không được vượt quá 255 ký tự."),
  recipient_province_id: safePositiveIdSchema,
  recipient_district_id: safePositiveIdSchema,
  recipient_ward_id: safePositiveIdSchema,
  destination_branch_id: safePositiveIdSchema,
});

export type ForwardShipmentSchemaInput = z.input<typeof forwardShipmentSchema>;
export type ForwardShipmentSchemaOutput = z.output<typeof forwardShipmentSchema>;

function satisfiesForwardShipmentFormInput(
  value: ForwardShipmentSchemaInput,
): ForwardShipmentFormInputValues {
  return value;
}

function satisfiesForwardShipmentRequest(
  value: ForwardShipmentSchemaOutput,
): ForwardShipmentRequest {
  return value;
}

void satisfiesForwardShipmentFormInput;
void satisfiesForwardShipmentRequest;
