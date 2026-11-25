import {
  AlertTriangle,
  Clock,
  MapPin,
  Package,
  Phone,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatWeight } from "@/core/utils/formatters";
import {
  PICKUP_MODE_LABELS,
  PICKUP_STATUS_META,
} from "../constants/pickup-dispatch.constants";
import type { PickupRequestItem } from "../types/pickup-dispatch.types";
import { evaluateSlaStatus } from "../utils/sla.utils";

interface PickupDispatchTableProps {
  items: PickupRequestItem[];
  loading: boolean;
  onAssignClick: (item: PickupRequestItem) => void;
  onCancelClick: (item: PickupRequestItem) => void;
}

export function PickupDispatchTable({
  items,
  loading,
  onAssignClick,
  onCancelClick,
}: PickupDispatchTableProps) {
  if (loading) {
    return (
      <div className="space-y-2.5 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <Truck className="h-10 w-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">
          Chưa có yêu cầu lấy hàng nào khớp bộ lọc
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Thử đổi bưu cục, trạng thái hoặc bấm &quot;Tạo yêu cầu lấy hàng&quot;
          khi khách gọi điện.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[155px]">Mã yêu cầu</TableHead>
            <TableHead className="min-w-[230px]">Khách gửi & Điểm lấy</TableHead>
            <TableHead className="w-[140px]">Hàng dự kiến</TableHead>
            <TableHead className="w-[195px]">Hạn chót SLA</TableHead>
            <TableHead className="w-[175px]">Tài xế phụ trách</TableHead>
            <TableHead className="w-[135px]">Trạng thái</TableHead>
            <TableHead className="w-[180px] text-right">Điều phối</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const sla = evaluateSlaStatus(item.sla_deadline_at, item.status);
            const statusMeta = PICKUP_STATUS_META[item.status];
            const isOverdue = sla.urgency === "overdue";
            const isWarning = sla.urgency === "warning";
            const canAssign = ["pending", "assigned", "pickup_failed"].includes(
              item.status,
            );
            const canCancel = ["pending", "assigned"].includes(item.status);

            const rowHighlightClass = isOverdue
              ? "bg-red-50/90 hover:bg-red-100/70 border-l-4 border-l-red-600"
              : isWarning
                ? "bg-rose-50/75 hover:bg-rose-100/60 border-l-4 border-l-rose-500"
                : "";

            return (
              <TableRow key={item.public_id} className={rowHighlightClass}>
                {/* Mã yêu cầu */}
                <TableCell className="align-top">
                  <div className="font-mono text-sm font-semibold">
                    {item.request_code}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {PICKUP_MODE_LABELS[item.pickup_mode]}
                  </div>
                  {item.branch_code && (
                    <Badge variant="outline" className="mt-1 text-[11px]">
                      {item.branch_code}
                    </Badge>
                  )}
                </TableCell>

                {/* Khách gửi & địa chỉ */}
                <TableCell className="align-top">
                  <div className="font-medium">{item.sender_name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{item.sender_phone_masked}</span>
                  </div>
                  <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="line-clamp-2">{item.pickup_address}</span>
                  </div>
                  {item.note && (
                    <div className="mt-1 text-xs italic text-amber-700">
                      Ghi chú: {item.note}
                    </div>
                  )}
                </TableCell>

                {/* Kiện & trọng lượng dự kiến */}
                <TableCell className="align-top">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{item.estimated_parcel_count} kiện</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    ~ {formatWeight(item.estimated_weight_gram)}
                  </div>
                </TableCell>

                {/* Cảnh báo SLA */}
                <TableCell className="align-top">
                  {item.sla_deadline_at ? (
                    <div className="space-y-1">
                      <div className="text-xs font-medium">
                        {formatDateTime(item.sla_deadline_at).replace(
                          " +07:00",
                          "",
                        )}
                      </div>
                      {isOverdue && (
                        <Badge className="gap-1 bg-red-600 text-white hover:bg-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          {sla.label}
                        </Badge>
                      )}
                      {isWarning && (
                        <Badge className="gap-1 bg-rose-600 text-white hover:bg-rose-700">
                          <Clock className="h-3 w-3" />
                          {sla.label}
                        </Badge>
                      )}
                      {!isOverdue && !isWarning && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {sla.label}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Chưa đặt SLA
                    </span>
                  )}
                </TableCell>

                {/* Tài xế */}
                <TableCell className="align-top">
                  {item.assigned_driver_id ? (
                    <div>
                      <div className="text-sm font-medium">
                        {item.assigned_driver_name ??
                          `Tài xế #${item.assigned_driver_id}`}
                      </div>
                      {item.assigned_driver_phone_masked && (
                        <div className="text-xs text-muted-foreground">
                          {item.assigned_driver_phone_masked}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">
                      Chưa phân công
                    </span>
                  )}
                </TableCell>

                {/* Trạng thái */}
                <TableCell className="align-top">
                  <Badge variant="outline" className={statusMeta.badgeClass}>
                    {statusMeta.label}
                  </Badge>
                  {item.failure_reason && (
                    <p className="mt-1 text-[11px] text-rose-600">
                      {item.failure_reason}
                    </p>
                  )}
                  {item.cancel_reason && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Lý do: {item.cancel_reason}
                    </p>
                  )}
                </TableCell>

                {/* Hành động */}
                <TableCell className="align-top text-right">
                  <div className="flex justify-end gap-1.5">
                    {canAssign && (
                      <Button
                        size="sm"
                        variant={
                          item.status === "pending" ? "default" : "outline"
                        }
                        onClick={() => onAssignClick(item)}
                      >
                        <UserCheck className="mr-1 h-3.5 w-3.5" />
                        {item.assigned_driver_id ? "Đổi TX" : "Phân công"}
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onCancelClick(item)}
                        title="Hủy yêu cầu lấy hàng"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}