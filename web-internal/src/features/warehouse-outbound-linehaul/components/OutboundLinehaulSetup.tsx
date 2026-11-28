import { Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  OutboundPartner,
  OutboundTransportMode,
  OutboundVehicle,
  WarehouseOption,
} from "../types/warehouse-outbound-linehaul.types";

interface OutboundLinehaulSetupProps {
  originWarehouse: WarehouseOption | null;
  targetWarehouseId: number;
  warehouses: WarehouseOption[];
  onTargetWarehouseChange: (warehouseId: number) => void;
  transportMode: OutboundTransportMode;
  onTransportModeChange: (mode: OutboundTransportMode) => void;
  vehicles: OutboundVehicle[];
  vehicleId: number | null;
  onVehicleChange: (vehicleId: number) => void;
  partners: OutboundPartner[];
  partnerId: number | null;
  onPartnerChange: (partnerId: number) => void;
  mawbNumber: string;
  onMawbNumberChange: (value: string) => void;
  isMawbRequired: boolean;
}

export function OutboundLinehaulSetup({
  originWarehouse,
  targetWarehouseId,
  warehouses,
  onTargetWarehouseChange,
  transportMode,
  onTransportModeChange,
  vehicles,
  vehicleId,
  onVehicleChange,
  partners,
  partnerId,
  onPartnerChange,
  mawbNumber,
  onMawbNumberChange,
  isMawbRequired,
}: OutboundLinehaulSetupProps) {
  const targetOptions = warehouses.filter(
    (warehouse) => warehouse.id !== originWarehouse?.id,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="h-5 w-5" aria-hidden="true" />
          Thông tin chuyến trung chuyển
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Kho xuất hiện tại</Label>
          <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
            {originWarehouse
              ? `${originWarehouse.code} — ${originWarehouse.name}`
              : "Chưa có kho xuất trong dữ liệu demo"}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="linehaul-target-warehouse">Kho nhận</Label>
          <Select
            value={String(targetWarehouseId)}
            onValueChange={(value) => onTargetWarehouseChange(Number(value))}
          >
            <SelectTrigger id="linehaul-target-warehouse">
              <SelectValue placeholder="Chọn kho nhận" />
            </SelectTrigger>
            <SelectContent>
              {targetOptions.map((warehouse) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.code} — {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="space-y-3 md:col-span-2">
          <legend className="text-sm font-medium">Hình thức vận chuyển</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input
                type="radio"
                name="linehaul-transport-mode"
                value="vehicle"
                checked={transportMode === "vehicle"}
                onChange={() => onTransportModeChange("vehicle")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">Phương tiện nội bộ</span>
                <span className="block text-xs text-muted-foreground">
                  Chọn xe và kiểm tra tải trọng tối đa.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input
                type="radio"
                name="linehaul-transport-mode"
                value="partner"
                checked={transportMode === "partner"}
                onChange={() => onTransportModeChange("partner")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">Đối tác vận chuyển</span>
                <span className="block text-xs text-muted-foreground">
                  Đại lý hàng không cần số MAWB.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {transportMode === "vehicle" ? (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="linehaul-vehicle">Xe sẵn sàng</Label>
            <Select
              value={vehicleId === null ? "" : String(vehicleId)}
              onValueChange={(value) => onVehicleChange(Number(value))}
            >
              <SelectTrigger id="linehaul-vehicle">
                <SelectValue placeholder="Chọn phương tiện" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                    {vehicle.plate_number} · {vehicle.vehicle_type} · tối đa{" "}
                    {Number(vehicle.max_payload_kg).toLocaleString("vi-VN")} kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vehicles.length === 0 && (
              <p className="text-sm text-destructive">
                Không có phương tiện sẵn sàng trong fixture demo.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="linehaul-partner">Đối tác vận chuyển</Label>
              <Select
                value={partnerId === null ? "" : String(partnerId)}
                onValueChange={(value) => onPartnerChange(Number(value))}
              >
                <SelectTrigger id="linehaul-partner">
                  <SelectValue placeholder="Chọn đối tác" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={String(partner.id)}>
                      {partner.name} · {partner.partner_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMawbRequired && (
              <div className="space-y-2">
                <Label htmlFor="linehaul-mawb">Số MAWB</Label>
                <input
                  id="linehaul-mawb"
                  value={mawbNumber}
                  onChange={(event) => onMawbNumberChange(event.target.value)}
                  placeholder="Ví dụ: 738-12345678"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  maxLength={32}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
