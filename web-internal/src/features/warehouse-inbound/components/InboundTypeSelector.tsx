import { useId } from "react";
import {
  CheckCircle2,
  PackagePlus,
  RotateCcw,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WAREHOUSE_INBOUND_OPTIONS } from "../constants/warehouse-inbound.constants";
import type { WarehouseInboundType } from "../types/warehouse-inbound.types";

const INBOUND_ICONS = {
  new_pickup: PackagePlus,
  linehaul_in: Truck,
  redelivery: RotateCcw,
  counter_created: Store,
} satisfies Record<WarehouseInboundType, LucideIcon>;

export interface InboundTypeSelectorProps {
  value: WarehouseInboundType;
  onChange: (value: WarehouseInboundType) => void;
  disabled?: boolean;
}

export function InboundTypeSelector({
  value,
  onChange,
  disabled = false,
}: InboundTypeSelectorProps) {
  const groupId = useId();
  const descriptionId = `${groupId}-locked`;

  return (
    <div className="space-y-2">
      <fieldset disabled={disabled} aria-describedby={disabled ? descriptionId : undefined}>
        <legend className="mb-3 text-sm font-medium">Phân loại nhập kho</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WAREHOUSE_INBOUND_OPTIONS.map((option) => {
            const Icon = INBOUND_ICONS[option.value];
            const selected = value === option.value;

            return (
              <label key={option.value} className={cn("block", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
                <input
                  type="radio"
                  name={groupId}
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange(option.value)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex min-h-24 flex-col gap-3 rounded-md border p-4 text-sm transition-colors",
                    "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                    selected
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-input bg-background text-foreground",
                    disabled ? "opacity-60" : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {selected && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="font-medium">{option.label}</span>
                  {selected && <span className="text-xs" aria-hidden="true">Đang chọn</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {disabled && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          Không thể đổi phân loại khi phiên quét có dữ liệu hoặc đang xử lý.
        </p>
      )}
    </div>
  );
}
