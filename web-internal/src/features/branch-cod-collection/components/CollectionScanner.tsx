import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DemoDriver, DemoScanResult } from "../types/branch-cod-collection.types";

export interface CollectionScannerProps {
  scopeKey: string | null;
  selectedDriver: DemoDriver | null;
  scannedCount: number;
  canScan: boolean;
  blockedReason: string | null;
  onScan: (barcode: string) => DemoScanResult | null;
}

function feedbackMessage(result: DemoScanResult): string {
  switch (result.type) {
    case "added":
      return "Đã thêm vận đơn vào danh sách demo; chưa ghi nhận thu tiền.";
    case "invalid":
      return "Mã vận đơn không hợp lệ.";
    case "not_found":
    case "wrong_branch":
      return "Mã vận đơn không khả dụng trong phạm vi đang chọn.";
    case "duplicate":
      return "Vận đơn đã có trong danh sách quét demo.";
    case "wrong_driver":
      return "Vận đơn không thuộc tài xế đang chọn.";
    case "not_driver_holding":
      return "Vận đơn không còn ở trạng thái tài xế giữ tiền.";
    case "already_in_collection":
      return "Vận đơn đã thuộc bảng kê demo đang sử dụng.";
    case "collection_not_draft":
      return "Bảng kê demo không cho phép quét thêm.";
    case "mock_unavailable":
      return "Chức năng quét demo không khả dụng.";
  }
}

function focusScannerIfSafe(
  input: HTMLInputElement | null,
  submitButton?: HTMLButtonElement | null,
) {
  if (
    !input || input.disabled || !input.isConnected ||
    typeof window.matchMedia !== "function" ||
    !window.matchMedia("(pointer: fine)").matches ||
    document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden]):not([data-state="closed"])')
  ) return;

  const active = document.activeElement;
  if (active?.closest('dialog, [role="dialog"]')) return;
  if (submitButton ? active === submitButton : active === document.body || active === document.documentElement) {
    input.focus({ preventScroll: true });
  }
}

function ScannerForm({
  scopeKey,
  selectedDriver,
  scannedCount,
  canScan,
  blockedReason,
  onScan,
}: CollectionScannerProps) {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<DemoScanResult | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [previousEnabled, setPreviousEnabled] = useState(canScan && !!scopeKey && selectedDriver !== null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const helpId = useId();
  const reasonId = useId();
  const enabled = canScan && !!scopeKey && selectedDriver !== null;
  if (previousEnabled !== enabled) {
    setPreviousEnabled(enabled);
    if (!enabled) {
      setResult(null);
      setUnavailable(false);
    }
  }
  const reason = blockedReason?.trim() || (
    !scopeKey
      ? "Vui lòng chọn phạm vi hợp lệ để quét demo."
      : !selectedDriver
        ? "Vui lòng chọn tài xế trước khi quét demo."
        : "Chức năng quét demo hiện không khả dụng."
  );

  useLayoutEffect(() => {
    if (enabled) focusScannerIfSafe(inputRef.current);
  }, [enabled]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    const submitted = barcode.trim();
    setBarcode("");
    const scanResult = onScan(submitted);
    setResult(scanResult);
    setUnavailable(scanResult === null);
    focusScannerIfSafe(inputRef.current, submitRef.current);
  }

  return (
    <Card className="min-w-0 space-y-4 p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ScanBarcode className="h-5 w-5 shrink-0" aria-hidden="true" />
          Quét vận đơn thu tiền
        </h2>
        <p className="text-sm font-medium">
          Dữ liệu demo — quét mã không ghi nhận thu tiền thực tế.
        </p>
        <p id={helpId} className="text-sm text-muted-foreground">
          Quét barcode hoặc nhập mã vận đơn rồi nhấn Enter.
        </p>
      </div>

      {selectedDriver && (
        <p className="break-words text-sm">
          Tài xế: <span className="font-medium">{selectedDriver.name}</span>{" "}
          <span className="break-all font-mono text-xs font-medium sm:text-sm">
            {selectedDriver.id}
          </span>
        </p>
      )}
      <p className="text-sm">Đã quét: {scannedCount} vận đơn demo.</p>

      {!enabled && (
        <p id={reasonId} role="status" className="text-sm text-muted-foreground">
          {reason}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={inputId}>Mã vận đơn</Label>
          <Input
            ref={inputRef}
            id={inputId}
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            disabled={!enabled}
            autoComplete="off"
            className="font-mono font-medium"
            aria-describedby={enabled ? helpId : `${helpId} ${reasonId}`}
          />
        </div>
        <Button
          ref={submitRef}
          type="submit"
          disabled={!enabled}
          className="w-full sm:w-auto"
        >
          Thêm vận đơn
        </Button>
      </form>

      <div role="status" aria-live="polite" aria-atomic="true" className="text-sm">
        {enabled && result && (result.type !== "added" || scannedCount > 0) && (
          <p>
            <span className="font-semibold">{result.type === "added" ? "Đã thêm: " : "Không thể thêm: "}</span>
            {feedbackMessage(result)}
          </p>
        )}
        {enabled && unavailable && (
          <p>Không thể xử lý lượt quét demo. Vui lòng kiểm tra trạng thái và thử lại.</p>
        )}
      </div>
    </Card>
  );
}

export function CollectionScanner(props: CollectionScannerProps) {
  const contextKey = JSON.stringify([props.scopeKey, props.selectedDriver?.id ?? null]);
  return <ScannerForm key={contextKey} {...props} />;
}
