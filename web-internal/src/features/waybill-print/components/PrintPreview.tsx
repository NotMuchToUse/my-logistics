import type { RefObject } from "react";
import type { PrintDocumentType, WaybillPrintModel } from "../types/waybillPrint.types";
import { BarcodeStickerTemplate, WaybillA4Template, WaybillLabelTemplate } from "./PrintTemplates";
import "../styles/waybillPrint.css";

export function PrintPreview({
  model,
  documentType,
  selectedBarcodes,
  previewRef,
}: {
  model: WaybillPrintModel;
  documentType: PrintDocumentType;
  selectedBarcodes: string[];
  previewRef: RefObject<HTMLDivElement | null>;
}) {
  const parcels = [...model.parcels].sort((a, b) => a.parcelSequence - b.parcelSequence);
  return (
    <section className="space-y-3" aria-labelledby="print-preview-title">
      <div>
        <h2 id="print-preview-title" className="font-semibold">Xem trước bản in</h2>
        <p className="text-sm text-muted-foreground">Dữ liệu minh họa đã che/mask thông tin liên hệ; không dùng để vận chuyển.</p>
      </div>
      <div ref={previewRef} className="wp-preview" aria-label="Vùng xem trước chứng từ">
        <div data-print-content="true">
          {documentType === "waybill_a4" && <WaybillA4Template model={model} />}
          {documentType === "waybill_label" && <WaybillLabelTemplate model={model} />}
          {documentType === "barcode_sticker" && parcels
            .filter((parcel) => selectedBarcodes.includes(parcel.parcelBarcode))
            .map((parcel) => <BarcodeStickerTemplate key={parcel.parcelBarcode} model={model} parcel={parcel} />)}
        </div>
      </div>
    </section>
  );
}
