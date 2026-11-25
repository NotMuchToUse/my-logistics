import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LoaderCircle,
  PackageOpen,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShipmentActions } from "../hooks/useShipmentActions";
import type { useShipmentList } from "../hooks/useShipmentList";
import type {
  ShipmentSortField,
} from "../types/shipment-list.types";
import {
  formatShipmentAmount,
  formatShipmentCreatedAt,
  getShipmentErrorMessage,
  getShipmentStatusPresentation,
} from "../utils/shipment-list-display";
import { ShipmentPriorityBadge } from "./ShipmentPriorityBadge";
import { ShipmentRowActions } from "./ShipmentRowActions";
import { ShipmentTablePagination } from "./ShipmentTablePagination";

type ShipmentListState = ReturnType<typeof useShipmentList>;

interface ShipmentDataTableProps {
  list: ShipmentListState;
}

function displayText(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value : "—";
}

function SortableHeader({
  label,
  field,
  alignRight,
  sortBy,
  sortDirection,
  onSort,
}: {
  label: string;
  field: ShipmentSortField;
  alignRight?: boolean;
  sortBy: ShipmentSortField;
  sortDirection: "ASC" | "DESC";
  onSort: (field: ShipmentSortField) => void;
}) {
  const active = sortBy === field;
  const SortIcon = !active
    ? ArrowUpDown
    : sortDirection === "ASC"
      ? ArrowUp
      : ArrowDown;

  return (
    <TableHead className={alignRight ? "text-right" : undefined}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-8 whitespace-nowrap px-2 ${alignRight ? "ml-auto" : ""}`}
        aria-label={`Sắp xếp theo ${label}${
          active
            ? sortDirection === "ASC"
              ? ", tăng dần"
              : ", giảm dần"
            : ""
        }`}
        aria-pressed={active}
        onClick={() => onSort(field)}
      >
        {label}
        <SortIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </TableHead>
  );
}

function ShipmentTableSkeleton() {
  return (
    <div
      className="space-y-2 rounded-md border p-4"
      role="status"
      aria-label="Đang tải danh sách vận đơn"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ShipmentDataTable({ list }: ShipmentDataTableProps) {
  const actions = useShipmentActions(list.refetch);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedIds = list.selectedPublicIds;
  const allSelected =
    list.items.length > 0 &&
    list.items.every((item) => selectedIds.has(item.public_id));
  const someSelected = list.items.some((item) =>
    selectedIds.has(item.public_id),
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [allSelected, someSelected]);

  const sortBy = (field: ShipmentSortField) => {
    const direction =
      list.sorting.sortBy === field
        ? list.sorting.sortDirection === "ASC"
          ? "DESC"
          : "ASC"
        : field === "created_at"
          ? "DESC"
          : "ASC";
    list.setSorting(field, direction);
  };

  if (!list.canRead) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Không có quyền xem vận đơn"
        description="Cần quyền shipment.read để truy cập danh sách vận đơn."
      />
    );
  }

  if (list.loading && list.items.length === 0) {
    return <ShipmentTableSkeleton />;
  }

  if (list.error && list.items.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Không tải được danh sách vận đơn"
        description={getShipmentErrorMessage(list.error)}
        action={
          <Button type="button" variant="outline" onClick={list.refetch}>
            Thử lại
          </Button>
        }
      />
    );
  }

  if (list.items.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Không tìm thấy vận đơn"
        description="Không có vận đơn phù hợp với điều kiện lọc đang áp dụng."
      />
    );
  }

  return (
    <section className="space-y-3">
      {list.error ? (
        <div
          className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>{getShipmentErrorMessage(list.error)}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={list.refetch}
          >
            Thử lại
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {selectedIds.size > 0
            ? `Đã chọn ${selectedIds.size} vận đơn trên trang này.`
            : "Chọn vận đơn bằng checkbox; thao tác chỉ áp dụng từng dòng."}
        </p>
        {list.refetching ? (
          <span className="inline-flex items-center gap-2" role="status">
            <LoaderCircle
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Đang cập nhật danh sách...
          </span>
        ) : null}
      </div>

      <Table>
        <TableCaption>
          Danh sách vận đơn — tổng cước và COD được hiển thị riêng.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={allSelected}
                aria-label="Chọn tất cả vận đơn trên trang"
                aria-checked={
                  someSelected && !allSelected ? "mixed" : allSelected
                }
                onChange={(event) =>
                  list.setCurrentPageSelection(event.target.checked)
                }
              />
            </TableHead>
            <SortableHeader
              label="Mã vận đơn"
              field="tracking_code"
              sortBy={list.sorting.sortBy}
              sortDirection={list.sorting.sortDirection}
              onSort={sortBy}
            />
            <TableHead className="whitespace-nowrap">Ưu tiên</TableHead>
            <TableHead className="min-w-[150px]">Người gửi</TableHead>
            <TableHead className="whitespace-nowrap">SĐT gửi</TableHead>
            <TableHead className="min-w-[150px]">Người nhận</TableHead>
            <TableHead className="whitespace-nowrap">SĐT nhận</TableHead>
            <TableHead className="min-w-[150px]">Bưu cục gửi</TableHead>
            <TableHead className="min-w-[150px]">Bưu cục nhận</TableHead>
            <TableHead className="whitespace-nowrap">Dịch vụ</TableHead>
            <SortableHeader
              label="Tổng cước"
              field="total_freight_amount"
              alignRight
              sortBy={list.sorting.sortBy}
              sortDirection={list.sorting.sortDirection}
              onSort={sortBy}
            />
            <SortableHeader
              label="COD"
              field="cod_amount"
              alignRight
              sortBy={list.sorting.sortBy}
              sortDirection={list.sorting.sortDirection}
              onSort={sortBy}
            />
            <TableHead className="whitespace-nowrap">Trạng thái</TableHead>
            <SortableHeader
              label="Ngày tạo"
              field="created_at"
              sortBy={list.sorting.sortBy}
              sortDirection={list.sorting.sortDirection}
              onSort={sortBy}
            />
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.items.map((item) => {
            const status = getShipmentStatusPresentation(item.status);
            return (
              <TableRow key={item.public_id}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selectedIds.has(item.public_id)}
                    aria-label={`Chọn vận đơn ${item.tracking_code}`}
                    onChange={(event) =>
                      list.toggleRowSelection(
                        item.public_id,
                        event.target.checked,
                      )
                    }
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">
                  {displayText(item.tracking_code)}
                </TableCell>
                <TableCell>
                  <ShipmentPriorityBadge isPriority={item.is_priority === true} />
                </TableCell>
                <TableCell>{displayText(item.sender_name)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {displayText(item.sender_phone_masked)}
                </TableCell>
                <TableCell>{displayText(item.recipient_name)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {displayText(item.recipient_phone_masked)}
                </TableCell>
                <TableCell>{displayText(item.origin_branch_name)}</TableCell>
                <TableCell>{displayText(item.destination_branch_name)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {displayText(item.service_type_name)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatShipmentAmount(item.total_freight_amount)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatShipmentAmount(item.cod_amount)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {status.status ? (
                    <StatusBadge status={status.status} />
                  ) : (
                    <Badge
                      variant="outline"
                      className={status.className}
                      title="Không cho phép thao tác khi trạng thái chưa được nhận diện."
                    >
                      {status.label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatShipmentCreatedAt(item.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <ShipmentRowActions
                    shipment={item}
                    actions={actions}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ShipmentTablePagination
        pagination={list.pagination}
        pageSize={list.pageSize}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
      />
    </section>
  );
}
