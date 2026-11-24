import JsBarcode from "jsbarcode";
import { useEffect, useRef, useState } from "react";
import { encodeBarcode } from "../utils/barcode";

export function BarcodeSvg({
  value,
  availableWidthMm = 62,
  maxLength = 45,
}: {
  value: string;
  availableWidthMm?: number;
  maxLength?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.dataset.barcodeReady = "false";
    try {
      const bits = encodeBarcode(value, maxLength);
      if (availableWidthMm / (bits.length + 20) < 0.19) {
        throw new Error("Barcode quá dày cho khổ tem này. Cần khổ tem lớn hơn để nghiệm thu khả năng quét.");
      }
      JsBarcode(svg, value, {
        format: "CODE128",
        displayValue: false,
        margin: 10,
        width: 1,
        height: 60,
        lineColor: "#000000",
        background: "#ffffff",
      });
      svg.removeAttribute("aria-hidden");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `Barcode ${value}`);
      svg.dataset.barcodeReady = "true";
      setError(null);
    } catch (caught: unknown) {
      svg.replaceChildren();
      svg.dataset.barcodeReady = "false";
      setError(caught instanceof Error ? caught.message : "Barcode không hợp lệ.");
    }
    return () => { svg.dataset.barcodeReady = "false"; };
  }, [availableWidthMm, maxLength, value]);

  if (error) return <p role="alert" data-barcode-error="true">{error}</p>;
  return (
    <figure className="wp-barcode">
      <svg ref={svgRef} aria-hidden="true" data-barcode-ready="false" />
      <figcaption>{value}</figcaption>
    </figure>
  );
}
