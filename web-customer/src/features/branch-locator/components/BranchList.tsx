import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LogisticsBranch } from "@/features/branch-locator/types/branch-locator.types";

interface BranchListProps {
  branches: LogisticsBranch[];
  selectedBranchId: number | null;
  onSelect: (branch: LogisticsBranch) => void;
}

function getDirectionsUrl(branch: LogisticsBranch): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`;
}

export function BranchList({
  branches,
  selectedBranchId,
  onSelect,
}: BranchListProps) {
  if (branches.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Không tìm thấy bưu cục phù hợp.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
      {branches.map((branch) => {
        const selected = branch.id === selectedBranchId;

        return (
          <Card
            key={branch.id}
            className={selected ? "border-primary ring-1 ring-primary" : ""}
          >
            <CardContent className="space-y-3 p-4">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect(branch)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{branch.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Mã bưu cục: {branch.code}
                    </p>
                  </div>
                  {Boolean(branch.accepts_counter_dropoff) && (
                    <Badge variant="secondary">Nhận gửi tại quầy</Badge>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{branch.address_line}</span>
                  </div>
                  <div className="flex gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{branch.operating_hours || "Chưa cập nhật giờ hoạt động"}</span>
                  </div>
                  <div className="flex gap-2">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{branch.hotline_phone || "Chưa cập nhật hotline"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    GPS: {branch.latitude}, {branch.longitude}
                  </p>
                </div>
              </button>

              <Button asChild variant="outline" size="sm" className="w-full">
                <a
                  href={getDirectionsUrl(branch)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Mở chỉ đường Google Maps
                </a>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
