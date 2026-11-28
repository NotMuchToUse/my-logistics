import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVndCurrency } from "@/core/utils/formatters";
import type { useBranchCodCollection } from "../hooks/useBranchCodCollection";
import type {
  DemoBranchScope,
  DemoCashCollection,
  DemoCollectionItem,
  DemoDriver,
  DemoDriverDebt,
  DemoVnd,
} from "../types/branch-cod-collection.types";

type Hook = ReturnType<typeof useBranchCodCollection>;

export interface CollectionDraftProps {
  isMockMode: boolean;
  hasRead: boolean;
  hasCollect: boolean;
  isScopeValid: boolean;
  scope: DemoBranchScope | null;
  selectedDriver: DemoDriver | null;
  driverDebts: readonly DemoDriverDebt[];
  scanned: readonly DemoCollectionItem[];
  scannedTotal: DemoVnd | null;
  currentCollection: DemoCashCollection | null;
  history: readonly DemoCashCollection[];
  canCreate: boolean;
  canLock: boolean;
  canCancel: boolean;
  canStartNew: boolean;
  onRemoveScanned: Hook["removeScanned"];
  onClearScanned: Hook["clearScanned"];
  onCreate: Hook["createCollection"];
  onLock: Hook["lockCollection"];
  onCancel: Hook["cancelCollection"];
  onStartNew: Hook["startNewCollection"];
}

type DialogAction = "clear" | "lock" | "cancel";

interface PendingAction {
  action: DialogAction;
  scopeKey: string;
  signature: string;
  collectionId: string | null;
  description: string;
}

interface FocusReturn {
  pending: PendingAction;
  trigger: HTMLButtonElement;
  succeeded: boolean;
  interrupted: boolean;
}

function scopeKey(scope: DemoBranchScope | null): string | null {
  return scope ? JSON.stringify([scope.scope_type, scope.branch_id, scope.warehouse_id]) : null;
}

function sameScope(left: DemoBranchScope, right: DemoBranchScope | null): boolean {
  return right !== null && scopeKey(left) === scopeKey(right);
}

function canView(props: CollectionDraftProps): boolean {
  return props.isMockMode && props.hasRead && props.isScopeValid && props.scope !== null;
}

function pendingValid(pending: PendingAction, props: CollectionDraftProps): boolean {
  if (!canView(props) || !props.hasCollect || scopeKey(props.scope) !== pending.scopeKey) return false;
  if (pending.action === "clear") {
    return props.currentCollection === null && props.scanned.length > 0 &&
      JSON.stringify(props.scanned) === pending.signature;
  }
  const collection = props.currentCollection;
  return collection !== null && collection.id === pending.collectionId &&
    collection.status === "draft" && sameScope(collection.scope, props.scope) &&
    JSON.stringify(collection) === pending.signature &&
    (pending.action === "lock" ? props.canLock : props.canCancel);
}

function driverName(driverId: string, debts: readonly DemoDriverDebt[]): string {
  const driver = debts.find((entry) => entry.driver.id === driverId)?.driver;
  return driver ? `${driver.name} (${driver.id})` : driverId;
}

