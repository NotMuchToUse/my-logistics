import { USE_MOCK } from "@/core/api/axiosClient";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";
import { INTEGRATION_UNAVAILABLE } from "../constants/pickup.constants";
import { createMockPickupService, pickupFailure } from "./pickup.mock";
import type { PickupDraft } from "../types/pickup.types";

export const IS_PICKUP_DEMO = USE_MOCK;
const mockService = createMockPickupService();

function requireSession() {
  const session = useCustomerAuthStore.getState();
  if (!session.isAuthenticated || !session.token || !session.customer) {
    throw pickupFailure("401_UNAUTHORIZED", "Vui lòng đăng nhập lại để tạo yêu cầu gửi hàng.");
  }
  if (!USE_MOCK) throw new Error(INTEGRATION_UNAVAILABLE);
  return session.customer.public_id;
}

export async function loadPickupOptions() {
  const owner = requireSession();
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (requireSession() !== owner) throw pickupFailure("401_UNAUTHORIZED", "Phiên đăng nhập đã thay đổi.");
  return mockService.options(owner);
}

export async function createPickup(draft: PickupDraft, idempotencyKey: string) {
  const owner = requireSession();
  await new Promise((resolve) => setTimeout(resolve, 350));
  if (requireSession() !== owner) throw pickupFailure("401_UNAUTHORIZED", "Phiên đăng nhập đã thay đổi.");
  return {
    success: true as const,
    message: "Đã tạo yêu cầu dùng thử. Chưa gửi đến đơn vị vận chuyển.",
    data: mockService.create(owner, draft, idempotencyKey),
    meta: { timestamp: new Date().toISOString() },
  };
}
