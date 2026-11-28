import { useRef, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  PackagePlus,
  QrCode,
  ScanBarcode,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OUTBOUND_SHIPMENT_STATUS_META } from "../constants/warehouse-outbound-delivery.constants";
import type { ScanFeedbackState } from "../hooks/useWarehouseOutboundDelivery";
import { scanOutboundShipmentSchema } from "../schemas/warehouse-outbound-delivery.schema";
import type { AvailableDeliveryShipment } from "../types/warehouse-outbound-delivery.types";

interface OutboundDeliveryScannerCardProps {
  disabled: boolean;
  scanCode: string;
  onScanCodeChange: (value: string) => void;
  isScanning: boolean;
  lastScanFeedback: ScanFeedbackState | null;
  availableShipments: AvailableDeliveryShipment[];
  onScanShipment: (code?: string) => Promise<boolean>;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đ`;
}

export function OutboundDeliveryScannerCard({
  disabled,
  scanCode,
  onScanCodeChange,
  isScanning,
  lastScanFeedback,
  availableShipments,
  onScanShipment,
}: OutboundDeliveryScannerCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = scanOutboundShipmentSchema.safeParse({
      tracking_code: scanCode,
    });
    if (!parsed.success) {
      await onScanShipment(scanCode);
      inputRef.current?.focus();
      return;
    }

    await onScanShipment(parsed.data.tracking_code);
    inputRef.current?.focus();
  }

  async function handleQuickScan(trackingCode: string) {
    await onScanShipment(trackingCode);
    inputRef.current?.focus();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScanBarcode className="h-5 w-5 text-primary" aria-hidden="true" />
          Bước 2: Quét barcode vận đơn cần giao
        </CardTitle>
        <CardDescription>
          Dùng máy quét mã vạch hoặc nhập tay mã vận đơn và nhấn Enter để thêm vào phiếu xuất giao.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="outbound-delivery-barcode-input">Mã vận đơn (Barcode)</Label>
            <Input
              ref={inputRef}
              id="outbound-delivery-barcode-input"
              value={scanCode}
              onChange={(event) => onScanCodeChange(event.target.value.toUpperCase())}
              placeholder={
                disabled
                  ? "Khởi tạo phiếu xuất giao ở Bước 1 trước khi quét..."
                  : "Quét hoặc nhập mã vận đơn (VD: VSDN261128002)"
              }
              autoComplete="off"
              disabled={disabled || isScanning}
            />
          </div>
          <Button
            type="submit"
            className="sm:mt-8"
            disabled={disabled || isScanning || !scanCode.trim()}
          >
            {isScanning ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Đang quét...
              </>
            ) : (
              <>
                <PackagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                Thêm vào phiếu
              </>
            )}
          </Button>
        </form>

        {lastScanFeedback && (
          <div
            role={lastScanFeedback.type === "error" ? "alert" : "status"}
            className={`flex items-start gap-2.5 rounded-md border p-3 text-sm ${
              lastScanFeedback.type === "error"
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            {lastScanFeedback.type === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <span className="font-mono font-semibold">{lastScanFeedback.code}: </span>
              <span>{lastScanFeedback.message}</span>
            </div>
          </div>
        )}

        {!disabled && availableShipments.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                Vận đơn tồn kho tại bưu cục sẵn sàng giao ({availableShipments.length} đơn)
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableShipments.map((shipment) => {
                const statusMeta = OUTBOUND_SHIPMENT_STATUS_META[shipment.status];
                return (
                  <div
                    key={shipment.shipment_id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background p-2.5 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-foreground">
                          {shipment.tracking_code}
                        </span>
                        {statusMeta && (
                          <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${statusMeta.className}`}>
                            {statusMeta.label}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-muted-foreground">
                        {shipment.recipient_name} · COD: {formatCurrency(shipment.cod_amount)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isScanning}
                      onClick={() => void handleQuickScan(shipment.tracking_code)}
                    >
                      Quét
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
