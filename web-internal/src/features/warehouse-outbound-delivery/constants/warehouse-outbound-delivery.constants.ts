import type { ShipmentStatus } from "@/types/api.types";
import type { OutboundDeliveryReceiptStatus } from "../types/warehouse-outbound-delivery.types";

export const OUTBOUND_DELIVERY_ENDPOINT = "/api/v1/warehouse/outbound-delivery";

export const OUTBOUND_DELIVERY_STATUS_META: Record<
  OutboundDeliveryReceiptStatus,
  {
    label: string;
    className: string;
  }
> = {
  draft: {
    label: "Phiếu nháp (Đang quét)",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  confirmed: {
    label: "Đã chốt xuất giao",
    className: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  cancelled: {
    label: "Đã hủy phiếu",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export const OUTBOUND_SHIPMENT_STATUS_META: Partial<
  Record<
    ShipmentStatus,
    {
      label: string;
      className: string;
    }
  >
> = {
  in_warehouse: {
    label: "Đang lưu kho",
    className: "border-slate-300 bg-slate-100 text-slate-800",
  },
  out_for_delivery: {
    label: "Đang giao hàng",
    className: "border-sky-300 bg-sky-50 text-sky-900",
  },
  delivery_failed: {
    label: "Giao thất bại (Chờ giao lại)",
    className: "border-orange-300 bg-orange-50 text-orange-900",
  },
};

export const ELIGIBLE_DELIVERY_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  "in_warehouse",
  "delivery_failed",
];

export const QUICK_REMOVE_REASONS: readonly string[] = [
  "Quét nhầm mã vận đơn",
  "Phân sai tuyến tài xế giao hàng",
  "Kiện hàng hư hỏng / rách bao bì cần kiểm tra lại",
  "Khách hàng hẹn lùi ngày nhận hàng",
];
