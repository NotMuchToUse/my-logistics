import { isSupportedReceiptFormat, RECEIPT_MAX_BYTES } from "../constants/branch-remittance.constants";
import type { CashCollection } from "../types/branch-remittance.types";

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/;

export function toMinorUnits(amount: string): bigint {
  if (!MONEY_PATTERN.test(amount)) throw new RangeError("Số tiền không hợp lệ.");
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function fromMinorUnits(amount: bigint): string {
  if (amount < 0n || amount > 999999999999999n) throw new RangeError("Tổng tiền vượt phạm vi DECIMAL(15,2).");
  return `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
}

export function formatVnd(amount: string): string {
  const minor = toMinorUnits(amount);
  const vnd = Number(minor) / 100;
  if (!Number.isSafeInteger(Number(minor))) return `${amount} VND`;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(vnd)} VND`;
}

export function getEligibleCollections(
  collections: CashCollection[], branchId: number | null, remittedIds: string[], includeAllBranches = false,
): CashCollection[] {
  if (branchId === null && !includeAllBranches) return [];
  const remitted = new Set(remittedIds);
  const seen = new Set<string>();
  return collections.filter((item) => {
    if (item.status !== "locked" || (!includeAllBranches && item.branch_id !== branchId) || remitted.has(item.public_id) || seen.has(item.public_id)) return false;
    seen.add(item.public_id);
    try { toMinorUnits(item.total_amount); } catch { return false; }
    return true;
  });
}

export function sumCollectionAmounts(collections: CashCollection[], selectedIds: string[]): string | null {
  const selected = new Set(selectedIds);
  try {
    const total = collections.reduce((sum, item) => selected.has(item.public_id) ? sum + toMinorUnits(item.total_amount) : sum, 0n);
    return fromMinorUnits(total);
  } catch {
    return null;
  }
}

export function validateReceiptMetadata(file: Pick<File, "name" | "size" | "type">): string | null {
  if (file.size === 0) return "Tệp ảnh đang trống.";
  if (file.size > RECEIPT_MAX_BYTES) return "Ảnh không được vượt quá 5 MB.";
  if (!isSupportedReceiptFormat(file.name, file.type)) return "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.";
  return null;
}
