import { ArrowRight, Clock3, PackageCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatTrackingDate,
  getBranchLocation,
  getBranchNameAndCode,
  getShipmentStatusLabel,
  getServiceName,
  getTrackingTimestamp,
  maskPhoneNumber,
} from "@/features/tracking/constants/tracking.constants";
import type { PublicTrackingShipment } from "@/features/tracking/types/tracking.types";

interface ShipmentSummaryCardProps {
  shipment: PublicTrackingShipment;
}

export function ShipmentSummaryCard({
  shipment,
}: ShipmentSummaryCardProps) {
  const latestHistory = shipment.shipment_status_history
    .filter(
      (item) =>
        item.is_public_visible === undefined ||
        item.is_public_visible === true ||
        item.is_public_visible === 1,
    )
    .reduce<string | undefined>(
      (latest, item) =>
        !latest ||
        getTrackingTimestamp(item.occurred_at) > getTrackingTimestamp(latest)
          ? item.occurred_at
          : latest,
      undefined,
    );
  const lastUpdated = shipment.updated_at ?? latestHistory ?? shipment.created_at;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardDescription>Mã vận đơn</CardDescription>
          <CardTitle className="text-xl">{shipment.tracking_code}</CardTitle>
        </div>
        <Badge variant="secondary" className="w-fit">
          {getShipmentStatusLabel(shipment.status)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div>
            <p className="text-xs text-muted-foreground">Nơi gửi</p>
            <p className="mt-1 font-medium">
              {getBranchNameAndCode(shipment.origin_branch_id)}
            </p>
            <p className="text-sm text-muted-foreground">
              {getBranchLocation(shipment.origin_branch_id)}
            </p>
          </div>
          <ArrowRight
            className="hidden h-5 w-5 text-muted-foreground sm:block"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs text-muted-foreground">Nơi nhận</p>
            <p className="mt-1 font-medium">
              {getBranchNameAndCode(shipment.destination_branch_id)}
            </p>
            <p className="text-sm text-muted-foreground">
              {getBranchLocation(shipment.destination_branch_id)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <UserRound
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Người gửi</p>
              <p className="font-medium">{shipment.sender_name}</p>
              <p className="text-sm text-muted-foreground">
                {maskPhoneNumber(shipment.sender_phone_masked)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <UserRound
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Người nhận</p>
              <p className="font-medium">{shipment.recipient_name}</p>
              <p className="text-sm text-muted-foreground">
                {maskPhoneNumber(shipment.recipient_phone_masked)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PackageCheck
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs text-muted-foreground">Dịch vụ</p>
              <p className="font-medium">
                {getServiceName(shipment.service_type_id)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock3
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs text-muted-foreground">Cập nhật lần cuối</p>
              <p className="font-medium">{formatTrackingDate(lastUpdated)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
