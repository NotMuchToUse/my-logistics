import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BAG_STATUS_BADGE_CLASSES, BAG_STATUS_LABELS } from "../warehouse-bags.constants";
import type { BagFixtureRow } from "../api/warehouse-bags.api";

export function BagSummary({ bag, warehouses = [], demoWeightGram = null, demoMode = false }: {
  bag: BagFixtureRow | null;
  warehouses?: { id: number; name: string }[];
  demoWeightGram?: number | null;
  demoMode?: boolean;
}) {
  const warehouse = (id: number) => warehouses.find((row) => row.id === id)?.name ?? `Kho #${id} (mẫu)`;
  return <Card className="min-w-0 space-y-4 p-4 text-sm sm:p-6" aria-label="Tổng hợp túi hàng">
    <h3 className="font-semibold">Thông tin túi hàng</h3>
    <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="text-muted-foreground">Mã túi</dt><dd className="break-all font-mono text-xs font-medium sm:text-sm">{bag?.bag_code ?? "Chưa có túi"}</dd></div>
      <div><dt className="text-muted-foreground">Số Seal</dt><dd className="break-all font-mono text-xs font-medium sm:text-sm">{bag?.seal_number ?? "Chưa có dữ liệu"}</dd></div>
      <div><dt className="text-muted-foreground">Trạng thái túi</dt><dd>{bag ? <Badge variant="outline" className={BAG_STATUS_BADGE_CLASSES[bag.status]}>{BAG_STATUS_LABELS[bag.status]}</Badge> : "Chưa có dữ liệu"}</dd></div>
      <div><dt className="text-muted-foreground">Kho nguồn</dt><dd>{bag ? warehouse(bag.origin_warehouse_id) : "Chưa có dữ liệu"}</dd></div>
      <div><dt className="text-muted-foreground">Kho đích</dt><dd>{bag ? warehouse(bag.destination_warehouse_id) : "Chưa có dữ liệu"}</dd></div>
      <div><dt className="text-muted-foreground">Tổng số vận đơn thuộc túi</dt><dd className="text-right tabular-nums">{bag?.shipment_count ?? "Chưa có dữ liệu"}</dd></div>
      <div><dt className="text-muted-foreground">Tổng trọng lượng{demoMode ? " (Demo)" : ""}</dt><dd className="text-right tabular-nums">{demoMode && demoWeightGram !== null ? `${demoWeightGram.toLocaleString("vi-VN")} g (DEMO ONLY)` : "Chưa có dữ liệu"}</dd></div>
    </dl>
    <p className="text-xs text-muted-foreground">{demoMode ? "Trọng lượng hiển thị là số liệu Demo, chưa phải công thức nghiệp vụ đã xác nhận." : "Trọng lượng chưa có số liệu và công thức được xác nhận."}</p>
  </Card>;
}
