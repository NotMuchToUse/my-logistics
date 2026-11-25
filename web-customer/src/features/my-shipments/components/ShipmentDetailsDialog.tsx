import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTrackingDate } from "@/features/tracking/constants/tracking.constants";
import { ShipmentTimeline } from "@/features/tracking/components/ShipmentTimeline";
import type {
  PickupRequestRecord,
  ShipmentHistoryRecord,
  ShipmentRecord,
} from "@/features/my-shipments/types/my-shipments.types";

interface ShipmentDetailsDialogProps {
  record: ShipmentHistoryRecord | null;
  shipment: ShipmentRecord | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function getRecordCode(record: ShipmentHistoryRecord): string {
  return record.kind === "shipment" ? record.tracking_code : record.request_code;
}

function getAssociatedShipment(
  record: ShipmentHistoryRecord,
  shipment: ShipmentRecord | undefined,
): ShipmentRecord | undefined {
  return record.kind === "shipment" ? record : record.shipment ?? shipment;
}

function PickupRequestSummary({
  request,
}: {
  request: PickupRequestRecord;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Thông tin yêu cầu lấy hàng</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Mã yêu cầu: </span>
          {request.request_code}
        </p>
        {request.tracking_code && (
          <p>
            <span className="text-muted-foreground">Mã vận đơn: </span>
            {request.tracking_code}
          </p>
        )}
        {request.pickup_type && (
          <p>
            <span className="text-muted-foreground">Hình thức: </span>
            {request.pickup_type === "driver_pickup"
              ? "Tài xế đến lấy"
              : request.pickup_type}
          </p>
        )}
        {request.pickup_address && (
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Địa chỉ lấy hàng: </span>
            {request.pickup_address}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ShipmentDetailsDialog({
  record,
  shipment: linkedShipment,
  open,
  onOpenChange,
}: ShipmentDetailsDialogProps) {
  if (!record) {
    return null;
  }

  const shipment = getAssociatedShipment(record, linkedShipment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {record.kind === "shipment" ? "Chi tiết vận đơn" : "Chi tiết yêu cầu lấy hàng"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Thông tin chi tiết bản ghi, kiện hàng, cước phí và hành trình.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-lg font-semibold">{getRecordCode(record)}</p>
                <p className="text-sm text-muted-foreground">
                  Tạo lúc {formatTrackingDate(record.created_at)}
                </p>
              </div>
              <StatusBadge status={record.status} />
            </CardContent>
          </Card>

          {record.kind === "pickup_request" && (
            <PickupRequestSummary request={record} />
          )}

          {shipment ? (
            <>
              {(shipment.sender_name ||
                shipment.recipient_name ||
                shipment.sender_address ||
                shipment.recipient_address) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Thông tin giao nhận</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="font-medium">Người gửi</p>
                      <p>{shipment.sender_name ?? "Chưa có thông tin"}</p>
                      {shipment.sender_phone_masked && (
                        <p className="text-muted-foreground">
                          {shipment.sender_phone_masked}
                        </p>
                      )}
                      {shipment.sender_address && (
                        <p className="text-muted-foreground">
                          {shipment.sender_address}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Người nhận</p>
                      <p>{shipment.recipient_name ?? "Chưa có thông tin"}</p>
                      {shipment.recipient_phone_masked && (
                        <p className="text-muted-foreground">
                          {shipment.recipient_phone_masked}
                        </p>
                      )}
                      {shipment.recipient_address && (
                        <p className="text-muted-foreground">
                          {shipment.recipient_address}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Kiện hàng ({shipment.parcel_count})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {shipment.shipment_parcels.map((parcel) => (
                    <div
                      key={parcel.parcel_barcode}
                      className="rounded-md border p-3 text-sm"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-medium">
                          Kiện {parcel.parcel_index} · {parcel.parcel_barcode}
                        </p>
                        <p className="text-muted-foreground">
                          {parcel.chargeable_weight_gram.toLocaleString("vi-VN")} g
                        </p>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {parcel.description} · {parcel.length_cm} ×{" "}
                        {parcel.width_cm} × {parcel.height_cm} cm
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cước phí & COD</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <MoneyRow
                    label="Cước chính"
                    amount={shipment.base_freight_amount}
                  />
                  <MoneyRow
                    label="Phụ phí"
                    amount={shipment.surcharge_amount ?? 0}
                  />
                  <MoneyRow label="Dịch vụ cộng thêm" amount={shipment.vas_amount ?? 0} />
                  <MoneyRow label="VAT" amount={shipment.vat_amount ?? 0} />
                  <div className="border-t pt-2">
                    <MoneyRow
                      label="Tổng cước"
                      amount={shipment.total_freight_amount}
                      emphasized
                    />
                  </div>
                  <MoneyRow label="Thu hộ COD" amount={shipment.cod_amount} />
                </CardContent>
              </Card>

              <ShipmentTimeline shipment={shipment} />
            </>
          ) : (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Chưa có thông tin kiện hàng hoặc hành trình liên kết với yêu cầu này.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoneyRow({
  label,
  amount,
  emphasized = false,
}: {
  label: string;
  amount: number;
  emphasized?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${emphasized ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{currencyFormatter.format(amount)}</span>
    </div>
  );
}
