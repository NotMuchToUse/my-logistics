import branchesMock from "@/mocks/branches.mock.json";
import rateCalculatorMock from "@/mocks/rateCalculator.mock.json";
import type { ShipmentStatus } from "@/types/api.types";
import type { PublicTrackingShipment } from "@/features/tracking/types/tracking.types";

export const MOCK_TRACKING_CODE = "VS26112300004";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  draft: "Bản nháp",
  pending_pickup: "Chờ lấy hàng",
  picked_up: "Đã lấy hàng",
  in_warehouse: "Đang ở kho",
  bagged: "Đã đóng túi",
  in_transit: "Đang vận chuyển",
  out_for_delivery: "Đang giao hàng",
  delivered: "Đã giao hàng",
  delivery_failed: "Giao hàng chưa thành công",
  pending_return: "Chờ chuyển hoàn",
  returning: "Đang chuyển hoàn",
  returned: "Đã chuyển hoàn",
  incident: "Phát sinh sự cố",
  cancelled: "Đã hủy",
};

const statusLabels: Record<string, string> = SHIPMENT_STATUS_LABELS;
const branches = branchesMock.success_response.data;

export function getTrackingTimestamp(value: string): number {
  return new Date(value.replace(" ", "T")).getTime();
}

export function getShipmentStatusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function getBranch(branchId: number) {
  return branches.branches.find((branch) => branch.id === branchId);
}

export function getBranchNameAndCode(branchId: number): string {
  const branch = getBranch(branchId);
  return branch ? `${branch.name} · ${branch.code}` : "Chưa có thông tin bưu cục";
}

export function getBranchLocation(branchId: number): string {
  const branch = getBranch(branchId);

  if (!branch) {
    return "";
  }

  const district = branches.districts.find(
    (item) => item.id === branch.district_id,
  );
  const province = branches.provinces.find(
    (item) => item.id === branch.province_id,
  );

  return [district?.name, province?.name].filter(Boolean).join(", ");
}

export function getServiceName(serviceTypeId: number): string {
  const service = rateCalculatorMock.pagination_response.data.find(
    (item) => item.id === serviceTypeId,
  );

  return service?.name ?? `Dịch vụ #${serviceTypeId}`;
}

export function getTimelineBranchIds(
  status: string,
  shipment: Pick<
    PublicTrackingShipment,
    "origin_branch_id" | "destination_branch_id"
  >,
): number[] {
  switch (status) {
    case "pending_pickup":
    case "picked_up":
    case "in_warehouse":
    case "bagged":
      return [shipment.origin_branch_id];
    case "in_transit":
      return [shipment.origin_branch_id, shipment.destination_branch_id];
    default:
      return [shipment.destination_branch_id];
  }
}

export function formatTrackingDate(value: string | undefined): string {
  if (!value) {
    return "Chưa có thông tin";
  }

  const date = new Date(getTrackingTimestamp(value));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length <= 3) {
    return "***";
  }

  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}
