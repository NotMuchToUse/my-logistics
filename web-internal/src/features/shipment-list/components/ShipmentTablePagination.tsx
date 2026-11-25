import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHIPMENT_PAGE_SIZE_OPTIONS } from "../constants/shipment-list.constants.ts";
import type { ShipmentPagination } from "../types/shipment-list.types";

interface ShipmentTablePaginationProps {
  pagination: ShipmentPagination;
  pageSize: number;
  onPageChange: (page: number) => boolean;
  onPageSizeChange: (pageSize: number) => boolean;
}

export function ShipmentTablePagination({
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ShipmentTablePaginationProps) {
  const pageCount = pagination.total_pages;

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground" aria-live="polite">
        {pagination.total.toLocaleString("vi-VN")} vận đơn
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="shipment-page-size" className="whitespace-nowrap">
            Số dòng
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const nextPageSize = Number(value);
              if (Number.isInteger(nextPageSize)) {
                onPageSizeChange(nextPageSize);
              }
            }}
          >
            <SelectTrigger
              id="shipment-page-size"
              className="w-[90px]"
              aria-label="Số dòng mỗi trang"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIPMENT_PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <p className="min-w-[7rem] text-center text-muted-foreground">
            Trang {pageCount === 0 ? 0 : pagination.page} / {pageCount}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1 || pageCount === 0}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageCount === 0 || pagination.page >= pageCount}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
