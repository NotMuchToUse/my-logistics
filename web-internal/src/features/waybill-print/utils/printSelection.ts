import type { PrintCommand, WaybillPrintModel } from "../types/waybillPrint.types";
import { printDocumentTypeSchema } from "../schemas/trackingRange.schema.ts";
import { encodeBarcode } from "./barcode.ts";

export function selectPrintParcels(model: WaybillPrintModel, command: PrintCommand) {
  printDocumentTypeSchema.parse(command.documentType);
  if (model.publicId !== command.shipmentPublicId) throw new Error("Vận đơn đã thay đổi.");
  encodeBarcode(model.trackingCode, 35);
  if (command.documentType !== "barcode_sticker") {
    if (command.parcelBarcodes.length) throw new Error("Mẫu vận đơn không nhận danh sách kiện.");
    return [];
  }
  const codes = command.parcelBarcodes;
  if (!codes.length || new Set(codes).size !== codes.length) throw new Error("Chọn ít nhất một kiện, không trùng lặp.");
  const selected = codes.map((code) => {
    const matches = model.parcels.filter((parcel) => parcel.parcelBarcode === code);
    if (matches.length !== 1) throw new Error("Kiện hàng không tồn tại hoặc trùng barcode.");
    encodeBarcode(code);
    return matches[0];
  });
  if (selected.some((parcel) => !Number.isInteger(parcel.parcelSequence) || parcel.parcelSequence < 1 || parcel.parcelSequence > model.parcelCount)
    || new Set(selected.map((parcel) => parcel.parcelSequence)).size !== selected.length) throw new Error("Thứ tự kiện không hợp lệ.");
  return selected.sort((a, b) => a.parcelSequence - b.parcelSequence);
}
