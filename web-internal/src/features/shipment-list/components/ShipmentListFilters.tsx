import { useEffect, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchOptions } from "@/features/shipment-create/api/shipment-create.api";
import shipmentListMock from "@/mocks/shipment-list.mock.json";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
} from "../constants/shipment-list.constants.ts";
import type { ShipmentFilterValues } from "../types/shipment-list.types";
import type { useShipmentList } from "../hooks/useShipmentList";
import { getShipmentErrorMessage } from "../utils/shipment-list-display";

type ShipmentListState = ReturnType<typeof useShipmentList>;
type ShipmentServiceOption = { id: number; name: string };

const mockBranchOptions = shipmentListMock.data.filter_options.branches;

interface ShipmentListFiltersProps {
  list: ShipmentListState;
}

function filterErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
  ) {
    const firstIssue = error.issues[0];
    if (
      typeof firstIssue === "object" &&
      firstIssue !== null &&
      "message" in firstIssue &&
      typeof firstIssue.message === "string"
    ) {
      return firstIssue.message;
    }
  }

  return getShipmentErrorMessage(
    error,
    "Hãy kiểm tra lại các điều kiện lọc.",
  );
}

export function ShipmentListFilters({ list }: ShipmentListFiltersProps) {
  const [serviceOptions, setServiceOptions] = useState<ShipmentServiceOption[]>(
    [],
  );
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceError, setServiceError] = useState<string | null>(null);

  useEffect(() => {
    if (!list.canRead) {
      setServiceOptions([]);
      setServiceLoading(false);
      setServiceError(null);
      return;
    }

    const controller = new AbortController();
    setServiceLoading(true);
    setServiceError(null);

    void fetchOptions("service-types", null, controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return;
        setServiceOptions(options.map(({ id, name }) => ({ id, name })));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setServiceError(
          getShipmentErrorMessage(
            error,
            "Không tải được danh mục dịch vụ.",
          ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setServiceLoading(false);
      });

    return () => controller.abort();
  }, [list.canRead]);

  const setFilter = <K extends keyof ShipmentFilterValues>(
    key: K,
    value: ShipmentFilterValues[K],
  ) => list.updateDraftFilter(key, value);

  const appliedFilterCount = Object.entries(list.appliedFilters).filter(
    ([key, value]) => key !== "is_priority" && value !== "",
  ).length + (list.appliedFilters.is_priority === "all" ? 0 : 1);
  const mockOnlyBranchFilterSelected =
    list.draftFilters.origin_branch_id !== "" ||
    list.draftFilters.destination_branch_id !== "";

  return (
    <form
      className="space-y-4 rounded-md border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        list.applyFilters();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="shipment-filter-tracking-code">Mã vận đơn</Label>
          <Input
            id="shipment-filter-tracking-code"
            className="text-base sm:text-sm"
            value={list.draftFilters.tracking_code}
            maxLength={35}
            placeholder="Nhập mã vận đơn"
            onChange={(event) =>
              setFilter("tracking_code", event.target.value)
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shipment-filter-phone">SĐT người gửi/nhận</Label>
          <Input
            id="shipment-filter-phone"
            className="text-base sm:text-sm"
            inputMode="tel"
            value={list.draftFilters.phone}
            maxLength={20}
            placeholder="Nhập số điện thoại"
            onChange={(event) => setFilter("phone", event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label
            id="shipment-filter-origin-branch-label"
            htmlFor="shipment-filter-origin-branch"
          >
            Bưu cục gửi
          </Label>
          <Select
            value={list.draftFilters.origin_branch_id || "all"}
            onValueChange={(value) =>
              setFilter("origin_branch_id", value === "all" ? "" : value)
            }
            disabled={!list.canRead || !list.capabilities.branchFilters}
          >
            <SelectTrigger
              id="shipment-filter-origin-branch"
              aria-labelledby="shipment-filter-origin-branch-label"
              aria-describedby="shipment-branch-filter-help"
            >
              <SelectValue placeholder="Tất cả bưu cục gửi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả bưu cục gửi</SelectItem>
              {mockBranchOptions.map((branch) => (
                <SelectItem key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label
            id="shipment-filter-destination-branch-label"
            htmlFor="shipment-filter-destination-branch"
          >
            Bưu cục nhận
          </Label>
          <Select
            value={list.draftFilters.destination_branch_id || "all"}
            onValueChange={(value) =>
              setFilter(
                "destination_branch_id",
                value === "all" ? "" : value,
              )
            }
            disabled={!list.canRead || !list.capabilities.branchFilters}
          >
            <SelectTrigger
              id="shipment-filter-destination-branch"
              aria-labelledby="shipment-filter-destination-branch-label"
              aria-describedby="shipment-branch-filter-help"
            >
              <SelectValue placeholder="Tất cả bưu cục nhận" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả bưu cục nhận</SelectItem>
              {mockBranchOptions.map((branch) => (
                <SelectItem key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label id="shipment-filter-service-label" htmlFor="shipment-filter-service">
            Dịch vụ
          </Label>
          <Select
            value={list.draftFilters.service_type_id || "all"}
            onValueChange={(value) =>
              setFilter("service_type_id", value === "all" ? "" : value)
            }
            disabled={!list.canRead || serviceLoading || serviceError !== null}
          >
            <SelectTrigger
              id="shipment-filter-service"
              aria-labelledby="shipment-filter-service-label"
            >
              <SelectValue
                placeholder={
                  serviceLoading ? "Đang tải dịch vụ..." : "Tất cả dịch vụ"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả dịch vụ</SelectItem>
              {serviceOptions.map((service) => (
                <SelectItem key={service.id} value={String(service.id)}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {serviceError ? (
            <p className="text-xs text-destructive" role="alert">
              {serviceError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label id="shipment-filter-status-label" htmlFor="shipment-filter-status">
            Trạng thái
          </Label>
          <Select
            value={list.draftFilters.status || "all"}
            onValueChange={(value) => {
              if (value === "all") {
                setFilter("status", "");
                return;
              }
              const status = SHIPMENT_STATUSES.find(
                (candidate) => candidate === value,
              );
              if (status) setFilter("status", status);
            }}
            disabled={!list.canRead}
          >
            <SelectTrigger
              id="shipment-filter-status"
              aria-labelledby="shipment-filter-status-label"
            >
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              {SHIPMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {SHIPMENT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shipment-filter-from-date">Từ ngày</Label>
          <Input
            id="shipment-filter-from-date"
            className="text-base sm:text-sm"
            type="date"
            value={list.draftFilters.from_date}
            onChange={(event) => setFilter("from_date", event.target.value)}
            disabled={!list.canRead}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shipment-filter-to-date">Đến ngày</Label>
          <Input
            id="shipment-filter-to-date"
            className="text-base sm:text-sm"
            type="date"
            value={list.draftFilters.to_date}
            onChange={(event) => setFilter("to_date", event.target.value)}
            disabled={!list.canRead}
          />
        </div>

        <div className="space-y-1.5">
          <Label id="shipment-filter-priority-label" htmlFor="shipment-filter-priority">
            Ưu tiên
          </Label>
          <Select
            value={list.draftFilters.is_priority}
            onValueChange={(value) => {
              if (value === "all" || value === "1" || value === "0") {
                setFilter("is_priority", value);
              }
            }}
            disabled={!list.canRead}
          >
            <SelectTrigger
              id="shipment-filter-priority"
              aria-labelledby="shipment-filter-priority-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="1">Ưu tiên</SelectItem>
              <SelectItem value="0">Không ưu tiên</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-xs text-muted-foreground">
          <p id="shipment-branch-filter-help">
            {list.capabilities.branchFilters
              ? "Bộ lọc bưu cục đang chạy MOCK ONLY."
              : "Bộ lọc bưu cục chưa được API hỗ trợ."}
          </p>
          {list.capabilities.branchFilters && mockOnlyBranchFilterSelected ? (
            <p className="mt-1">Kết quả bưu cục chỉ là dữ liệu mock.</p>
          ) : null}
          {list.filterError ? (
            <p className="mt-1 text-destructive" role="alert">
              {filterErrorMessage(list.filterError)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={!list.canRead}
            onClick={list.resetFilters}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Xóa bộ lọc
          </Button>
          <Button type="submit" disabled={!list.canRead}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Áp dụng bộ lọc
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {appliedFilterCount === 0
          ? "Chưa áp dụng điều kiện lọc bổ sung."
          : `Đang áp dụng ${appliedFilterCount} điều kiện lọc.`}
      </p>
    </form>
  );
}
