import type { ShipmentStatus } from "@/types/api.types";
import type {
  FreightPaymentStatus,
  PaymentMethod,
  ShipmentSortField,
  ShipmentType,
  SortDirection,
} from "../types/shipment-list.types";

export const SHIPMENT_STATUSES = [
  "draft",
  "pending_pickup",
  "picked_up",
  "in_warehouse",
  "bagged",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "pending_return",
  "returning",
  "returned",
  "incident",
  "cancelled",
] as const satisfies readonly ShipmentStatus[];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  draft: "Bản nháp",
  pending_pickup: "Chờ lấy hàng",
  picked_up: "Đã lấy hàng",
  in_warehouse: "Đang ở kho",
  bagged: "Đã đóng túi",
  in_transit: "Đang trung chuyển",
  out_for_delivery: "Đang giao hàng",
  delivered: "Giao thành công",
  delivery_failed: "Giao thất bại",
  pending_return: "Chờ chuyển hoàn",
  returning: "Đang chuyển hoàn",
  returned: "Đã chuyển hoàn",
  incident: "Đang xử lý sự cố",
  cancelled: "Đã hủy",
};

export const SHIPMENT_STATUS_BADGE_CLASSES: Record<ShipmentStatus, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  pending_pickup: "border-slate-200 bg-slate-100 text-slate-700",
  picked_up: "border-blue-200 bg-blue-50 text-blue-700",
  in_warehouse: "border-blue-200 bg-blue-50 text-blue-700",
  bagged: "border-blue-200 bg-blue-50 text-blue-700",
  in_transit: "border-blue-200 bg-blue-50 text-blue-700",
  out_for_delivery: "border-blue-200 bg-blue-50 text-blue-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  delivery_failed: "border-red-200 bg-red-50 text-red-700",
  pending_return: "border-amber-200 bg-amber-50 text-amber-700",
  returning: "border-amber-200 bg-amber-50 text-amber-700",
  returned: "border-emerald-200 bg-emerald-50 text-emerald-700",
  incident: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

export const SHIPMENT_TYPES = [
  "standard",
  "return_shipment",
  "forward_shipment",
] as const satisfies readonly ShipmentType[];

export const PAYMENT_METHODS = [
  "ngttn",
  "ngtts",
  "nntn",
] as const satisfies readonly PaymentMethod[];

export const FREIGHT_PAYMENT_STATUSES = [
  "unpaid",
  "paid_at_counter",
  "collected_by_driver",
  "invoiced_postpaid",
] as const satisfies readonly FreightPaymentStatus[];

export const SHIPMENT_SORT_FIELDS = [
  "created_at",
  "tracking_code",
  "cod_amount",
  "total_freight_amount",
] as const satisfies readonly ShipmentSortField[];

export const SORT_DIRECTIONS = [
  "ASC",
  "DESC",
] as const satisfies readonly SortDirection[];

export const SHIPMENT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_SHIPMENT_PAGE_SIZE = 20;
export const MAX_SHIPMENT_PAGE_SIZE = 100;

export const CANCELLABLE_SHIPMENT_STATUSES = [
  "draft",
  "pending_pickup",
] as const satisfies readonly ShipmentStatus[];

export const SHIPMENT_LIST_PERMISSIONS = {
  read: "shipment.read",
  priority: "shipment.priority",
  cancel: "shipment.cancel",
  forward: "shipment.forward",
} as const;
