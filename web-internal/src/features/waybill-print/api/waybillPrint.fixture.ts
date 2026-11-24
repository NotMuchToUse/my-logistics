import { z } from "zod";
import type { WaybillPrintModel } from "../types/waybillPrint.types";
import { trackingRangeRecordSchema } from "../schemas/trackingRange.schema.ts";

const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/).nullable();
const weight = z.number().int().nonnegative().nullable();
const fixtureSchema = z.object({
  success_response: z.object({ success: z.literal(true), data: z.object({
    shipment: z.object({
      public_id: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/), tracking_code: z.string().min(1).max(35),
      sender_name: z.string(), sender_phone_masked: z.string(), sender_address_detail: z.string(),
      receiver_name: z.string(), receiver_phone_masked: z.string(), receiver_address_detail: z.string(),
      parcel_count: z.number().int().positive(), actual_weight_gram: weight, volumetric_weight_gram: weight, chargeable_weight_gram: weight,
      total_freight_amount: money, cod_amount: money, declared_value: money, base_freight_amount: money, surcharge_amount: money, vas_amount: money, discount_amount: money, vat_amount: money,
      payment_method: z.enum(["ngttn", "ngtts", "nntn"]), created_at: z.string(),
    }),
    parcels: z.array(z.object({ id: z.string(), parcel_barcode: z.string().min(1).max(45), parcel_sequence: z.number().int().positive(), actual_weight_gram: weight })),
  }) }),
  pagination_response: z.object({ success: z.literal(true), data: z.array(trackingRangeRecordSchema) }),
}).superRefine((fixture, context) => {
  const { shipment, parcels } = fixture.success_response.data;
  if (shipment.parcel_count !== parcels.length) {
    context.addIssue({
      code: "custom",
      path: ["success_response", "data", "parcels"],
      message: "Số kiện không khớp dữ liệu vận đơn.",
    });
  }
  const barcodes = new Set<string>();
  const sequences = new Set<number>();
  for (const [index, parcel] of parcels.entries()) {
    if (barcodes.has(parcel.parcel_barcode)) {
      context.addIssue({
        code: "custom",
        path: ["success_response", "data", "parcels", index, "parcel_barcode"],
        message: "Barcode kiện bị trùng.",
      });
    }
    if (sequences.has(parcel.parcel_sequence) || parcel.parcel_sequence > shipment.parcel_count) {
      context.addIssue({
        code: "custom",
        path: ["success_response", "data", "parcels", index, "parcel_sequence"],
        message: "Thứ tự kiện không hợp lệ hoặc bị trùng.",
      });
    }
    barcodes.add(parcel.parcel_barcode);
    sequences.add(parcel.parcel_sequence);
  }
});

export function readWaybillFixture(value: unknown): { model: WaybillPrintModel; ranges: z.infer<typeof trackingRangeRecordSchema>[] } {
  const fixture = fixtureSchema.parse(value);
  const s = fixture.success_response.data.shipment;
  return { ranges: fixture.pagination_response.data, model: {
    publicId: s.public_id, trackingCode: s.tracking_code,
    sender: { name: s.sender_name, phoneDisplay: s.sender_phone_masked, addressDisplay: s.sender_address_detail },
    receiver: { name: s.receiver_name, phoneDisplay: s.receiver_phone_masked, addressDisplay: s.receiver_address_detail },
    parcels: fixture.success_response.data.parcels.map((p) => ({ parcelBarcode: p.parcel_barcode, parcelSequence: p.parcel_sequence, actualWeightGram: p.actual_weight_gram })),
    parcelCount: s.parcel_count, serviceName: "Dịch vụ minh họa", originBranchName: "Bưu cục gửi minh họa", destinationBranchName: "Bưu cục nhận minh họa",
    actualWeightGram: s.actual_weight_gram, volumetricWeightGram: s.volumetric_weight_gram, chargeableWeightGram: s.chargeable_weight_gram,
    freightAmount: s.total_freight_amount, codAmount: s.cod_amount, declaredValue: s.declared_value,
    baseFreightAmount: s.base_freight_amount, surchargeAmount: s.surcharge_amount, vasAmount: s.vas_amount, discountAmount: s.discount_amount, vatAmount: s.vat_amount,
    paymentMethod: s.payment_method, createdAt: s.created_at,
  } };
}
