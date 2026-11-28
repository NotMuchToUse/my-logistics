import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FlaskConical,
  History,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { USE_MOCK } from "@/core/api/axiosClient";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { ConfirmOutboundDeliveryDialog } from "../components/ConfirmOutboundDeliveryDialog";
import { OutboundDeliveryDriverSetup } from "../components/OutboundDeliveryDriverSetup";
import { OutboundDeliveryItemsTable } from "../components/OutboundDeliveryItemsTable";
import { OutboundDeliveryScannerCard } from "../components/OutboundDeliveryScannerCard";
import { RemoveOutboundItemDialog } from "../components/RemoveOutboundItemDialog";
import { OUTBOUND_DELIVERY_STATUS_META } from "../constants/warehouse-outbound-delivery.constants";
import { useWarehouseOutboundDelivery } from "../hooks/useWarehouseOutboundDelivery";
import type { OutboundDeliveryReceiptItem } from "../types/warehouse-outbound-delivery.types";

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đ`;
}

export function WarehouseOutboundDeliveryPage() {
  const activeWarehouseId = useBranchScopeStore(
    (state) => state.activeWarehouseId,
  );
  const {
    bootstrapData,
    activeDraft,
    lastConfirmedReceipt,
    selectedDriverId,
    setSelectedDriverId,
    scanCode,
    setScanCode,
    lastScanFeedback,
    activeItems,
    removedItems,
    unscannedAvailableShipments,
    isLoading,
    isCreatingDraft,
    isScanning,
    isRemovingItem,
    isConfirming,
    errorMessage,
    refetch,
    createDraft,
    scanShipment,
    removeItem,
    confirmReceipt,
  } = useWarehouseOutboundDelivery(activeWarehouseId);

  const [itemToRemove, setItemToRemove] =
    useState<OutboundDeliveryReceiptItem | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 py-12 text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Đang tải dữ liệu điều phối xuất kho giao hàng...
      </div>
    );
  }

  if (!bootstrapData) {
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <PackageCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            Xuất kho giao hàng
          </h1>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Thử lại
          </Button>
        </div>

        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{errorMessage ?? "Không tải được dữ liệu xuất kho giao hàng."}</p>
        </div>
      </section>
    );
  }

  const canConfirmReceipt =
    Boolean(activeDraft) &&
    activeDraft?.status === "draft" &&
    activeItems.length > 0 &&
    !isConfirming;

  return (
    <section className="min-w-0 space-y-6">
      {/* Tiêu đề trang và thao tác làm mới */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <PackageCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            Xuất kho giao hàng
          </h1>
          <p className="text-sm text-muted-foreground">
            Phân công tài xế bưu cục, quét barcode vận đơn cần giao, xử lý gỡ đơn nhầm và chốt phiếu đẩy sang App Tài xế.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading || isConfirming}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Làm mới dữ liệu
        </Button>
      </header>

      {USE_MOCK && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950"
        >
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Đang chạy ở chế độ dữ liệu mẫu (<code className="font-mono">VITE_USE_MOCK=true</code>). Toàn bộ thao tác tạo phiếu, quét barcode, gỡ đơn và chốt phiếu hoạt động đầy đủ trên bộ nhớ phiên.
          </p>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 p-3.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Thông báo khi vừa chốt phiếu thành công */}
      {lastConfirmedReceipt && !activeDraft && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <div className="space-y-0.5 text-sm">
                <p className="font-semibold text-emerald-950">
                  Đã chốt phiếu {lastConfirmedReceipt.receipt_code} & đẩy dữ liệu sang App Tài xế
                </p>
                <p className="text-emerald-900">
                  Tài xế: <strong>{lastConfirmedReceipt.driver_name}</strong> ({lastConfirmedReceipt.driver_code}) ·{" "}
                  {lastConfirmedReceipt.total_shipments} vận đơn · COD:{" "}
                  <strong>{formatCurrency(lastConfirmedReceipt.total_cod_amount)}</strong>
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={OUTBOUND_DELIVERY_STATUS_META.confirmed.className}
            >
              {OUTBOUND_DELIVERY_STATUS_META.confirmed.label}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Bước 1: Phân công tài xế / Thông tin phiếu nháp */}
      <OutboundDeliveryDriverSetup
        warehouse={bootstrapData.warehouse}
        drivers={bootstrapData.drivers}
        selectedDriverId={selectedDriverId}
        onSelectDriver={setSelectedDriverId}
        activeDraft={activeDraft}
        isCreatingDraft={isCreatingDraft}
        onCreateDraft={createDraft}
      />

      {/* Bước 2: Quét barcode vận đơn cần giao */}
      <OutboundDeliveryScannerCard
        disabled={!activeDraft || activeDraft.status !== "draft"}
        scanCode={scanCode}
        onScanCodeChange={setScanCode}
        isScanning={isScanning}
        lastScanFeedback={lastScanFeedback}
        availableShipments={unscannedAvailableShipments}
        onScanShipment={scanShipment}
      />

      {/* Danh sách vận đơn trong phiếu & lịch sử đơn gỡ */}
      <OutboundDeliveryItemsTable
        receiptStatus={activeDraft?.status ?? null}
        activeItems={activeItems}
        removedItems={removedItems}
        totalWeightGram={activeDraft?.total_weight_gram ?? 0}
        totalCodAmount={activeDraft?.total_cod_amount ?? 0}
        onRequestRemoveItem={(item) => setItemToRemove(item)}
      />

      {/* Khu vực chốt phiếu xuất kho giao hàng */}
      {activeDraft && (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Phiếu <strong className="font-mono text-foreground">{activeDraft.receipt_code}</strong> đang ở trạng thái{" "}
            <strong className="text-foreground">draft</strong>. Bạn vẫn có thể quét thêm hoặc gỡ đơn trước khi chốt.
          </p>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!canConfirmReceipt}
            onClick={() => setConfirmDialogOpen(true)}
          >
            <FileCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Chốt phiếu xuất kho giao hàng
          </Button>
        </div>
      )}

      {/* Lịch sử các phiếu đã chốt gần đây trong ca */}
      {bootstrapData.recent_confirmed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Phiếu xuất giao đã chốt gần đây ({bootstrapData.recent_confirmed.length})
            </CardTitle>
            <CardDescription>
              Các chuyến giao hàng đã bàn giao thành công cho tài xế bưu cục.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {bootstrapData.recent_confirmed.map((receipt) => (
              <div
                key={receipt.public_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3.5 py-2.5 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">
                      {receipt.receipt_code}
                    </span>
                    <Badge
                      variant="outline"
                      className={OUTBOUND_DELIVERY_STATUS_META[receipt.status].className}
                    >
                      {OUTBOUND_DELIVERY_STATUS_META[receipt.status].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tài xế: {receipt.driver_name} ({receipt.driver_code}) · Chốt lúc:{" "}
                    {receipt.confirmed_at ?? receipt.updated_at}
                  </p>
                </div>
                <div className="text-right text-xs sm:text-sm">
                  <p className="font-medium">{receipt.total_shipments} vận đơn</p>
                  <p className="text-muted-foreground">
                    COD: {formatCurrency(receipt.total_cod_amount)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialog gỡ đơn nhầm kèm lý do remove_reason */}
      <RemoveOutboundItemDialog
        item={itemToRemove}
        isRemoving={isRemovingItem}
        onClose={() => setItemToRemove(null)}
        onConfirmRemove={removeItem}
      />

      {/* Dialog xác nhận chốt phiếu */}
      <ConfirmOutboundDeliveryDialog
        open={confirmDialogOpen}
        receipt={activeDraft}
        activeCount={activeItems.length}
        isConfirming={isConfirming}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirmReceipt={confirmReceipt}
      />
    </section>
  );
}
