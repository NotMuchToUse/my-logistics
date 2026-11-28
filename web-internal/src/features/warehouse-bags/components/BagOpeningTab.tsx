import { useRef, useState } from "react";
import { UnlockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BagSummary } from "./BagSummary";
import { BagShipmentTable } from "./BagShipmentTable";
import { BagContextNotice, BagReadFeedback } from "./BagReadFeedback";
import type { WarehouseBagsModel } from "./BagReadFeedback";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function BagOpeningTab({ model }: { model: WarehouseBagsModel }) {
  const lookupRef = useRef<HTMLInputElement>(null);
  const demoMode = "openBag" in model;
  const openBag = "openBag" in model ? model.openBag : async () => null;
  const [openDialog, setOpenDialog] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  return <section aria-label="Mở túi hàng" className="min-w-0 space-y-6 text-sm">
    <h2 className="text-lg font-semibold">Mở túi hàng</h2>
    <BagContextNotice model={model} />
    <Card className="space-y-4 p-4 sm:p-6">
      <form onSubmit={(event) => { event.preventDefault(); void model.lookupBag().then((result) => { if (result) lookupRef.current?.focus(); }); }} className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-2"><Label htmlFor="bag-lookup-by">Tra cứu theo</Label><Select value={model.bagLookup.lookupBy} onValueChange={(value: "bag_code" | "seal_number") => { model.resetLookup(); model.setBagLookup({ lookupBy: value, value: "" }); }}><SelectTrigger id="bag-lookup-by"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bag_code">Mã túi</SelectItem><SelectItem value="seal_number">Số Seal</SelectItem></SelectContent></Select></div>
        <div className="min-w-0 space-y-2"><Label htmlFor="bag-lookup-value">Mã túi hoặc Seal</Label><Input ref={lookupRef} id="bag-lookup-value" value={model.bagLookup.value} autoComplete="off" className="font-mono text-base font-medium sm:text-sm" onChange={(event) => model.setBagLookup((current) => ({ ...current, value: event.target.value }))} /></div>
        <Button type="submit" disabled={model.dataset.status === "blocked" || model.bag.status === "loading"}>Tra cứu túi</Button>
      </form>
      <BagReadFeedback state={model.bag} />
      <Button type="button" variant="outline" onClick={model.resetLookup}>Xóa kết quả tra cứu</Button>
    </Card>
    <BagSummary bag={model.bag.data?.bag ?? null} warehouses={model.warehouses} demoMode={demoMode} demoWeightGram={model.confirmedWeightGram} />
    <BagShipmentTable shipments={model.bagShipments} items={model.bag.data?.manifest_bag_items} demoMode={demoMode}  />
    {demoMode && <p role="status" className="rounded-md border border-amber-300 p-3">{demoMessage || "DEMO ONLY — trạng thái mở túi được mô phỏng trong bộ nhớ."}</p>}
    <div className="space-y-2"><Button type="button" disabled={!demoMode || !model.bag.data || !["sealed", "in_transit"].includes(model.bag.data.bag.status)} className="w-full sm:w-auto" aria-describedby="open-blocked" onClick={() => setOpenDialog(true)}><UnlockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />Xác nhận mở túi</Button><p id="open-blocked" className="text-muted-foreground">{model.mutationBlockReason}</p></div>
    <Dialog open={openDialog} onOpenChange={setOpenDialog}><DialogContent><DialogHeader><DialogTitle>Mở túi — Demo</DialogTitle><DialogDescription>DEMO ONLY — thao tác giả lập trong bộ nhớ, không thay thế xác nhận nhập kho đích.</DialogDescription></DialogHeader><p>Túi: <span className="font-mono">{model.bag.data?.bag.bag_code}</span></p><DialogFooter><Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>Hủy</Button><Button type="button" onClick={async () => { const result = await openBag(); setOpenDialog(false); setDemoMessage(result ? "DEMO ONLY — túi đã chuyển sang opened trong phiên này." : "DEMO ONLY — không thể mở túi mẫu này."); }}>Xác nhận Demo</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
