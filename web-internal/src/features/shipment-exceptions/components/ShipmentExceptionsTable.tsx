import { ChevronLeft, ChevronRight, PackageOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVndCurrency } from "@/core/utils/formatters";
import { ShipmentExceptionActions } from "@/features/shipment-exceptions/components/ShipmentExceptionActions";
import type { ShipmentExceptionActionsProps } from "@/features/shipment-exceptions/components/ShipmentExceptionActions";
import type { useShipmentExceptions } from "@/features/shipment-exceptions/hooks/useShipmentExceptions";
import type { ShipmentType } from "@/features/shipment-exceptions/types/shipment-exceptions.types";

type ShipmentExceptionsHookState = ReturnType<typeof useShipmentExceptions>;

export type ShipmentExceptionsTableProps = Pick<
  ShipmentExceptionsHookState,
  | "activeTab"
  | "capabilities"
  | "errorKind"
  | "isEmpty"
  | "isError"
  | "isLoading"
  | "isRefreshing"
  | "isSearchEmpty"
  | "pagination"
  | "retry"
  | "setPage"
  | "shipments"
> & {
  onOpenReturn: NonNullable<ShipmentExceptionActionsProps["onOpenReturn"]>;
  onOpenForward: NonNullable<ShipmentExceptionActionsProps["onOpenForward"]>;
};

function displayText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() !== "" ? value : "—";
}

function getShipmentTypeLabel(
  shipmentType: ShipmentType | undefined,
): string {
  switch (shipmentType) {
    case "standard":
      return "Vận đơn tiêu chuẩn";
    case "return_shipment":
      return "Vận đơn chuyển hoàn";
    case "forward_shipment":
      return "Vận đơn chuyển tiếp";
    default:
      return "Chưa có thông tin";
  }
}

function getCodLabel(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return "Chưa có thông tin";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0
      ? formatVndCurrency(value)
      : "Dữ liệu COD không hợp lệ";
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return "Chưa có thông tin";
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalizedValue)) {
    return "Dữ liệu COD không hợp lệ";
  }

  const amount = Number(normalizedValue);
  return Number.isFinite(amount) && amount >= 0
    ? formatVndCurrency(amount)
    : "Dữ liệu COD không hợp lệ";
}

function getDeliveryAttemptLabel(
  value: number | undefined,
): string | number {
  if (value === undefined) {
    return "Chưa có thông tin";
  }

  return Number.isSafeInteger(value) && value >= 0
    ? value
    : "Dữ liệu không hợp lệ";
}

function getErrorPresentation(
  errorKind: ShipmentExceptionsHookState["errorKind"],
): { title: string; description: string } {
  if (errorKind === "backend-unavailable") {
    return {
      title: "Backend vận đơn chưa khả dụng",
      description:
        "Hiện chưa thể tải danh sách từ Backend. Vui lòng thử lại sau.",
    };
  }

  if (errorKind === "fixture") {
    return {
      title: "Dữ liệu vận đơn không hợp lệ",
      description:
        "Không thể xác thực dữ liệu danh sách. Vui lòng thử tải lại.",
    };
  }

  return {
    title: "Không tải được danh sách vận đơn",
    description: "Đã xảy ra lỗi khi tải danh sách. Vui lòng thử lại.",
  };
}

