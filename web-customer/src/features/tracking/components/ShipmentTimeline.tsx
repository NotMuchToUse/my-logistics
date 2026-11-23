import { MapPin, PackageCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatTrackingDate,
  getBranchLocation,
  getBranchNameAndCode,
  getShipmentStatusLabel,
  getTrackingTimestamp,
  getTimelineBranchIds,
} from "@/features/tracking/constants/tracking.constants";
import type { PublicTrackingShipment } from "@/features/tracking/types/tracking.types";

interface ShipmentTimelineProps {
  shipment: PublicTrackingShipment;
}

export function ShipmentTimeline({ shipment }: ShipmentTimelineProps) {
  const history = shipment.shipment_status_history
    .filter(
      (item) =>
        item.is_public_visible === undefined ||
        item.is_public_visible === true ||
        item.is_public_visible === 1,
    )
    .slice()
    .sort(
      (first, second) =>
        getTrackingTimestamp(first.occurred_at) -
        getTrackingTimestamp(second.occurred_at),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Hành trình vận đơn</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có cập nhật hành trình công khai.
          </p>
        ) : (
          <ol className="space-y-0">
            {history.map((item, index) => {
              const branchIds = getTimelineBranchIds(
                item.to_status,
                shipment,
              );

              return (
                <li
                  key={`${item.occurred_at}-${item.to_status}-${index}`}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  {index < history.length - 1 && (
                    <span
                      className="absolute bottom-0 left-[11px] top-6 w-px bg-border"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                      <p className="font-medium">
                        {getShipmentStatusLabel(item.to_status)}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {formatTrackingDate(item.occurred_at)}
                      </time>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {branchIds.map((branchId, branchIndex) => (
                        <span
                          key={branchId}
                          className="inline-flex items-center gap-2"
                        >
                          {branchIndex > 0 && <span aria-hidden="true">→</span>}
                          <span>
                            {getBranchNameAndCode(branchId)}
                            {getBranchLocation(branchId) &&
                              ` — ${getBranchLocation(branchId)}`}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
