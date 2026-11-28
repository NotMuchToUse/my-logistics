import { useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { manifestType, type Receipt } from "../warehouse-history.model";
import { ReceiptItems } from "./ReceiptViews";
import "../warehouse-history.print.css";

export function ManifestPreview({ receipt: r, mock, onClose }: { receipt: Receipt; mock: boolean; onClose: () => void }) {
  const printing = useRef(false);
  const content = <article className="space-y-4 bg-white p-6 text-black"><p className="font-semibold">VIETSTAR LOGISTICS</p><h2 className="text-center text-xl font-bold">{manifestType(r) === "delivery_manifest" ? "BẢNG KÊ GIAO HÀNG" : "BẢNG KÊ XUẤT KHO"}</h2>{mock && <p className="text-center font-bold">MÔ PHỎNG — KHÔNG PHẢI CHỨNG TỪ THẬT</p>}<p className="break-all font-mono">{r.receipt_code}</p><p>Kho: {r.warehouse_name ?? "Chưa có dữ liệu"} · Kho nhận: {r.demo?.target_warehouse_name ?? "Chưa có dữ liệu"}</p><p>Tài xế: {r.demo?.driver_name ?? "Chưa có dữ liệu"} · Thời gian: {r.confirmed_at ?? r.created_at}</p><ReceiptItems receipt={r} print /><p className="tabular-nums">Tổng nguồn: {r.total_shipments} vận đơn lẻ · {r.total_bags} túi · {r.total_weight_gram.toLocaleString("vi-VN")} g</p><div className="flex justify-around py-10"><p>Người giao<br />(Ký, ghi rõ họ tên)</p><p>Người nhận<br />(Ký, ghi rõ họ tên)</p></div></article>;
  return <><Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-4xl"><DialogTitle>Xem trước bảng kê</DialogTitle><DialogDescription>{mock ? "In thử dữ liệu Mock; không ghi print_logs thật." : "Chỉ xem trước. In nghiệp vụ bị khóa vì chưa có contract ghi print_logs và thời điểm ghi nhận lượt in."}</DialogDescription><div>{content}</div><Button disabled={!mock} onClick={() => { if (!mock || printing.current) return; printing.current = true; try { window.print(); } finally { printing.current = false; } }}>In thử Mock</Button></DialogContent></Dialog>{mock && createPortal(<div className="warehouse-history-print"><style media="print" data-warehouse-print>{"@page { size: A4; margin: 12mm; }"}</style>{content}</div>, document.body)}</>;
}