function ShipmentTableSkeleton() {
  const skeletonRows = [
    "shipment-skeleton-1",
    "shipment-skeleton-2",
    "shipment-skeleton-3",
    "shipment-skeleton-4",
    "shipment-skeleton-5",
  ];

  return (
    <div role="status" aria-label="Đang tải danh sách vận đơn">
      <Table aria-busy="true" className="min-w-[52rem]">
        <TableCaption className="sr-only">
          Đang tải danh sách vận đơn
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Mã vận đơn</TableHead>
            <TableHead>Người nhận</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Loại vận đơn</TableHead>
            <TableHead className="text-right">Số lần giao</TableHead>
            <TableHead className="text-right">COD</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skeletonRows.map((key) => (
            <TableRow key={key} aria-hidden="true">
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ShipmentExceptionsTable({
  activeTab,
  capabilities,
  errorKind,
  isEmpty,
  isError,
  isLoading,
  isRefreshing,
  isSearchEmpty,
  pagination,
  retry,
  setPage,
  shipments,
  onOpenReturn,
  onOpenForward,
}: ShipmentExceptionsTableProps) {
  if (isLoading && shipments.length === 0) {
    return <ShipmentTableSkeleton />;
  }

  const errorPresentation = getErrorPresentation(errorKind);
  const retryButton = (
    <Button type="button" variant="outline" onClick={retry}>
      Thử lại
    </Button>
  );

  if (isError && shipments.length === 0) {
    return (
      <div role="alert">
        <EmptyState
          icon={PackageOpen}
          title={errorPresentation.title}
          description={errorPresentation.description}
          action={retryButton}
        />
      </div>
    );
  }

  if (isEmpty || shipments.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title={
          isSearchEmpty
            ? "Không tìm thấy vận đơn"
            : activeTab === "pending-return"
              ? "Chưa có vận đơn chờ chuyển hoàn"
              : "Chưa có vận đơn chờ xử lý"
        }
        description={
          isSearchEmpty
            ? "Không tìm thấy vận đơn phù hợp với từ khóa đang áp dụng."
            : "Danh sách hiện chưa có vận đơn phù hợp."
        }
      />
    );
  }

  const rangeStart =
    pagination.total > 0
      ? (pagination.page - 1) * pagination.per_page + 1
      : 0;
  const rangeEnd = Math.min(
    pagination.page * pagination.per_page,
    pagination.total,
  );

  return (
    <section className="min-w-0 space-y-3">
      {isError && (
        <div
          className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p>
            <span className="font-medium">{errorPresentation.title}.</span>{" "}
            {errorPresentation.description}
          </p>
          {retryButton}
        </div>
      )}

      {isRefreshing && (
        <p className="text-sm text-muted-foreground" role="status">
          Đang cập nhật danh sách vận đơn…
        </p>
      )}

      <Table
        aria-label={
          activeTab === "pending-return"
            ? "Danh sách vận đơn chờ chuyển hoàn"
            : "Danh sách vận đơn chờ xử lý"
        }
        aria-busy={isRefreshing}
        className="min-w-[52rem]"
      >
        <TableCaption className="sr-only">
          {activeTab === "pending-return"
            ? "Danh sách vận đơn chờ chuyển hoàn"
            : "Danh sách vận đơn chờ xử lý"}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Mã vận đơn</TableHead>
            <TableHead className="min-w-48">Người nhận</TableHead>
            <TableHead className="whitespace-nowrap">Trạng thái</TableHead>
            <TableHead className="whitespace-nowrap">Loại vận đơn</TableHead>
            <TableHead className="whitespace-nowrap text-right">
              Số lần giao
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">COD</TableHead>
            <TableHead className="whitespace-nowrap text-right">
              Thao tác
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow key={shipment.public_id}>
              <TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">
                {displayText(shipment.tracking_code)}
              </TableCell>
              <TableCell className="min-w-48">
                <span className="block break-words font-medium">
                  {displayText(shipment.recipient_name)}
                </span>
                {shipment.recipient_phone_masked && (
                  <span className="mt-1 block whitespace-nowrap text-xs text-muted-foreground">
                    {displayText(shipment.recipient_phone_masked)}
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <StatusBadge status={shipment.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {getShipmentTypeLabel(shipment.shipment_type)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {getDeliveryAttemptLabel(shipment.delivery_attempt_count)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {getCodLabel(shipment.cod_amount)}
              </TableCell>
              <TableCell className="text-right">
                <ShipmentExceptionActions
                  shipment={shipment}
                  capabilities={capabilities}
                  onOpenReturn={onOpenReturn}
                  onOpenForward={onOpenForward}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination.total > 0 && pagination.total_pages > 0 && (
        <nav
          className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          aria-label="Phân trang danh sách vận đơn"
        >
          <p className="text-muted-foreground" aria-live="polite">
            Hiển thị {rangeStart.toLocaleString("vi-VN")}–
            {rangeEnd.toLocaleString("vi-VN")} trên{" "}
            {pagination.total.toLocaleString("vi-VN")} vận đơn
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <p className="min-w-[7rem] text-center text-muted-foreground">
              Trang {pagination.page} / {pagination.total_pages}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Trang trước"
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Trang sau"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setPage(pagination.page + 1)}
            >
              Sau
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}
