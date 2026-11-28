import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FlaskConical,
  LoaderCircle,
  PackagePlus,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { USE_MOCK } from "@/core/api/axiosClient";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { OutboundLinehaulItems } from "../components/OutboundLinehaulItems";
import { OutboundLinehaulSetup } from "../components/OutboundLinehaulSetup";
import { useWarehouseOutboundLinehaul } from "../hooks/useWarehouseOutboundLinehaul";

function formatWeight(weightGram: number): string {
  return `${(weightGram / 1000).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  })} kg`;
}

function WarehouseOutboundLinehaulDemo() {
  const activeWarehouseId = useBranchScopeStore((state) => state.activeWarehouseId);
  const model = useWarehouseOutboundLinehaul(activeWarehouseId);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  if (model.isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Đang tải dữ liệu demo...
      </div>
    );
  }

  if (!model.dataset) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Xuất kho trung chuyển</h1>
        <p role="alert" className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
          {model.errorMessage ?? "Không tải được dữ liệu demo."}
        </p>
      </section>
    );
  }

  const hasWrongRoute = model.items.some((item) => item.is_wrong_route);
  const wrongRouteCount = model.items.filter((item) => item.is_wrong_route).length;
  const progressWidth = Math.min(model.loadSummary.load_percentage, 100);

  function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void model.addScannedCode();
  }

  function handleConfirm() {
    model.confirmDraft();
    if (model.canConfirm) setConfirmDialogOpen(false);
  }

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Xuất kho trung chuyển</h1>
        <p className="text-sm text-muted-foreground">
          Chọn kho nhận, phương tiện hoặc đối tác, rồi quét vận đơn và túi Seal vào phiếu nháp.
        </p>
      </header>

      <div role="note" className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <FlaskConical className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          CHẾ ĐỘ DEMO — Dữ liệu chỉ tồn tại trong phiên trang này. API
          {" "}<code>/api/v1/warehouse/outbound-linehaul</code> chưa được triển khai;
          thao tác chốt dưới đây không ghi phiếu thật.
        </p>
      </div>

      {model.errorMessage && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {model.errorMessage}
        </p>
      )}

      {model.confirmation ? (
        <Card className="border-emerald-300">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Phiếu demo đã chốt trong phiên</h2>
                <p className="text-sm text-muted-foreground">
                  {model.confirmation.receipt_code} · {model.confirmation.item_count} mã ·{" "}
                  {formatWeight(model.confirmation.total_weight_gram)}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={model.resetDraft}>
              Tạo phiếu demo khác
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <OutboundLinehaulSetup
            originWarehouse={model.originWarehouse}
            targetWarehouseId={model.targetWarehouseId}
            warehouses={model.dataset.warehouses}
            onTargetWarehouseChange={model.setTargetWarehouseId}
            transportMode={model.transportMode}
            onTransportModeChange={model.setTransportMode}
            vehicles={model.dataset.vehicles.filter((vehicle) => vehicle.status === "available")}
            vehicleId={model.vehicleId}
            onVehicleChange={model.setVehicleId}
            partners={model.dataset.partners.filter((partner) => partner.is_active === 1)}
            partnerId={model.partnerId}
            onPartnerChange={model.setPartnerId}
            mawbNumber={model.mawbNumber}
            onMawbNumberChange={model.setMawbNumber}
            isMawbRequired={model.isMawbRequired}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PackagePlus className="h-5 w-5" aria-hidden="true" />
                Quét vận đơn / túi Seal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleScan}>
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="linehaul-scan-code">Mã vận đơn hoặc số Seal</Label>
                  <Input
                    id="linehaul-scan-code"
                    value={model.scanCode}
                    onChange={(event) => model.setScanCode(event.target.value)}
                    placeholder="Ví dụ: VS26112300002 hoặc MOCK-SEAL-001"
                    autoComplete="off"
                    disabled={Boolean(model.confirmation)}
                  />
                </div>
                <Button type="submit" className="sm:mt-7" disabled={!model.scanCode.trim()}>
                  Thêm vào phiếu nháp
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tải trọng phương tiện</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.transportMode === "vehicle" && model.selectedVehicle ? (
                <>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>Đã xếp: {formatWeight(model.loadSummary.total_weight_gram)}</span>
                    <span>
                      Tải trọng tối đa: {Number(model.selectedVehicle.max_payload_kg).toLocaleString("vi-VN")} kg
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label="Mức tải trọng phương tiện"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(model.loadSummary.load_percentage, 100)}
                  >
                    <div
                      className={`h-full transition-all ${model.loadSummary.is_overloaded ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <p className={`text-sm ${model.loadSummary.is_overloaded ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                    {model.loadSummary.load_percentage}% công suất
                    {model.loadSummary.is_overloaded && " — vượt tải, không thể chốt phiếu."}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {model.transportMode === "partner"
                    ? "Tải trọng đối tác không có trong dữ liệu mô phỏng; cần xác nhận theo hợp đồng vận chuyển."
                    : "Chọn một phương tiện đang sẵn sàng để kiểm tra tải trọng."}
                </p>
              )}
            </CardContent>
          </Card>

          {hasWrongRoute && (
            <div role="alert" className="flex gap-3 rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                Có {wrongRouteCount} mã sai tuyến hoặc chưa có tuyến mẫu tới kho nhận.
                Kiểm tra cảnh báo và gỡ mã không phù hợp trước khi chốt.
              </p>
            </div>
          )}

          <OutboundLinehaulItems
            items={model.items}
            warehouses={model.dataset.warehouses}
            onRemove={model.removeItem}
            disabled={Boolean(model.confirmation)}
          />

          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!model.canConfirm}
              onClick={() => setConfirmDialogOpen(true)}
            >
              <FileCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Chốt phiếu xuất kho
            </Button>
            <p className="text-sm text-muted-foreground">
              Phiếu vẫn là bản nháp cho tới khi xác nhận chốt.
            </p>
          </div>

          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xác nhận chốt phiếu xuất kho?</DialogTitle>
                <DialogDescription>
                  Chốt {model.items.length} mã hàng, tổng tải {formatWeight(model.loadSummary.total_weight_gram)}.
                  {hasWrongRoute
                    ? ` Cảnh báo: còn ${wrongRouteCount} mã sai tuyến.`
                    : ""}
                  {" "}Đây chỉ là xác nhận mô phỏng trong phiên, không ghi vào Backend.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                  Quay lại
                </Button>
                <Button type="button" onClick={handleConfirm}>
                  Xác nhận chốt demo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}

export function WarehouseOutboundLinehaulPage() {
  if (!USE_MOCK) {
    return (
      <section className="min-w-0 space-y-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Xuất kho trung chuyển</h1>
        <div role="alert" className="flex gap-3 rounded-md border p-4 text-sm sm:p-6">
          <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            Chức năng đang khóa ở chế độ API vì Backend chưa có endpoint xuất kho trung chuyển.
            Không gửi request hoặc giả lập kết quả API.
          </p>
        </div>
      </section>
    );
  }

  return <WarehouseOutboundLinehaulDemo />;
}
