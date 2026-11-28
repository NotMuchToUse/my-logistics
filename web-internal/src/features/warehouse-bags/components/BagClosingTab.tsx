import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, ScanLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bagClosingFormSchema } from "../warehouse-bags.schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BagClosingFormValues } from "../warehouse-bags.types";
import { BagSummary } from "./BagSummary";
import { BagContextNotice, BagReadFeedback } from "./BagReadFeedback";
import type { WarehouseBagsModel } from "./BagReadFeedback";

export function BagClosingTab({ model }: { model: WarehouseBagsModel }) {
  const scanRef = useRef<HTMLInputElement>(null);
  const form = useForm<BagClosingFormValues>({
    resolver: zodResolver(bagClosingFormSchema), values: model.closingForm, mode: "onBlur",
  });
  const blocked = model.dataset.status === "blocked";
  const demoMode = "sealBag" in model;
  const demoWeightGram = "demoWeightGram" in model ? model.demoWeightGram : null;
  const sealBag = "sealBag" in model ? model.sealBag : async () => null;
  const [sealDialogOpen, setSealDialogOpen] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  const submitScan = async () => {
    if (demoMode && !(await form.trigger())) return;
    const result = await model.lookupShipment();
    if (result && demoMode && "addShipment" in model) {
      const added = await model.addShipment(result.tracking_code);
      if (added?.success) setDemoMessage("DEMO ONLY — vận đơn được thêm vào túi giả lập.");
      else if (added && "error" in added) setDemoMessage(`DEMO ONLY — ${added.error.message}`);
    }
    if (result) scanRef.current?.focus();
  };
  return <section aria-label="Đóng túi hàng" className="min-w-0 space-y-6 text-sm">
    <h2 className="text-lg font-semibold">Đóng túi hàng</h2>
    <BagContextNotice model={model} />
    <Card className="space-y-4 p-4 sm:p-6">
      <h3 className="font-semibold">Chuẩn bị thông tin túi</h3>
      <form noValidate onSubmit={form.handleSubmit(() => undefined)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller name="destination_warehouse_id" control={form.control} render={({ field }) => <div className="min-w-0 space-y-2">
          <Label htmlFor="bag-destination">Kho đích (dữ liệu mẫu)</Label>
          <Select value={field.value} onValueChange={(value) => { field.onChange(value); model.setClosingForm((current) => ({ ...current, destination_warehouse_id: value })); }} disabled={blocked || !model.warehouses.length}>
            <SelectTrigger id="bag-destination" ref={field.ref} onBlur={field.onBlur} aria-invalid={!!form.formState.errors.destination_warehouse_id} aria-describedby="bag-destination-error"><SelectValue placeholder="Chọn kho đích" /></SelectTrigger>
            <SelectContent>{model.warehouses.map((row) => <SelectItem key={row.public_id} value={String(row.id)}>{row.name}</SelectItem>)}</SelectContent>
          </Select>
          <p id="bag-destination-error" className="text-destructive">{form.formState.errors.destination_warehouse_id?.message}</p>
        </div>} />
        <Controller name="seal_number" control={form.control} render={({ field }) => <div className="space-y-2">
          <Label htmlFor="bag-seal">Số niêm phong (Seal)</Label>
          <Input {...field} id="bag-seal" autoComplete="off" className="font-mono text-base font-medium sm:text-sm" aria-invalid={!!form.formState.errors.seal_number} aria-describedby="bag-seal-error" onChange={(event) => { field.onChange(event); model.setClosingForm((current) => ({ ...current, seal_number: event.target.value })); }} />
          <p id="bag-seal-error" className="text-destructive">{form.formState.errors.seal_number?.message}</p>
          <p className="text-xs text-muted-foreground">Tối đa 40 ký tự, giữ nguyên số 0 đầu.</p>
        </div>} />
        <Button type="submit" variant="outline" className="w-full sm:w-auto sm:justify-self-start">Kiểm tra thông tin</Button>
      </form>
    </Card>
    <Card className="space-y-4 p-4 sm:p-6">
      <h3 className="flex items-center gap-2 font-semibold"><ScanLine className="h-4 w-4" aria-hidden="true" />Tra cứu vận đơn</h3>
      <p className="text-muted-foreground">{demoMode ? "DEMO ONLY — quét thành công thêm đơn vào túi giả lập." : "Tra cứu chỉ xem thông tin, chưa thêm vận đơn vào túi."}</p>
      <form onSubmit={(event) => { event.preventDefault(); void submitScan(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="bag-tracking">Mã vận đơn</Label><Input id="bag-tracking" ref={scanRef} value={model.trackingCode} autoComplete="off" className="font-mono text-base font-medium sm:text-sm" onChange={(event) => model.setTrackingCode(event.target.value)} /></div>
        <Button type="submit" disabled={blocked || model.shipment.status === "loading"}>Tra cứu vận đơn</Button>
      </form>
      <BagReadFeedback state={model.shipment} />
      {model.shipment.data && <div role="status" className="space-y-1 rounded-md border p-3"><p>Đã tìm thấy vận đơn <span className="font-mono text-xs font-medium sm:text-sm">{model.shipment.data.tracking_code}</span>.</p><p className="text-muted-foreground">{demoMode ? "DEMO ONLY — chỉ danh sách trong phiên trình diễn được cập nhật." : "Chưa thêm vào túi. Số vận đơn thuộc túi không thay đổi."}</p></div>}
      {demoMode && <div role="status" className="space-y-2 rounded-md border border-amber-300 p-3"><p>{demoMessage || "DEMO ONLY — danh sách tạm, số lượng và trọng lượng bên dưới chỉ là dữ liệu trình diễn."}</p>{model.demoShipments.map((row) => <div key={row.public_id} className="flex items-center justify-between gap-2"><span className="font-mono text-xs">{row.tracking_code}</span><Button type="button" variant="outline" size="sm" onClick={() => void model.removeShipment(row.tracking_code)}>Gỡ khỏi Demo</Button></div>)}</div>}
    </Card>
    <BagSummary bag={demoMode ? model.bags.find((bag) => bag.seal_number === model.closingForm.seal_number) ?? null : null} warehouses={model.warehouses} demoMode={demoMode} demoWeightGram={demoWeightGram} />
    <div className="space-y-2"><Button type="button" disabled={!demoMode || !model.demoShipments.length} className="w-full sm:w-auto" aria-describedby="seal-blocked" onClick={() => setSealDialogOpen(true)}><LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />Niêm phong túi</Button><p id="seal-blocked" className="text-muted-foreground">{model.mutationBlockReason}</p></div>
    <Dialog open={sealDialogOpen} onOpenChange={setSealDialogOpen}><DialogContent><DialogHeader><DialogTitle>Niêm phong túi — Demo</DialogTitle><DialogDescription>DEMO ONLY — xác nhận mô phỏng trong bộ nhớ, không ảnh hưởng hệ thống thật.</DialogDescription></DialogHeader><p>Seal: <span className="font-mono">{model.closingForm.seal_number || "Chưa nhập"}</span></p><DialogFooter><Button type="button" variant="outline" onClick={() => setSealDialogOpen(false)}>Hủy</Button><Button type="button" disabled={!model.closingForm.seal_number} onClick={async () => { const result = await sealBag(); setSealDialogOpen(false); setDemoMessage(result ? "DEMO ONLY — túi đã chuyển sang sealed trong phiên này." : "DEMO ONLY — chưa có túi để niêm phong."); }}>Xác nhận Demo</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
