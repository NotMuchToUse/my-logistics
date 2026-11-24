import { PRINT_DOCUMENT_LABELS, PRINT_DOCUMENT_TYPES, PRINT_SIZES } from "../constants/waybillPrint.constants";
import type { PrintDocumentType, PrintableParcel } from "../types/waybillPrint.types";

export function PrintControls({
  documentType,
  parcels,
  selectedBarcodes,
  disabled,
  onDocumentTypeChange,
  onSelectedBarcodesChange,
  onPrint,
  onRetry,
  retryAvailable,
  busy,
}: {
  documentType: PrintDocumentType;
  parcels: PrintableParcel[];
  selectedBarcodes: string[];
  disabled: boolean;
  onDocumentTypeChange: (value: PrintDocumentType) => void;
  onSelectedBarcodesChange: (value: string[]) => void;
  onPrint: () => void;
  onRetry: () => void;
  retryAvailable: boolean;
  busy: boolean;
}) {
  const size = PRINT_SIZES[documentType];
  const missingStickerSelection = documentType === "barcode_sticker" && selectedBarcodes.length === 0;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" aria-labelledby="print-controls-title">
      <h2 id="print-controls-title" className="font-semibold">Thiết lập chứng từ</h2>
      <fieldset disabled={disabled || busy} className="space-y-3">
        <legend className="sr-only">Chọn mẫu in</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRINT_DOCUMENT_TYPES.map((type) => (
            <label key={type} className="flex cursor-pointer gap-2 rounded-md border p-3">
              <input
                type="radio"
                name="print-document-type"
                value={type}
                checked={documentType === type}
                onChange={() => onDocumentTypeChange(type)}
              />
              <span>
                <span className="block font-medium">{PRINT_DOCUMENT_LABELS[type]}</span>
                <span className="text-xs text-muted-foreground">
                  {PRINT_SIZES[type].widthMm} × {PRINT_SIZES[type].heightMm} mm
                </span>
              </span>
            </label>
          ))}
        </div>
        {documentType === "barcode_sticker" && (
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Chọn kiện cần in</legend>
            <div className="flex flex-wrap gap-2">
              {parcels.map((parcel) => {
                const checked = selectedBarcodes.includes(parcel.parcelBarcode);
                return (
                  <label key={parcel.parcelBarcode} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onSelectedBarcodesChange(
                        checked
                          ? selectedBarcodes.filter((code) => code !== parcel.parcelBarcode)
                          : [...selectedBarcodes, parcel.parcelBarcode],
                      )}
                    />
                    Kiện {parcel.parcelSequence} · {parcel.parcelBarcode}
                  </label>
                );
              })}
            </div>
            {parcels.length === 0 && <p className="text-sm text-muted-foreground">Vận đơn chưa có barcode kiện do Backend cấp.</p>}
          </fieldset>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        {retryAvailable ? (
          <button type="button" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" onClick={onRetry} disabled={busy}>
            Thử lại đúng lượt in trước
          </button>
        ) : (
          <button type="button" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50" onClick={onPrint} disabled={disabled || busy || missingStickerSelection}>
            {busy ? "Đang xử lý..." : "Ghi nhận và mở hộp thoại in"}
          </button>
        )}
        {size.requiresApproval && <p className="text-sm text-amber-700">Khổ tem minh họa; cần nghiệm thu với máy in và máy quét trước khi dùng thực tế.</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Mỗi lần bấm in ghi nhận một lần yêu cầu; số bản sao do hộp thoại/trình điều khiển máy in quản lý.
        Hệ thống không thể xác nhận người dùng đã in hay đã hủy hộp thoại.
      </p>
    </section>
  );
}
