import { Badge } from "@/components/ui/badge";
import type {
  CashCollectionStatus,
  CashRemittanceStatus,
  CodTransactionStatus,
  PickupRequestStatus,
  ShipmentStatus,
} from "@/types/api.types";

export type BusinessStatus =
  | ShipmentStatus
  | CodTransactionStatus
  | PickupRequestStatus
  | CashCollectionStatus
  | CashRemittanceStatus;

interface StatusPresentation {
  label: string;
  className: string;
}

const STATUS_PRESENTATION: Record<BusinessStatus, StatusPresentation> = {
  draft: {
    label: "Bản nháp",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  pending_pickup: {
    label: "Chờ lấy hàng",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  pending: {
    label: "Chờ xử lý",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  picked_up: {
    label: "Đã lấy hàng",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  in_warehouse: {
    label: "Tại kho",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  bagged: {
    label: "Đã đóng túi",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  in_transit: {
    label: "Đang trung chuyển",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  out_for_delivery: {
    label: "Đang giao hàng",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  delivered: {
    label: "Đã giao thành công",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  delivery_failed: {
    label: "Giao hàng thất bại",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  pending_return: {
    label: "Chờ xử lý hoàn",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  returning: {
    label: "Đang hoàn hàng",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  returned: {
    label: "Đã hoàn hàng",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  incident: {
    label: "Đang xử lý sự cố",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  assigned: {
    label: "Đã phân công",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  accepted: {
    label: "Tài xế đã nhận",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  pickup_failed: {
    label: "Lấy hàng thất bại",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  driver_holding: {
    label: "Tài xế đang giữ tiền",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  collected_by_branch: {
    label: "Đã thu tại bưu cục",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  remitted_to_hq: {
    label: "Đã nộp về trung tâm",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  settled_to_customer: {
    label: "Đã tất toán khách hàng",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  locked: {
    label: "Đã khóa",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  submitted: {
    label: "Đã gửi duyệt",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  verified: {
    label: "Đã xác nhận",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Đã từ chối",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export interface StatusBadgeProps {
  status: BusinessStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <Badge variant="outline" className={presentation.className}>
      {presentation.label}
    </Badge>
  );
}
