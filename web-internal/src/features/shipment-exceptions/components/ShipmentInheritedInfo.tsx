import { Info, Package, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVndCurrency } from "@/core/utils/formatters";
import type { useShipmentExceptions } from "@/features/shipment-exceptions/hooks/useShipmentExceptions";
import type { ShipmentType } from "@/features/shipment-exceptions/types/shipment-exceptions.types";

export type ShipmentInheritedInfoProps = Pick<
  ReturnType<typeof useShipmentExceptions>,
  | "selectedShipment"
  | "inheritedInfo"
  | "inheritedInfoStatus"
>;

function getOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getCodLabel(value: number | string | null | undefined): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0
      ? formatVndCurrency(value)
      : null;
  }

  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? formatVndCurrency(amount) : null;
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

function InformationItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode | null;
}) {
  if (children === null) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

export function ShipmentInheritedInfo({
  selectedShipment,
  inheritedInfo,
  inheritedInfoStatus,
}: ShipmentInheritedInfoProps) {
  const detailMatchesSelected =
    inheritedInfoStatus === "ready" &&
    selectedShipment !== null &&
    inheritedInfo !== null &&
    inheritedInfo.public_id === selectedShipment.public_id;
  const detail = detailMatchesSelected ? inheritedInfo : null;

  const recipientName =
    getOptionalText(detail?.recipient_name) ??
    getOptionalText(selectedShipment?.recipient_name);
  const recipientPhone =
    getOptionalText(detail?.recipient_phone_masked) ??
    getOptionalText(selectedShipment?.recipient_phone_masked);
  const codLabel = getCodLabel(
    detail?.cod_amount ?? selectedShipment?.cod_amount,
  );
  const shipmentType =
    detail?.shipment_type ?? selectedShipment?.shipment_type;
  const parcelCount = detail?.parcel_count;
  const deliveryAttemptCount = selectedShipment?.delivery_attempt_count;

  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 sm:p-5">
        <CardTitle className="text-lg">Thông tin vận đơn gốc</CardTitle>
        <CardDescription>
          Thông tin chỉ đọc để tham khảo trong thao tác hiện tại.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        {selectedShipment === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            Chưa có vận đơn được chọn để hiển thị thông tin.
          </p>
        ) : (
          <>
            <section aria-labelledby="shipment-inherited-general">
              <h4
                id="shipment-inherited-general"
                className="mb-3 text-sm font-semibold"
              >
                Thông tin chung
              </h4>
              <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <InformationItem label="Mã vận đơn">
                  {selectedShipment.tracking_code}
                </InformationItem>
                <InformationItem label="Trạng thái">
                  <StatusBadge status={selectedShipment.status} />
                </InformationItem>
                <InformationItem label="Loại vận đơn">
                  {getShipmentTypeLabel(shipmentType)}
                </InformationItem>
                <InformationItem label="Số lần giao">
                  {deliveryAttemptCount === undefined
                    ? "Chưa có thông tin"
                    : deliveryAttemptCount}
                </InformationItem>
                <InformationItem label="Tiền thu hộ (COD)">
                  {codLabel ?? "Chưa có thông tin"}
                </InformationItem>
                {parcelCount !== undefined && (
                  <InformationItem label="Số kiện hàng">
                    {parcelCount}
                  </InformationItem>
                )}
              </dl>
            </section>

            {inheritedInfoStatus === "loading" && (
              <div
                className="space-y-2"
                role="status"
                aria-live="polite"
                aria-label="Đang tải thông tin chi tiết vận đơn gốc"
              >
                <Skeleton className="h-4 w-36" aria-hidden="true" />
                <Skeleton className="h-10 w-full" aria-hidden="true" />
                <span className="sr-only">
                  Đang tải thông tin chi tiết vận đơn gốc.
                </span>
              </div>
            )}

            {inheritedInfoStatus === "error" && (
              <p className="text-sm text-destructive" role="alert">
                Không thể tải thông tin chi tiết. Các thông tin danh sách của
                đúng vận đơn đang chọn vẫn được giữ lại nếu có.
              </p>
            )}

            {inheritedInfoStatus === "unavailable" && (
              <p className="text-sm text-muted-foreground" role="status">
                Thông tin chi tiết vận đơn gốc hiện chưa khả dụng.
              </p>
            )}

            {inheritedInfoStatus === "ready" &&
              inheritedInfo !== null &&
              !detailMatchesSelected && (
                <p className="text-sm text-muted-foreground" role="status">
                  Thông tin chi tiết không khớp với vận đơn đang chọn nên không
                  được hiển thị.
                </p>
              )}

            {inheritedInfoStatus === "idle" && (
              <p className="text-sm text-muted-foreground" role="status">
                Chưa tải thông tin chi tiết vận đơn gốc.
              </p>
            )}

            {detail !== null && (
              <>
                <Separator />
                <section aria-labelledby="shipment-inherited-sender">
                  <h4
                    id="shipment-inherited-sender"
                    className="mb-3 flex items-center gap-2 text-sm font-semibold"
                  >
                    <UserRound
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Người gửi
                  </h4>
                  <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <InformationItem label="Họ tên">
                      {getOptionalText(detail.sender_name)}
                    </InformationItem>
                    <InformationItem label="Số điện thoại">
                      {getOptionalText(detail.sender_phone_masked)}
                    </InformationItem>
                    <InformationItem label="Địa chỉ">
                      {getOptionalText(detail.sender_address)}
                    </InformationItem>
                  </dl>
                </section>
                <Separator />
              </>
            )}

            {(detail !== null ||
              recipientName !== null ||
              recipientPhone !== null) && (
              <>
                {detail === null && <Separator />}
                <section aria-labelledby="shipment-inherited-recipient">
                  <h4
                    id="shipment-inherited-recipient"
                    className="mb-3 flex items-center gap-2 text-sm font-semibold"
                  >
                    <UserRound
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Người nhận
                  </h4>
                  <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <InformationItem label="Họ tên">{recipientName}</InformationItem>
                    <InformationItem label="Số điện thoại">
                      {recipientPhone}
                    </InformationItem>
                    <InformationItem label="Địa chỉ">
                      {getOptionalText(detail?.recipient_address)}
                    </InformationItem>
                  </dl>
                </section>
              </>
            )}

            {detail !== null && (
              <>
                <Separator />
                <section aria-labelledby="shipment-inherited-parcels">
                  <h4
                    id="shipment-inherited-parcels"
                    className="mb-3 flex items-center gap-2 text-sm font-semibold"
                  >
                    <Package
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Hàng hóa
                  </h4>
                  <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <InformationItem label="Số kiện hàng">
                      {detail.parcel_count}
                    </InformationItem>
                  </dl>
                </section>
              </>
            )}

            <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                Đây là dữ liệu tham chiếu của vận đơn gốc. Chưa xác nhận trường
                nào sẽ được kế thừa, quy tắc chuyển hoàn, hay trạng thái của
                vận đơn mới và vận đơn gốc sau thao tác.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
