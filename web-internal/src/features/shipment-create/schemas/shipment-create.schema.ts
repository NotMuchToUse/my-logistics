import { z } from "zod";
import { PAYMENT_METHODS } from "../constants/shipment-create.constants.ts";

// UI validation only; these schemas do not define the unconfirmed API payload.
const dimensionSchema = z.number().finite().positive().max(999999.99)
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(String(value)), {
    message: "Kích thước chỉ được có tối đa 2 chữ số thập phân.",
  });

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const parcelInputSchema = z.object({
  lengthCm: dimensionSchema,
  widthCm: dimensionSchema,
  heightCm: dimensionSchema,
  actualWeightGram: z.number().finite().int().positive().max(4294967295),
});

export const parcelListSchema = z.array(parcelInputSchema).min(1);

const requiredText = (max: number) => z.string().trim().min(1, "Vui lòng nhập thông tin.").max(max);
const selectedId = z.number().int().positive("Vui lòng chọn một giá trị.").max(Number.MAX_SAFE_INTEGER);
export const contactSchema = z.object({
  name: requiredText(150),
  phone: z.string().trim().refine((value) => {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
    return /^0[0-9]{9,10}$/.test(digits);
  }, "Số điện thoại Việt Nam không hợp lệ."),
  provinceId: selectedId,
  districtId: selectedId,
  wardId: selectedId,
  addressDetail: requiredText(255),
});

// Decimal strings preserve money precision and reject empty/scientific notation.
export const moneyInputSchema = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/, "Nhập số tiền không âm, tối đa 13 chữ số nguyên và 2 chữ số thập phân.");
export const shipmentDraftSchema = z.object({
  sender: contactSchema,
  receiver: contactSchema,
  parcels: parcelListSchema,
  serviceTypeId: selectedId,
  cargoCategoryId: selectedId,
  selectedVasIds: z.array(selectedId).refine((ids) => new Set(ids).size === ids.length, "DVGT không được trùng."),
  codAmount: moneyInputSchema,
  declaredValue: moneyInputSchema,
  paymentMethod: paymentMethodSchema,
});

export type ShipmentDraft = z.infer<typeof shipmentDraftSchema>;