function CollectionDraftContent(props: CollectionDraftProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const newCollectionRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusReturnRef = useRef<FocusReturn | null>(null);
  const stopFocusWatchRef = useRef<(() => void) | null>(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(false);
  const propsRef = useRef(props);
  const currentScopeKey = scopeKey(props.scope);
  const current = props.currentCollection && sameScope(props.currentCollection.scope, props.scope)
    ? props.currentCollection
    : null;
  const validPending = pending !== null && pendingValid(pending, props);
  const visible = canView(props);
  const items = current ? current.items : props.scanned;
  const total = current ? current.totalAmount : props.scannedTotal;
  const currentDriver = current
    ? driverName(current.driverId, props.driverDebts)
    : props.selectedDriver
      ? `${props.selectedDriver.name} (${props.selectedDriver.id})`
      : "Chưa chọn tài xế";

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopFocusWatchRef.current?.();
    };
  }, []);

  useLayoutEffect(() => {
    propsRef.current = props;
  }, [props]);

  if (pending && !validPending) setPending(null);

  function showResult(result: ReturnType<Hook["createCollection"]>, success: string) {
    if (result.ok) {
      setError(null);
      setMessage(success);
    } else {
      setMessage(null);
      setError("Không thể thực hiện thao tác demo. Vui lòng kiểm tra trạng thái và quyền.");
    }
  }

  function openDialog(action: DialogAction, event: MouseEvent<HTMLButtonElement>) {
    if (!visible || !props.hasCollect || !currentScopeKey) return;
    let next: PendingAction;
    if (action === "clear") {
      if (current || props.scanned.length === 0) return;
      next = {
        action,
        scopeKey: currentScopeKey,
        signature: JSON.stringify(props.scanned),
        collectionId: null,
        description: `Xóa ${props.scanned.length} vận đơn khỏi danh sách đang quét demo? Không có giao dịch thu tiền thật.`,
      };
    } else {
      if (!current || current.status !== "draft" || (action === "lock" ? !props.canLock : !props.canCancel)) return;
      const details = `Bảng kê demo ${current.id}; tài xế ${currentDriver}; ${current.items.length} vận đơn; tổng ${formatVndCurrency(current.totalAmount)}.`;
      next = {
        action,
        scopeKey: currentScopeKey,
        signature: JSON.stringify(current),
        collectionId: current.id,
        description: action === "lock"
          ? `${details} Bảng kê demo đã khóa không thể chỉnh sửa hoặc hủy. Đây không phải thao tác thu tiền thật.`
          : `${details} Hủy demo không thay đổi công nợ demo; có thể lập bảng kê mới. Không có giao dịch thu tiền thật.`,
      };
    }
    stopFocusWatchRef.current?.();
    focusReturnRef.current = { pending: next, trigger: event.currentTarget, succeeded: false, interrupted: false };
    const watchFocus = (interaction: Event) => {
      if (interaction.target instanceof Node && !dialogRef.current?.contains(interaction.target)) {
        if (focusReturnRef.current) focusReturnRef.current.interrupted = true;
      }
    };
    document.addEventListener("pointerdown", watchFocus, true);
    document.addEventListener("focusin", watchFocus, true);
    stopFocusWatchRef.current = () => {
      document.removeEventListener("pointerdown", watchFocus, true);
      document.removeEventListener("focusin", watchFocus, true);
      stopFocusWatchRef.current = null;
    };
    submittingRef.current = false;
    setError(null);
    setMessage(null);
    setPending(next);
  }

  function closeDialog() {
    setPending(null);
    submittingRef.current = false;
  }

  function confirm() {
    if (!pending || submittingRef.current || !pendingValid(pending, props)) return;
    submittingRef.current = true;
    const result = pending.action === "clear"
      ? props.onClearScanned()
      : pending.action === "lock" && pending.collectionId
        ? props.onLock(pending.collectionId)
        : pending.action === "cancel" && pending.collectionId
          ? props.onCancel(pending.collectionId)
          : { ok: false as const, reason: "invalid_state" as const };
    if (!result.ok) {
      submittingRef.current = false;
      showResult(result, "");
      return;
    }
    if (focusReturnRef.current) focusReturnRef.current.succeeded = true;
    showResult(result, pending.action === "lock"
      ? "Đã khóa bảng kê demo; không thu tiền thật."
      : pending.action === "cancel"
        ? "Đã hủy bảng kê demo; công nợ demo không thay đổi."
        : "Đã xóa danh sách quét demo.");
    setPending(null);
  }

  function handleCloseAutoFocus(event: Event) {
    event.preventDefault();
    const target = focusReturnRef.current;
    focusReturnRef.current = null;
    stopFocusWatchRef.current?.();
    submittingRef.current = false;
    const latest = propsRef.current;
    if (
      !target || target.interrupted || !mountedRef.current || !rootRef.current?.isConnected ||
      !canView(latest) || !latest.hasCollect ||
      scopeKey(latest.scope) !== target.pending.scopeKey
    ) return;
    const active = document.activeElement;
    if (
      active && active !== document.body && active !== document.documentElement &&
      !dialogRef.current?.contains(active)
    ) return;
    if (!target.succeeded && !pendingValid(target.pending, latest)) return;
    if (target.succeeded) {
      if (target.pending.action === "clear" && latest.scanned.length !== 0) return;
      if (target.pending.action !== "clear" &&
        (latest.currentCollection?.id !== target.pending.collectionId ||
          latest.currentCollection.status !== (target.pending.action === "lock" ? "locked" : "cancelled"))) return;
    }
    const preferred = target.succeeded ? newCollectionRef.current : target.trigger;
    const focusTarget = preferred?.isConnected && !preferred.disabled
      ? preferred
      : headingRef.current;
    if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
  }

  return (
    <Card ref={rootRef} className="min-w-0 space-y-4 p-4 sm:p-6">
      <div className="space-y-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold">Bảng kê thu tiền demo</h2>
        <p className="text-sm font-medium">DEMO — Không thu tiền thật.</p>
      </div>

      {!visible ? (
        <p role="status" className="text-sm text-muted-foreground">
          {!props.isMockMode
            ? "Bảng kê demo chỉ khả dụng trong chế độ Mock."
            : !props.hasRead
              ? "Bạn không có quyền xem bảng kê demo."
              : "Vui lòng chọn phạm vi chi nhánh hoặc bưu cục hợp lệ."}
        </p>
      ) : (
        <>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-sm">{message}</p>}
          <div className="space-y-2 rounded-md border p-4 text-sm">
            <p className="break-words">Tài xế: {currentDriver}</p>
            {current && (
              <p className="break-all">Mã bảng kê: <span className="font-mono text-xs font-medium sm:text-sm">{current.id}</span></p>
            )}
            <p>Số vận đơn: {items.length}</p>
            <p className="text-right tabular-nums">
              Tổng cần thu demo: <span className="font-semibold">{total === null ? "Chưa khả dụng" : formatVndCurrency(total)}</span>
            </p>
            <div>
              Trạng thái: {current
                ? <><StatusBadge status={current.status} /> <span>Demo</span></>
                : "Chưa lập bảng kê"}
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState title="Chưa có vận đơn" description="Danh sách demo hiện không có vận đơn." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>STT</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">COD</TableHead>
                  <TableHead className="text-right">Cước</TableHead>
                  <TableHead className="text-right">Cần thu</TableHead>
                  <TableHead>Trạng thái lúc quét</TableHead>
                  {!current && <TableHead>Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.shipmentId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">{item.barcode}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatVndCurrency(item.codAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatVndCurrency(item.freightAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatVndCurrency(item.amountDue)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.codTransactions[0]
                        ? <StatusBadge status={item.codTransactions[0].status} />
                        : "Không xác định"}
                    </TableCell>
                    {!current && (
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!props.hasCollect}
                          aria-label={`Xóa vận đơn ${item.barcode} khỏi danh sách demo`}
                          onClick={() => showResult(props.onRemoveScanned(item.shipmentId), "Đã xóa vận đơn khỏi danh sách demo.")}
                        >
                          Xóa
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!current && (
              <>
                <Button type="button" variant="outline" disabled={!props.hasCollect || items.length === 0} onClick={(event) => openDialog("clear", event)}>
                  Xóa danh sách quét
                </Button>
                <Button type="button" disabled={!props.hasCollect || !props.canCreate} onClick={() => showResult(props.onCreate(), "Đã lập bảng kê demo; chưa thu tiền thật.")}>
                  Lập bảng kê Demo
                </Button>
              </>
            )}
            {current?.status === "draft" && (
              <>
                <Button type="button" disabled={!props.hasCollect || !props.canLock} onClick={(event) => openDialog("lock", event)}>
                  Khóa bảng kê Demo
                </Button>
                <Button type="button" variant="outline" disabled={!props.hasCollect || !props.canCancel} onClick={(event) => openDialog("cancel", event)}>
                  Hủy bảng kê Demo
                </Button>
              </>
            )}
            {(current?.status === "locked" || current?.status === "cancelled") && (
              <Button ref={newCollectionRef} type="button" variant="outline" disabled={!props.hasCollect || !props.canStartNew} onClick={() => showResult(props.onStartNew(), "Sẵn sàng lập bảng kê demo mới.")}>
                Bắt đầu bảng kê mới
              </Button>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <h3 className="font-semibold">Lịch sử bảng kê demo trong phiên</h3>
            {props.history.filter((entry) => sameScope(entry.scope, props.scope)).length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bảng kê demo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã bảng kê</TableHead>
                    <TableHead>Tài xế</TableHead>
                    <TableHead className="text-right">Vận đơn</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.history.filter((entry) => sameScope(entry.scope, props.scope)).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">{entry.id}</TableCell>
                      <TableCell className="whitespace-nowrap">{driverName(entry.driverId, props.driverDebts)}</TableCell>
                      <TableCell className="text-right tabular-nums">{entry.items.length}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatVndCurrency(entry.totalAmount)}</TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge status={entry.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      <Dialog open={validPending} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent ref={dialogRef} onCloseAutoFocus={handleCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>
              {pending?.action === "lock" ? "Khóa bảng kê Demo" : pending?.action === "cancel" ? "Hủy bảng kê Demo" : "Xóa danh sách quét demo"}
            </DialogTitle>
            <DialogDescription>{pending?.description}</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>Quay lại</Button>
            <Button type="button" variant="destructive" disabled={!validPending} onClick={confirm}>
              {pending?.action === "lock" ? "Khóa bảng kê Demo" : pending?.action === "cancel" ? "Hủy bảng kê Demo" : "Xóa danh sách demo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function CollectionDraft(props: CollectionDraftProps) {
  const context = JSON.stringify([
    scopeKey(props.scope), props.isMockMode, props.hasRead, props.hasCollect, props.isScopeValid,
  ]);
  return <CollectionDraftContent key={context} {...props} />;
}
