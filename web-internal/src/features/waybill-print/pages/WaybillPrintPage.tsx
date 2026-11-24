import { AlertCircle, Printer } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USE_MOCK } from "@/core/api/axiosClient";
import { MOCK_SHIPMENT_PUBLIC_ID } from "../api/waybillPrint.api";
import { PrintControls } from "../components/PrintControls";
import { PrintPreview } from "../components/PrintPreview";
import { TrackingRangesPanel } from "../components/TrackingRangesPanel";
import { useWaybillPrint } from "../hooks/useWaybillPrint";
import { useWaybillSession } from "../hooks/useWaybillSession";
import type { PrintDocumentType, WaybillSession } from "../types/waybillPrint.types";

type PageTab = "print" | "ranges";

export function WaybillPrintPage() {
  const session = useWaybillSession();
  const mayPrint = session.authenticated
    && session.roles.some((role) => role === "receptionist" || role === "coordinator")
    && session.branchId !== null
    && (session.allBranches || session.allowedBranchIds.includes(session.branchId));
  const mayManageRanges = session.authenticated
    && session.roles.includes("system_admin")
    && (session.branchId === null
      ? session.allBranches
      : session.allBranches || session.allowedBranchIds.includes(session.branchId));
  const [tab, setTab] = useState<PageTab>(mayPrint ? "print" : "ranges");
  const visibleTab: PageTab = tab === "print"
    ? (mayPrint ? "print" : "ranges")
    : (mayManageRanges ? "ranges" : "print");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-start gap-3">
        <span className="rounded-md bg-primary/10 p-2 text-primary"><Printer className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <h1 className="text-2xl font-semibold">Phiếu gửi & in ấn</h1>
          <p className="text-sm text-muted-foreground">Xem trước vận đơn, in barcode và quản lý dải mã trong phạm vi được cấp.</p>
        </div>
      </header>

      {!USE_MOCK ? (
        <div className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4" role="status">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-semibold">Chưa thể bật thao tác API thật</h2>
            <p className="text-sm text-muted-foreground">
              Chưa xác nhận endpoint, DTO, permission code và cách ghi nhận lần in/dải mã ở Backend.
              Không gửi request hoặc tự chuyển sang dữ liệu Mock khi API lỗi.
            </p>
          </div>
        </div>
      ) : !mayPrint && !mayManageRanges ? (
        <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Không đủ quyền hoặc chưa chọn phạm vi</h2>
            <p className="text-sm text-muted-foreground">In chứng từ cần Receptionist/Coordinator và chi nhánh hợp lệ; quản lý dải mã chỉ dành cho System Admin.</p>
          </div>
        </div>
      ) : (
        <Tabs value={visibleTab} onValueChange={(value) => {
          if (value === "print" || value === "ranges") setTab(value);
        }}>
          <TabsList aria-label="Phân hệ phiếu gửi và dải mã">
            {mayPrint && <TabsTrigger value="print">In chứng từ</TabsTrigger>}
            {mayManageRanges && <TabsTrigger value="ranges">Dải mã</TabsTrigger>}
          </TabsList>
          {mayPrint && <TabsContent value="print"><PrintWorkspace key={session.key} session={session} /></TabsContent>}
          {mayManageRanges && <TabsContent value="ranges"><TrackingRangesPanel key={session.key} session={session} /></TabsContent>}
        </Tabs>
      )}
    </div>
  );
}

function PrintWorkspace({ session }: { session: WaybillSession }) {
  const print = useWaybillPrint(session);
  const previewRef = useRef<HTMLDivElement>(null);
  const [publicId, setPublicId] = useState(MOCK_SHIPMENT_PUBLIC_ID);
  const [documentType, setDocumentType] = useState<PrintDocumentType>("waybill_a4");
  const [selectedBarcodes, setSelectedBarcodes] = useState<string[]>([]);
  const busy = print.state === "recording" || print.state === "opening";

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const model = await print.loadShipment(publicId);
    setSelectedBarcodes(model
      ? [...model.parcels].sort((a, b) => a.parcelSequence - b.parcelSequence).slice(0, 1).map((parcel) => parcel.parcelBarcode)
      : []);
  }

  function submitPrint() {
    void print.print(previewRef.current, documentType, selectedBarcodes);
  }

  function retryPrint() {
    void print.retryPrint(previewRef.current);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-4" aria-labelledby="shipment-lookup-title">
        <div>
          <h2 id="shipment-lookup-title" className="font-semibold">Tra cứu vận đơn</h2>
          <p className="text-sm text-muted-foreground">Nhập Public ID do hệ thống cấp; dữ liệu hiện tại chỉ là bộ mẫu minh họa.</p>
        </div>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void load(event)}>
          <Input
            value={publicId}
            onChange={(event) => setPublicId(event.target.value)}
            aria-label="Public ID vận đơn"
            autoComplete="off"
            spellCheck={false}
            disabled={busy || print.retryAvailable}
          />
          <Button type="submit" disabled={print.loading || busy || print.retryAvailable || !publicId.trim()}>
            {print.loading ? "Đang tải..." : "Tải vận đơn"}
          </Button>
        </form>
      </section>

      {print.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          {print.error.message}
          {print.error instanceof Error && "code" in print.error && typeof print.error.code === "string" && <span className="ml-2 font-mono text-xs">({print.error.code})</span>}
        </div>
      )}
      {print.receipt && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm" role="status">
          <p>{print.receipt.message}</p>
          <p className="font-mono text-xs">Mã log Mock: {print.receipt.requestId}</p>
          {print.state === "done" && <p>Hộp thoại in đã đóng; trình duyệt không xác nhận đã in hay đã hủy.</p>}
        </div>
      )}

      {!print.model && !print.loading ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Tải vận đơn để hiển thị thông tin đã được phép in.
        </div>
      ) : print.model ? (
        <>
          <PrintControls
            documentType={documentType}
            parcels={print.model.parcels}
            selectedBarcodes={selectedBarcodes}
            disabled={print.retryAvailable}
            onDocumentTypeChange={setDocumentType}
            onSelectedBarcodesChange={setSelectedBarcodes}
            onPrint={submitPrint}
            onRetry={retryPrint}
            retryAvailable={print.retryAvailable}
            busy={busy}
          />
          <PrintPreview
            model={print.model}
            documentType={documentType}
            selectedBarcodes={selectedBarcodes}
            previewRef={previewRef}
          />
        </>
      ) : null}
    </div>
  );
}
