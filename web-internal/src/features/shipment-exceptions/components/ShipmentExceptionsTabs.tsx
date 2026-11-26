import { type FormEvent } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ShipmentExceptionsTable } from "@/features/shipment-exceptions/components/ShipmentExceptionsTable";
import type { ShipmentExceptionsTableProps } from "@/features/shipment-exceptions/components/ShipmentExceptionsTable";
import type { useShipmentExceptions } from "@/features/shipment-exceptions/hooks/useShipmentExceptions";
import type { ShipmentExceptionsTab } from "@/features/shipment-exceptions/types/shipment-exceptions.types";

type ShipmentExceptionsHookState = ReturnType<typeof useShipmentExceptions>;

export type ShipmentExceptionsTabsProps = Omit<
  ShipmentExceptionsTableProps,
  "activeTab"
> &
  Pick<
    ShipmentExceptionsHookState,
    | "activeTab"
    | "dataSource"
    | "isReadOnlyMockPreview"
    | "refresh"
    | "searchTerm"
    | "setActiveTab"
    | "setSearchTerm"
  >;

function isShipmentExceptionsTab(value: string): value is ShipmentExceptionsTab {
  return value === "exceptions" || value === "pending-return";
}

export function ShipmentExceptionsTabs({
  activeTab,
  capabilities,
  dataSource,
  errorKind,
  isEmpty,
  isError,
  isLoading,
  isReadOnlyMockPreview,
  isRefreshing,
  isSearchEmpty,
  onOpenForward,
  onOpenReturn,
  pagination,
  refresh,
  retry,
  searchTerm,
  setActiveTab,
  setPage,
  setSearchTerm,
  shipments,
}: ShipmentExceptionsTabsProps) {
  const tableProps: ShipmentExceptionsTableProps = {
    activeTab,
    capabilities,
    errorKind,
    isEmpty,
    isError,
    isLoading,
    isRefreshing,
    isSearchEmpty,
    onOpenForward,
    onOpenReturn,
    pagination,
    retry,
    setPage,
    shipments,
  };

  const handleTabChange = (value: string) => {
    if (isShipmentExceptionsTab(value)) {
      setActiveTab(value);
    }
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList
            aria-label="Trạng thái xử lý vận đơn"
            className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto"
          >
            <TabsTrigger
              value="exceptions"
              className="h-auto min-h-10 whitespace-normal px-2 text-center leading-tight sm:px-3"
            >
              Ngoại lệ vận đơn
            </TabsTrigger>
            <TabsTrigger
              value="pending-return"
              className="h-auto min-h-10 whitespace-normal px-2 text-center leading-tight sm:px-3"
            >
              Chờ chuyển hoàn
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 sm:min-w-0 sm:flex-1 sm:flex-row sm:items-end sm:justify-end">
            <form
              aria-label="Tìm kiếm vận đơn"
              className="flex min-w-0 flex-1 items-end gap-2"
              onSubmit={handleSearchSubmit}
              role="search"
            >
              <div className="min-w-0 flex-1">
                <label
                  className="mb-1 block text-sm font-medium"
                  htmlFor="shipment-exceptions-search"
                >
                  Tìm theo mã vận đơn
                </label>
                <Input
                  autoComplete="off"
                  id="shipment-exceptions-search"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Nhập mã vận đơn"
                  type="search"
                  value={searchTerm}
                />
              </div>
              {searchTerm && (
                <Button
                  aria-label="Xóa tìm kiếm"
                  onClick={() => setSearchTerm("")}
                  size="icon"
                  title="Xóa tìm kiếm"
                  type="button"
                  variant="outline"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              )}
            </form>

            <Button
              aria-label={
                isRefreshing ? "Đang tải lại danh sách" : "Tải lại danh sách"
              }
              disabled={isLoading || isRefreshing}
              onClick={refresh}
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4${isRefreshing ? " animate-spin" : ""}`}
              />
              <span>
                {isRefreshing ? "Đang tải lại..." : "Tải lại danh sách"}
              </span>
            </Button>
          </div>
        </div>

        {dataSource === "mock" && (
          <p
            className="mt-4 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground"
            role="note"
          >
            {isReadOnlyMockPreview
              ? "Bản xem trước dữ liệu mô phỏng ở chế độ chỉ đọc; chưa có quyền đọc vận đơn trên Backend."
              : "Dữ liệu mô phỏng — chưa kết nối nghiệp vụ tạo vận đơn."}
          </p>
        )}

        <TabsContent className="mt-4 space-y-3" value="exceptions">
          <p className="text-sm text-muted-foreground">
            Theo dõi các vận đơn giao thất bại hoặc gặp sự cố cần xử lý.
          </p>
          {activeTab === "exceptions" && (
            <ShipmentExceptionsTable {...tableProps} />
          )}
        </TabsContent>

        <TabsContent className="mt-4 space-y-3" value="pending-return">
          <p className="text-sm text-muted-foreground">
            Theo dõi các vận đơn đang chờ xử lý chuyển hoàn.
          </p>
          {activeTab === "pending-return" && (
            <ShipmentExceptionsTable {...tableProps} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
