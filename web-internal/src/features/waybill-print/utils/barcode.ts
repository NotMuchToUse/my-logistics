import JsBarcode from "jsbarcode";
import { z } from "zod";

const outputSchema = z.object({ encodings: z.array(z.object({ data: z.string().regex(/^[01]+$/) })).min(1) });

export function encodeBarcode(value: string, maxLength = 45): string {
  if (!value || value.length > maxLength || !/^[\x20-\x7E]+$/.test(value) || !value.trim()) {
    throw new Error("Mã barcode rỗng, quá dài hoặc chứa ký tự không được hỗ trợ.");
  }
  const output: Record<string, unknown> = {};
  JsBarcode(output, value, { format: "CODE128", displayValue: false });
  return outputSchema.parse(output).encodings.map((encoding) => encoding.data).join("");
}

export function barcodeBars(bits: string): { x: number; width: number }[] {
  const bars: { x: number; width: number }[] = [];
  for (let i = 0; i < bits.length;) {
    if (bits[i] !== "1") { i++; continue; }
    const start = i;
    while (bits[i] === "1") i++;
    bars.push({ x: start + 10, width: i - start });
  }
  return bars;
}
