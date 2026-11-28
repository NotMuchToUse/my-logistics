import { z } from "zod";

export const createOutboundDeliverySchema = z.object({
  warehouse_id: z.number().int().positive("Vui lòng xác định kho xuất hàng."),
  driver_id: z.number().int().positive("Vui lòng chọn tài xế giao hàng thuộc bưu cục."),
  note: z
    .string()
    .trim()
    .max(500, "Ghi chú không được vượt quá 500 ký tự.")
    .optional(),
});

export const scanOutboundShipmentSchema = z.object({
  tracking_code: z
    .string()
    .trim()
    .min(4, "Mã vận đơn phải có ít nhất 4 ký tự.")
    .max(40, "Mã vận đơn không được vượt quá 40 ký tự.")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Mã vận đơn chỉ được chứa chữ cái, chữ số và dấu gạch ngang.",
    ),
});

export const removeOutboundItemSchema = z.object({
  remove_reason: z
    .string()
    .trim()
    .min(3, "Vui lòng nhập lý do gỡ đơn (tối thiểu 3 ký tự).")
    .max(255, "Lý do gỡ đơn không được vượt quá 255 ký tự."),
});

export const confirmOutboundDeliverySchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, "Ghi chú chốt phiếu không được vượt quá 500 ký tự.")
    .optional(),
});

export type CreateOutboundDeliveryFormValues = z.infer<
  typeof createOutboundDeliverySchema
>;
export type ScanOutboundShipmentFormValues = z.infer<
  typeof scanOutboundShipmentSchema
>;
export type RemoveOutboundItemFormValues = z.infer<
  typeof removeOutboundItemSchema
>;
export type ConfirmOutboundDeliveryFormValues = z.infer<
  typeof confirmOutboundDeliverySchema
>;
