import { describe, expect, it } from "vitest";
import { getEligibleCollections, sumCollectionAmounts, toMinorUnits, fromMinorUnits, validateReceiptMetadata } from "../utils/branch-remittance.utils";
import type { CashCollection } from "../types/branch-remittance.types";
import { transferFormSchema, receiptFileSchema } from "../schemas/branch-remittance.schema";

const records: CashCollection[] = [
  { public_id: "locked-a", collection_code: "CC-A", branch_id: 4, shipment_count: 2, total_amount: "10.10", status: "locked", locked_at: "2026-11-28T09:00:00+07:00", version: 1 },
  { public_id: "locked-b", collection_code: "CC-B", branch_id: 4, shipment_count: 1, total_amount: "0.20", status: "locked", locked_at: null, version: 2 },
  { public_id: "draft", collection_code: "CC-D", branch_id: 4, shipment_count: 1, total_amount: "5.00", status: "draft", locked_at: null, version: 1 },
  { public_id: "cancelled", collection_code: "CC-C", branch_id: 4, shipment_count: 1, total_amount: "5.00", status: "cancelled", locked_at: null, version: 1 },
  { public_id: "outside", collection_code: "CC-X", branch_id: 3, shipment_count: 1, total_amount: "50.00", status: "locked", locked_at: null, version: 1 },
];

describe("branch remittance utility rules", () => {
  it("only exposes locked, unremitted records in the active branch and deduplicates IDs", () => {
    expect(getEligibleCollections([...records, records[0]], 4, ["locked-b"]).map(({ public_id }) => public_id)).toEqual(["locked-a"]);
    expect(getEligibleCollections(records, null, [])).toEqual([]);
    expect(getEligibleCollections(records, null, [], true).map(({ public_id }) => public_id)).toEqual(["locked-a", "locked-b", "outside"]);
  });

  it("sums exact decimal amounts and ignores duplicate selected IDs", () => {
    expect(sumCollectionAmounts(records, ["locked-a", "locked-b", "locked-a"])).toBe("10.30");
    expect(sumCollectionAmounts(getEligibleCollections(records, 4, []), ["outside"])).toBe("0.00");
    expect(toMinorUnits("9999999999999.99")).toBe(999999999999999n);
    expect(fromMinorUnits(123n)).toBe("1.23");
    const maxRow = { ...records[0], total_amount: "9999999999999.99" };
    expect(sumCollectionAmounts([maxRow], [maxRow.public_id])).toBe("9999999999999.99");
    expect(sumCollectionAmounts(records, [])).toBe("0.00");
  });

  it("rejects malformed or out-of-range decimals", () => {
    expect(() => toMinorUnits("1e3")).toThrow();
    expect(() => toMinorUnits("-1.00")).toThrow();
    expect(() => toMinorUnits(" 1.00 ")).toThrow();
    expect(() => toMinorUnits("10000000000000.00")).toThrow();
    expect(() => toMinorUnits("1.001")).toThrow();
    expect(() => fromMinorUnits(1000000000000000n)).toThrow();
    const maxRows = ["max-a", "max-b"].map((public_id) => ({
      ...records[0],
      public_id,
      total_amount: "9999999999999.99",
    }));
    expect(sumCollectionAmounts(maxRows, ["max-a", "max-b"])).toBeNull();
  });

  it("validates receipt size, MIME, extension and empty file", () => {
    expect(validateReceiptMetadata({ name: "receipt.jpg", size: 100, type: "image/jpeg" })).toBeNull();
    expect(validateReceiptMetadata({ name: "receipt.webp", size: 100, type: "image/webp" })).toBeNull();
    expect(validateReceiptMetadata({ name: "receipt.png", size: 0, type: "image/png" })).toContain("trống");
    expect(validateReceiptMetadata({ name: "receipt.png", size: 5 * 1024 * 1024 + 1, type: "image/png" })).toContain("5 MB");
    expect(validateReceiptMetadata({ name: "receipt.svg", size: 100, type: "image/svg+xml" })).toContain("Chỉ chấp nhận");
    expect(validateReceiptMetadata({ name: "fake.svg", size: 100, type: "image/jpeg" })).toContain("Chỉ chấp nhận");
  });

  it("validates transfer fields without coercing a leading zero in the account number", () => {
    const parsed = transferFormSchema.parse({ bank_name: "  Ngân hàng  ", bank_account_no: "0012345", bank_reference_no: "GD-001" });
    expect(parsed.bank_name).toBe("Ngân hàng");
    expect(parsed.bank_account_no).toBe("0012345");
    expect(transferFormSchema.safeParse({ bank_name: "", bank_account_no: "x".repeat(51), bank_reference_no: "" }).success).toBe(false);
    expect(transferFormSchema.safeParse({ bank_name: "x".repeat(101), bank_account_no: "1", bank_reference_no: "y".repeat(101) }).success).toBe(false);
    expect(transferFormSchema.safeParse({ bank_name: "   ", bank_account_no: "1", bank_reference_no: "REF" }).success).toBe(false);
    expect(transferFormSchema.safeParse({ bank_name: "Ngân hàng Á Châu & Co.", bank_account_no: "000012345", bank_reference_no: "GD-ĐN/2026 #1" }).success).toBe(true);
  });

  it("accepts valid image files and rejects a broken or zero-byte file", () => {
    const png = new File([new Uint8Array([137, 80, 78, 71])], "receipt.png", { type: "image/png" });
    const jpeg = new File([new Uint8Array([255, 216, 255])], "receipt.jpg", { type: "image/jpeg" });
    const webp = new File([new Uint8Array([82, 73, 70, 70])], "receipt.webp", { type: "image/webp" });
    const empty = new File([], "empty.png", { type: "image/png" });
    const wrong = new File(["bad"], "receipt.gif", { type: "image/gif" });
    const mismatched = new File(["bad"], "receipt.png", { type: "image/jpeg" });
    expect(receiptFileSchema.safeParse(png).success).toBe(true);
    expect(receiptFileSchema.safeParse(jpeg).success).toBe(true);
    expect(receiptFileSchema.safeParse(webp).success).toBe(true);
    expect(receiptFileSchema.safeParse(empty).success).toBe(false);
    expect(receiptFileSchema.safeParse(wrong).success).toBe(false);
    expect(receiptFileSchema.safeParse(mismatched).success).toBe(false);
  });
});
