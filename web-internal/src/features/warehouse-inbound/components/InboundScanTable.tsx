import { useEffect, useRef, useState } from "react";
import { ListChecks, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/core/utils/formatters";
import { WAREHOUSE_INBOUND_OPTIONS } from "../constants/warehouse-inbound.constants";
import type { useWarehouseInbound } from "../hooks/useWarehouseInbound";

export type InboundScanTableProps = Pick<
  ReturnType<typeof useWarehouseInbound>,
  | "items"
  | "totalScans"
  | "currentCount"
  | "warningCount"
  | "isProcessing"
  | "removeBarcode"
  | "resetSession"
>;

export function InboundScanTable({
  items,
  totalScans,
  currentCount,
  warningCount,
  isProcessing,
  removeBarcode,
  resetSession,
}: InboundScanTableProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wasOpenRef = useRef(false);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (confirmOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;

    const active = document.activeElement;
    if (
      document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden]):not([data-state="closed"])') ||
      (active && active !== document.body && active !== document.documentElement &&
        active.isConnected && !active.closest('[role="dialog"][data-state="closed"]'))
    ) return;

    const target = resetButtonRef.current;
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else headingRef.current?.focus({ preventScroll: true });
  }, [confirmOpen]);

  const statistics = [
    { label: "Tổng lượt quét", value: totalScans },
    { label: "Số mã trong danh sách", value: currentCount },
    { label: "Số lượt cảnh báo", value: warningCount },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statistics.map((statistic) => (
          <Card key={statistic.label} className="space-y-2 p-4">
            <p className="text-sm text-muted-foreground">{statistic.label}</p>
            <p className="text-2xl font-semibold tabular-nums">{statistic.value}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Danh sách vừa quét
          </h2>
          <Button
            ref={resetButtonRef}
            type="button"
            variant="outline"
            disabled={isProcessing}
            onClick={() => setConfirmOpen(true)}
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Xóa danh sách
          </Button>
        </div>
        {isProcessing && (
          <p className="text-sm text-muted-foreground">
            Vui lòng đợi các lượt quét đang xử lý trước khi xóa danh sách.
          </p>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Chưa có mã được quét"
            description="Quét barcode để thêm vào danh sách demo."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>STT</TableHead>
                <TableHead className="whitespace-nowrap">Mã Barcode</TableHead>
                <TableHead className="whitespace-nowrap">Loại mã</TableHead>
                <TableHead className="whitespace-nowrap">Phân loại nhập kho</TableHead>
                <TableHead className="whitespace-nowrap">Thời gian quét</TableHead>
                <TableHead className="whitespace-nowrap">Kết quả</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.barcode}>
                  <TableCell className="tabular-nums">{index + 1}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">
                    {item.barcode}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {item.barcodeType === "shipment" ? "Vận đơn" : "Túi hàng"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {WAREHOUSE_INBOUND_OPTIONS.find((option) => option.value === item.inboundType)?.label
                      ?? "Phân loại không hợp lệ"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateTime(item.scannedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">Đã thêm vào danh sách demo</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Xóa mã ${item.barcode} khỏi danh sách demo`}
                      onClick={() => removeBarcode(item.barcode)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa danh sách quét demo?"
        description={isProcessing
          ? "Vui lòng đợi các lượt quét đang xử lý trước khi xóa danh sách."
          : "Danh sách và thống kê của phiên quét demo sẽ được xóa. Thao tác này không ảnh hưởng dữ liệu kho thực tế."}
        confirmLabel="Xóa danh sách"
        onConfirm={() => {
          if (isProcessing) return;
          resetSession();
          setConfirmOpen(false);
        }}
        isLoading={isProcessing}
      />
    </section>
  );
}
