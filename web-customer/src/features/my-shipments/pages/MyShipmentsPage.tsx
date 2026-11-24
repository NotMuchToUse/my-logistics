import { Eye, PackageSearch, RotateCw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CancelPickupRequestDialog } from "@/features/my-shipments/components/CancelPickupRequestDialog";
import { ShipmentDetailsDialog } from "@/features/my-shipments/components/ShipmentDetailsDialog";
import { useMyShipments } from "@/features/my-shipments/hooks/useMyShipments";
import type {
  PickupRequestRecord,
  ShipmentHistoryRecord,
  ShipmentRecordType,
} from "@/features/my-shipments/types/my-shipments.types";
import type { CancelPickupRequestValues } from "@/features/my-shipments/schemas/my-shipments.schema";
import { getShipmentStatusLabel } from "@/features/tracking/constants/tracking.constants";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const pickupStatusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  assigned: "Đã phân công",
  accepted: "Tài xế đã nhận",
  picked_up: "Đã lấy hàng",
  pickup_failed: "Lấy hàng thất bại",
  cancelled: "Đã hủy",
};

function getCode(record: ShipmentHistoryRecord): string {
  return record.kind === "shipment"
    ? record.tracking_code
    : record.request_code;
}

function getRecordTypeLabel(record: ShipmentHistoryRecord): string {
  return record.kind === "shipment" ? "Vận đơn" : "Yêu cầu lấy hàng";
}

function getRecordAmount(record: ShipmentHistoryRecord): string {
  return record.kind === "shipment"
    ? currencyFormatter.format(record.total_freight_amount)
    : "—";
}

function isCancellable(request: PickupRequestRecord): boolean {
  return request.status === "pending" || request.status === "pending_pickup";
}

export function MyShipmentsPage() {
  const {
    shipments,
    pickupRequests,
    isLoading,
    cancellingPublicId,
    error,
    reload,
    cancelPickupRequest,
    clearError,
  } = useMyShipments();
  const [recordType, setRecordType] = useState<ShipmentRecordType>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [codeFilter, setCodeFilter] = useState("");
  const [selectedRecord, setSelectedRecord] =
    useState<ShipmentHistoryRecord | null>(null);
  const [requestToCancel, setRequestToCancel] =
    useState<PickupRequestRecord | null>(null);

  const records = useMemo(() => {
    const allRecords: ShipmentHistoryRecord[] = [
      ...shipments,
      ...pickupRequests,
    ];
    const normalizedCode = codeFilter.trim().toLocaleLowerCase("vi");

    return allRecords
      .filter((record) => recordType === "all" || record.kind === recordType)
      .filter(
        (record) => statusFilter === "all" || record.status === statusFilter,
      )
      .filter(
        (record) =>
          !normalizedCode ||
          [getCode(record), record.public_id]
            .some((value) =>
              value.toLocaleLowerCase("vi").includes(normalizedCode),
            ) ||
          (record.kind === "pickup_request" &&
            record.tracking_code
              ?.toLocaleLowerCase("vi")
              .includes(normalizedCode)),
      )
      .sort(
        (first, second) =>
          new Date(second.created_at.replace(" ", "T")).getTime() -
          new Date(first.created_at.replace(" ", "T")).getTime(),
      );
  }, [shipments, pickupRequests, recordType, statusFilter, codeFilter]);

  const availableStatuses = useMemo(
    () => {
      const statuses = new Set<string>(
        [...shipments, ...pickupRequests].map((record) => record.status),
      );

      if (statusFilter !== "all") {
        statuses.add(statusFilter);
      }

      return Array.from(statuses);
    },
    [shipments, pickupRequests, statusFilter],
  );

  const linkedShipment =
    selectedRecord?.kind === "pickup_request"
      ? shipments.find(
          (shipment) =>
            shipment.tracking_code === selectedRecord.tracking_code,
        )
      : undefined;

  async function handleCancel(
    request: PickupRequestRecord,
    values: CancelPickupRequestValues,
  ): Promise<boolean> {
    return cancelPickupRequest(request, values.reason);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <PackageSearch
              className="h-6 w-6 text-primary"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold tracking-tight">
              Lịch sử vận đơn
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Theo dõi vận đơn, yêu cầu lấy hàng và hành trình giao nhận.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => void reload()}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Làm mới
        </Button>
      </header>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="shipment-record-type" className="text-sm font-medium">
              Loại bản ghi
            </label>
            <Select
              value={recordType}
              onValueChange={(value) =>
                setRecordType(value as ShipmentRecordType)
              }
            >
              <SelectTrigger id="shipment-record-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="shipment">Vận đơn</SelectItem>
                <SelectItem value="pickup_request">Yêu cầu lấy hàng</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="shipment-status-filter" className="text-sm font-medium">
              Trạng thái
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="shipment-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {availableStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {pickupStatusLabels[status] ??
                      getShipmentStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="shipment-code-filter" className="text-sm font-medium">
              Mã vận đơn / mã yêu cầu
            </label>
            <Input
              id="shipment-code-filter"
              value={codeFilter}
              onChange={(event) => setCodeFilter(event.target.value)}
              placeholder="Nhập mã cần tìm"
              type="search"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center"
        >
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reload()}
          >
            Thử lại
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Đang tải lịch sử...
            </p>
          ) : records.length === 0 ? (
            <div className="py-10 text-center">
              <PackageSearch
                className="mx-auto h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-3 font-medium">Không có bản ghi phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Cước phí</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={`${record.kind}-${record.public_id}`}>
                    <TableCell className="font-medium">
                      <span>{getCode(record)}</span>
                      {record.kind === "pickup_request" &&
                        record.tracking_code && (
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            {record.tracking_code}
                          </span>
                        )}
                    </TableCell>
                    <TableCell>{getRecordTypeLabel(record)}</TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "medium",
                      }).format(
                        new Date(record.created_at.replace(" ", "T")),
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {getRecordAmount(record)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Chi tiết
                        </Button>
                        {record.kind === "pickup_request" &&
                          isCancellable(record) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={cancellingPublicId === record.public_id}
                              onClick={() => {
                                clearError();
                                setRequestToCancel(record);
                              }}
                            >
                              <XCircle className="h-4 w-4" aria-hidden="true" />
                              Hủy yêu cầu
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ShipmentDetailsDialog
        record={selectedRecord}
        shipment={linkedShipment}
        open={selectedRecord !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecord(null);
          }
        }}
      />
      <CancelPickupRequestDialog
        request={requestToCancel}
        open={requestToCancel !== null}
        isLoading={cancellingPublicId !== null}
        submitError={error}
        onOpenChange={(open) => {
          if (!open && cancellingPublicId === null) {
            setRequestToCancel(null);
          }
        }}
        onConfirm={handleCancel}
      />
    </section>
  );
}
