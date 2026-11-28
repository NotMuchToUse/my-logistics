export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export function isSupportedReceiptFormat(name: string, type: string): boolean {
  if (type === "image/jpeg") return /\.jpe?g$/i.test(name);
  if (type === "image/png") return /\.png$/i.test(name);
  if (type === "image/webp") return /\.webp$/i.test(name);
  return false;
}
export const BRANCH_REMITTANCE_READ_PERMISSION = "finance.read";
export const BRANCH_REMITTANCE_SUBMIT_PERMISSION = "finance.remit";

export const REMITTANCE_STATUS_LABELS = {
  draft: "Nháp",
  submitted: "Chờ Trung tâm xác nhận",
  verified: "Đã xác nhận",
  rejected: "Bị từ chối",
} as const;
