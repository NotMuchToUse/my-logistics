import type { DropoffBranch, PickupAddress, PickupDraft, PickupReceipt } from "../types/pickup.types.ts";
import { pickupSchema } from "../schemas/pickup.schema.ts";

// Isolated demo fixtures matching Untitled.pdf, never used by the real API path.
export const DEMO_CUSTOMER = { public_id: "01JDC9X8K2M4N6P8Q0R2S4T6VA", id: 101 };
export const DEMO_ADDRESSES: PickupAddress[] = [
  { id: 1, customer_id: 101, label: "Nhà riêng", address_role: "sender", contact_name: "Trần Ngọc Mai", phone_masked: "091***2468", address_detail: "35 Lê Duẩn, Đà Nẵng", deleted_at: null },
  { id: 2, customer_id: 101, label: "Văn phòng", address_role: "both", contact_name: "Trần Ngọc Mai", phone_masked: "091***2468", address_detail: "120 Ngô Quyền, Đà Nẵng", deleted_at: null },
];
export const DEMO_BRANCHES: DropoffBranch[] = [
  { public_id: "01JDC9X8K2M4N6P8Q0R2S4T6W3", name: "Bưu cục Sơn Trà", address_detail: "120 Ngô Quyền, Đà Nẵng", latitude: 16.0712, longitude: 108.2381, operating_hours: "07:30–19:00", accepts_customer_dropoff: 1, is_active: 1, deleted_at: null },
  { public_id: "01JDC9X8K2M4N6P8Q0R2S4T6W2", name: "Chi nhánh Đà Nẵng", address_detail: "35 Lê Duẩn, Đà Nẵng", latitude: 16.0678, longitude: 108.2208, operating_hours: "07:00–20:00", accepts_customer_dropoff: 1, is_active: 1, deleted_at: null },
];

export function eligibleBranches(branches: DropoffBranch[]) {
  return branches.filter((branch) => branch.is_active === 1 && branch.accepts_customer_dropoff === 1 && !branch.deleted_at && Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude) && Math.abs(branch.latitude) <= 85 && Math.abs(branch.longitude) <= 180);
}

export function ownedAddresses(addresses: PickupAddress[], customerId: number) {
  return addresses.filter((address) => address.customer_id === customerId && !address.deleted_at && ["sender", "both"].includes(address.address_role));
}

export function pickupFailure(code: string, message: string, details: Record<string, string[]> = {}) {
  return { success: false as const, error: { code, message, details } };
}

export function normalizeDraft(draft: PickupDraft): PickupDraft {
  const parsed = pickupSchema.parse(draft);
  return parsed.handoverMode === "driver_pickup"
    ? { ...parsed, branchPublicId: "" }
    : { ...parsed, addressId: "" };
}

export function createMockPickupService() {
  const completed = new Map<string, { fingerprint: string; receipt: PickupReceipt }>();
  return {
    options(customerPublicId: string) {
      const customerId = customerPublicId === DEMO_CUSTOMER.public_id ? DEMO_CUSTOMER.id : -1;
      return { addresses: ownedAddresses(DEMO_ADDRESSES, customerId), branches: eligibleBranches(DEMO_BRANCHES) };
    },
    create(customerPublicId: string, draft: PickupDraft, key: string) {
      if (customerPublicId !== DEMO_CUSTOMER.public_id) throw pickupFailure("403_FORBIDDEN", "Tài khoản này không có dữ liệu gửi hàng dùng thử.");
      const command = normalizeDraft(draft);
      if (command.handoverMode === "driver_pickup" && !this.options(customerPublicId).addresses.some((address) => String(address.id) === command.addressId)) {
        throw pickupFailure("422_VALIDATION_ERROR", "Địa chỉ lấy hàng không hợp lệ.", { addressId: ["Chọn địa chỉ gửi thuộc tài khoản của bạn."] });
      }
      if (command.handoverMode === "counter_dropoff" && !this.options(customerPublicId).branches.some((branch) => branch.public_id === command.branchPublicId)) {
        throw pickupFailure("422_VALIDATION_ERROR", "Bưu cục không nhận gửi hàng.", { branchPublicId: ["Vui lòng chọn bưu cục hợp lệ."] });
      }
      const fingerprint = JSON.stringify(command);
      const replayKey = customerPublicId + ":" + key;
      const previous = completed.get(replayKey);
      if (previous && previous.fingerprint !== fingerprint) throw pickupFailure("409_IDEMPOTENCY_DUPLICATE", "Mã thao tác đã được sử dụng với dữ liệu khác.");
      if (previous) return previous.receipt;
      const receipt: PickupReceipt = {
        request_code: "DEMO-" + key.slice(0, 8).toUpperCase(),
        handover_mode: command.handoverMode,
        estimated_parcel_count: command.parcelCount,
        estimated_weight_gram: command.weightGram,
        status: "pending",
        version: 1,
      };
      completed.set(replayKey, { fingerprint, receipt });
      return receipt;
    },
  };
}
