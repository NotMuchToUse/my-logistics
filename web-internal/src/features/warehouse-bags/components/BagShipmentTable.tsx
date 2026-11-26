import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { useWarehouseBags } from "../hooks/useWarehouseBags";

type Model = ReturnType<typeof useWarehouseBags>;
const shipmentLabels: Record<string, string> = {
  in_warehouse: "Tại kho", bagged: "Đã đóng túi", in_transit: "Đang trung chuyển",
};
export function BagShipmentTable({ shipments, items = [], demoMode = false, onRemove }: {
  shipments: Model["bagShipments"];
  items?: NonNullable<Model["bag"]["data"]>["manifest_bag_items"];
  demoMode?: boolean;
  onRemove?: (trackingCode: string) => void;
}) {
  return <div className="min-w-0 space-y-2">
    <h3 className="text-sm font-semibold">Vận đơn thuộc túi</h3>
    <Table aria-label="Vận đơn thuộc túi" className="min-w-[580px]">
      <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Mã vận đơn</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Trọng lượng</TableHead><TableHead>Thời gian quét</TableHead>{onRemove && <TableHead>Thao tác Demo</TableHead>}</TableRow></TableHeader>
      <TableBody>{shipments.length ? shipments.map((row, index) => <TableRow key={row.public_id}>
        <TableCell className="text-right tabular-nums">{index + 1}</TableCell>
        <TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">{row.tracking_code}</TableCell>
        <TableCell className="whitespace-nowrap">{shipmentLabels[row.status] ?? row.status}</TableCell>
        <TableCell className="whitespace-nowrap text-right tabular-nums">{demoMode ? `850 g (DEMO ONLY)` : "Chưa có dữ liệu"}</TableCell>
        <TableCell className="whitespace-nowrap">{items.find((item) => item.shipment_id === row.id)?.scanned_in_at ?? "Chưa có dữ liệu"}</TableCell>
        {onRemove && <TableCell><button type="button" className="underline" onClick={() => onRemove?.(row.tracking_code)}>Gỡ khỏi Demo</button></TableCell>}
      </TableRow>) : <TableRow><TableCell colSpan={demoMode ? 6 : 5} className="py-8 text-center text-muted-foreground">Chưa có vận đơn thuộc túi để hiển thị.</TableCell></TableRow>}</TableBody>
    </Table>
  </div>;
}
