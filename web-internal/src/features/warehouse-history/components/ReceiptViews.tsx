import { Badge } from "@/components/ui/badge";
import { activeItems, RECEIPT_STATUSES, RECEIPT_TYPES, type Receipt } from "../warehouse-history.model";
export function ReceiptStatus({ receipt }: { receipt: Receipt }) {
  return <Badge variant="outline" className={receipt.status === "confirmed" ? "border-green-600 text-green-700" : receipt.status === "cancelled" ? "border-destructive text-destructive" : receipt.status === "unlocked" ? "border-amber-600 text-amber-700" : ""}>{RECEIPT_STATUSES[receipt.status]}</Badge>;
}
export function ReceiptSummary({ receipt: r }: { receipt: Receipt }) {
  const branchField = r.branch_name ? [["Chi nhánh", r.branch_name]] : [];
  const fields = [["Loại phiếu", RECEIPT_TYPES[r.receipt_type]], ["Kho thực hiện", r.warehouse_name], ["Kho đích", r.demo?.target_warehouse_name], ["Tài xế", r.demo?.driver_name], ["Thời gian tạo", r.created_at], ["Cập nhật", r.updated_at], ["Người chốt", r.confirmed_by_name], ["Thời gian chốt", r.confirmed_at], ["Bàn giao", r.demo?.handed_over_at], ["Mở khóa", r.demo?.unlocked_at], ["Lý do mở khóa", r.demo?.unlock_reason], ["Ghi chú", r.note]];
  return <><dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">{[...branchField, ...fields].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value || "Chưa có dữ liệu"}</dd></div>)}</dl><div className="grid grid-cols-3 gap-2 rounded-lg border p-4 text-right text-sm tabular-nums"><p>Vận đơn lẻ<br /><strong>{r.total_shipments}</strong></p><p>Túi hàng<br /><strong>{r.total_bags}</strong></p><p>Trọng lượng<br /><strong>{r.total_weight_gram.toLocaleString("vi-VN")} g</strong></p></div></>;
}
export function ReceiptItems({ receipt, print = false }: { receipt: Receipt; print?: boolean }) {
  const items = print ? activeItems(receipt) : receipt.items ?? [];
  return <div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-muted"><th className="p-3">Loại hàng</th><th className="p-3">Mã vận đơn / Seal</th><th className="p-3">Quét / nguồn</th><th className="p-3">Ghi nhận</th></tr></thead><tbody>{items.map((item, index) => <tr key={index} className="border-b"><td className="p-3">{item.seal_number ? "Túi Seal" : "Vận đơn lẻ"}</td><td className="break-all p-3 font-mono text-xs font-medium">{item.seal_number ?? item.tracking_code ?? "Chưa có mã"}</td><td className="p-3">{item.scanned_at ?? "—"}<br />{item.inbound_source_type ?? "—"}</td><td className="p-3">{item.removed_at ? `Đã gỡ: ${item.removed_at}` : item.is_wrong_route ? "Cảnh báo sai tuyến" : "Còn hiệu lực"}</td></tr>)}</tbody></table>{!items.length && <p className="p-4 text-sm">Chưa có dữ liệu hàng hóa.</p>}</div>;
}
