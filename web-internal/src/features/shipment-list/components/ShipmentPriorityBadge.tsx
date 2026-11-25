import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShipmentPriorityBadgeProps {
  isPriority: boolean;
}

export function ShipmentPriorityBadge({
  isPriority,
}: ShipmentPriorityBadgeProps) {
  if (!isPriority) {
    return (
      <Badge
        variant="outline"
        className="whitespace-nowrap border-slate-200 bg-slate-100 text-slate-600"
      >
        Không ưu tiên
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 whitespace-nowrap border-amber-200 bg-amber-50 text-amber-800"
    >
      <Flag className="h-3 w-3" aria-hidden="true" />
      Ưu tiên
    </Badge>
  );
}
