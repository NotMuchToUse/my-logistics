import { useId, useLayoutEffect, useRef, type FormEvent } from "react";
import { ScanBarcode, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { useWarehouseInbound } from "../hooks/useWarehouseInbound";

export type BarcodeScannerInputProps = Pick<
  ReturnType<typeof useWarehouseInbound>,
  | "barcode"
  | "setBarcode"
  | "scanBarcode"
  | "lastResult"
  | "lastMessage"
  | "isMockMode"
  | "isProcessing"
  | "soundEnabled"
  | "setSoundEnabled"
  | "audioFeedback"
>;

function isActiveSidebarLink(active: Element | null): active is HTMLAnchorElement {
  return active instanceof HTMLAnchorElement &&
    active.getAttribute("aria-current") === "page" &&
    active.closest('nav[aria-label="Phân hệ vận hành"]') !== null;
}

function focusScannerIfSafe(
  input: HTMLInputElement | null,
  submitButton?: HTMLButtonElement | null,
  allowNavigationFocus = false,
) {
  if (!input || input.disabled || !input.isConnected) return;
  const active = document.activeElement;
  if (
    document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden]):not([data-state="closed"])') ||
    active?.closest('dialog, [role="dialog"]')
  ) return;
  if (active === input) return;
  if (
    active === document.body || active === document.documentElement ||
    active === submitButton || (allowNavigationFocus && isActiveSidebarLink(active))
  ) {
    input.focus();
  }
}

export function BarcodeScannerInput({
  barcode,
  setBarcode,
  scanBarcode,
  lastResult,
  lastMessage,
  isMockMode,
  isProcessing,
  soundEnabled,
  setSoundEnabled,
  audioFeedback,
}: BarcodeScannerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const cancelPendingFocusRef = useRef<(() => void) | null>(null);
  const inputId = useId();

  useLayoutEffect(() => () => cancelPendingFocusRef.current?.(), []);

  useLayoutEffect(() => {
    if (!isMockMode) return;

    const active = document.activeElement;
    const closingSidebar = isActiveSidebarLink(active)
      ? active.closest('[role="dialog"][data-state="closed"]')
      : null;
    const parent = closingSidebar?.parentNode;
    if (!closingSidebar || !parent) {
      focusScannerIfSafe(inputRef.current, null, true);
      return;
    }

    const stop = () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", stop, true);
      document.removeEventListener("keydown", stop, true);
    };
    const observer = new MutationObserver(() => {
      if (closingSidebar.isConnected) return;
      stop();
      focusScannerIfSafe(inputRef.current);
    });
    document.addEventListener("pointerdown", stop, true);
    document.addEventListener("keydown", stop, true);
    observer.observe(parent, { childList: true });
    return stop;
  }, [isMockMode]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isMockMode) return;
    cancelPendingFocusRef.current?.();
    const scan = scanBarcode();
    focusScannerIfSafe(inputRef.current, submitRef.current);

    const cancelFocus = () => {
      document.removeEventListener("focusin", handleFocusChange, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      if (cancelPendingFocusRef.current === cancelFocus) cancelPendingFocusRef.current = null;
    };
    const handleFocusChange = (focusEvent: FocusEvent) => {
      if (focusEvent.target !== inputRef.current) cancelFocus();
    };
    const handlePointerDown = (pointerEvent: PointerEvent) => {
      if (pointerEvent.target !== inputRef.current) cancelFocus();
    };
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Tab") cancelFocus();
    };
    const restoreFocus = () => {
      if (cancelPendingFocusRef.current !== cancelFocus) return;
      cancelFocus();
      focusScannerIfSafe(inputRef.current);
    };

    cancelPendingFocusRef.current = cancelFocus;
    document.addEventListener("focusin", handleFocusChange, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    void scan.then(restoreFocus).catch((error: unknown) => {
      console.error("Không thể xử lý lượt quét demo.", error);
      restoreFocus();
    });
  }

  const feedbackKind = lastResult?.type === "added"
    ? "success"
    : lastResult === null || lastResult.type === "mock_unavailable"
      ? "error"
      : "warning";
  const audioMessage = audioFeedback?.status === "unsupported"
    ? "Trình duyệt không hỗ trợ âm thanh quét."
    : audioFeedback?.status === "blocked"
      ? "Trình duyệt đang chặn âm thanh quét."
      : audioFeedback?.status === "error"
        ? "Không thể phát âm thanh quét."
        : null;

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ScanBarcode className="h-5 w-5" aria-hidden="true" />
          Quét Barcode
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Âm thanh quét"
          aria-pressed={soundEnabled}
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled
            ? <Volume2 className="mr-2 h-4 w-4" aria-hidden="true" />
            : <VolumeX className="mr-2 h-4 w-4" aria-hidden="true" />}
          Âm thanh: {soundEnabled ? "Bật" : "Tắt"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        {isMockMode
          ? isProcessing
            ? "Đang xử lý lượt quét; bạn có thể tiếp tục quét."
            : "Sẵn sàng quét dữ liệu demo."
          : "Chức năng quét chưa khả dụng ngoài chế độ Mock."}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={inputId}>Mã vận đơn hoặc mã túi hàng</Label>
          <Input
            ref={inputRef}
            id={inputId}
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            disabled={!isMockMode}
            autoComplete="off"
            className="font-mono font-medium"
          />
        </div>
        <Button ref={submitRef} type="submit" disabled={!isMockMode} className="w-full sm:w-auto">
          Thêm mã
        </Button>
      </form>

      <div role="status" aria-live="polite" aria-atomic="true">
        {lastMessage && (
          <div
            className={cn(
              "rounded-md border p-3 text-sm",
              feedbackKind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              feedbackKind === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
              feedbackKind === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            <span className="font-semibold">
              {feedbackKind === "success" ? "Đã thêm: " : feedbackKind === "warning" ? "Cảnh báo: " : "Lỗi: "}
            </span>
            {lastMessage}
          </div>
        )}
      </div>
      {soundEnabled && audioMessage && (
        <p role="status" className="text-sm text-muted-foreground">{audioMessage}</p>
      )}
    </Card>
  );
}
