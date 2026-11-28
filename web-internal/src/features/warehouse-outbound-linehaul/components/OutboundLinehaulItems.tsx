import { AlertTriangle, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OutboundScannedItem, WarehouseOption } from "../types/warehouse-outbound-linehaul.types";

interface OutboundLinehaulItemsProps {
  items: OutboundScannedItem[];
  warehouses: WarehouseOption[];
  onRemove: (itemKey: string) => void;
  disabled: boolean;
}

function formatWeight(weightGram: number): string {
  return `${(weightGram / 1000).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  })} kg`;
}

export function OutboundLinehaulItems({
  items,
  warehouses,
  onRemove,
  disabled,
}: OutboundLinehaulItemsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" aria-hidden="true" />
          Hàng hóa trong phiếu nháp ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Chưa có vận đơn hoặc túi Seal. Quét mã để thêm vào phiếu nháp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Mã</th>
                  <th className="px-3 py-3 font-medium">Loại</th>
                  <th className="px-3 py-3 font-medium">Khối lượng</th>
                  <th className="px-3 py-3 font-medium">Tuyến kế tiếp</th>
                  <th className="px-3 py-3 font-medium">Kiểm tra tuyến</th>
                  <th className="px-3 py-3 font-medium"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const expectedWarehouse = warehouses.find(
                    (warehouse) => warehouse.id === item.expected_next_hop_warehouse_id,
                  );
                  return (
                    <tr key={item.item_key} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium">{item.code}</td>
                      <td className="px-3 py-3">
                        {item.item_type === "shipment" ? "Vận đơn" : "Túi Seal"}
                      </td>
                      <td className="px-3 py-3">{formatWeight(item.chargeable_weight_gram)}</td>
                      <td className="px-3 py-3">
                        {expectedWarehouse?.name ?? "Chưa có tuyến mẫu"}
                      </td>
                      <td className="px-3 py-3">
                        {item.is_wrong_route ? (
                          <span className="inline-flex items-center gap-1 font-medium text-destructive">
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            Sai tuyến
                          </span>
                        ) : (
                          <span className="text-emerald-700">Đúng tuyến</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Gỡ ${item.code} khỏi phiếu`}
                          disabled={disabled}
                          onClick={() => onRemove(item.item_key)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
