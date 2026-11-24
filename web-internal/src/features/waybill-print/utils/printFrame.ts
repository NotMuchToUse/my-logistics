import printCss from "../styles/waybillPrint.css?inline";
import { PRINT_SIZES } from "../constants/waybillPrint.constants";
import type { PrintDocumentType } from "../types/waybillPrint.types";

/** Isolated same-origin document; React-rendered nodes are cloned, never parsed as HTML strings. */
export async function openPrintFrame(source: HTMLElement, type: PrintDocumentType, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error("Lượt in đã hủy do thay đổi ngữ cảnh.");
  const barcodes = Array.from(source.querySelectorAll("svg"));
  if (source.querySelector("[data-barcode-error]") || !barcodes.length
      || barcodes.some((barcode) => barcode.dataset.barcodeReady !== "true")) {
    throw new Error("Barcode chưa sẵn sàng.");
  }
  const size = PRINT_SIZES[type];
  const frame = document.createElement("iframe");
  frame.title = "Chứng từ in minh họa";
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1000px;height:1000px;border:0";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    const target = frame.contentWindow;
    if (!doc || !target) throw new Error("Trình duyệt không hỗ trợ vùng in.");
    const style = doc.createElement("style");
    style.textContent = `${printCss}\n@page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; } html,body { margin:0; padding:0; background:white; }`;
    doc.head.append(style);
    for (const node of source.children) doc.body.append(doc.importNode(node, true));
    await doc.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (signal.aborted) throw new Error("Ngữ cảnh in đã thay đổi.");
    // Block labels that would silently spill onto extra pages.
    if (type !== "waybill_a4") {
      for (const element of doc.querySelectorAll<HTMLElement>(".wp-document")) {
        if (element.getBoundingClientRect().height > size.heightMm * 96 / 25.4 + 1) throw new Error("Nội dung vượt khổ tem thử nghiệm. Cần xác nhận mẫu/khổ tem lớn hơn.");
      }
    }
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { target.removeEventListener("afterprint", finish); signal.removeEventListener("abort", abort); };
      const finish = () => { cleanup(); resolve(); };
      const abort = () => { cleanup(); reject(new Error("Đã hủy vùng in vì ngữ cảnh thay đổi.")); };
      target.addEventListener("afterprint", finish, { once: true });
      signal.addEventListener("abort", abort, { once: true });
      try { target.focus(); target.print(); } catch (error) { cleanup(); reject(error); }
    });
  } finally { frame.remove(); }
}
