import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollectionDraft } from "../components/CollectionDraft";
import { CollectionScanner } from "../components/CollectionScanner";
import { DriverDebtList } from "../components/DriverDebtList";
import { useBranchCodCollection } from "../hooks/useBranchCodCollection";

function BranchCodCollectionSession({ onRestart }: { onRestart: () => void }) {
  const collection = useBranchCodCollection();
  const hasDraft = collection.history.some((entry) => entry.status === "draft");
  const hasSession = collection.scannedTotal !== null;
  const selectionBlockedReason = hasDraft
    ? "draft"
    : collection.scanned.length > 0
      ? "scanned"
      : null;
  const scopeKey = collection.scope
    ? JSON.stringify([collection.scope.scope_type, collection.scope.branch_id, collection.scope.warehouse_id])
    : null;

  const blockedReason = !collection.isMockMode
    ? "Chức năng quét demo chỉ khả dụng trong chế độ Mock."
    : !collection.hasRead
      ? "Bạn không có quyền xem công nợ tài xế."
      : !collection.hasCollect
        ? "Bạn không có quyền thu tiền demo."
        : !collection.isScopeValid
          ? "Vui lòng chọn phạm vi chi nhánh hoặc bưu cục hợp lệ."
          : !hasSession
            ? "Phiên demo không khả dụng."
            : !collection.selectedDriver
              ? "Vui lòng chọn tài xế trước khi quét demo."
              : hasDraft
                ? "Hãy khóa hoặc hủy bảng kê nháp demo trước khi quét."
                : collection.currentCollection
                  ? "Hãy bắt đầu bảng kê mới trước khi quét tiếp."
                  : null;

  const canStartNew = collection.isMockMode && collection.hasRead &&
    collection.hasCollect && collection.isScopeValid && hasSession &&
    !hasDraft && collection.scanned.length === 0 &&
    (collection.currentCollection?.status === "locked" ||
      collection.currentCollection?.status === "cancelled");
  const sessionError = collection.error && !hasSession ? collection.error : null;

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Thu tiền COD tài xế</h1>
        <p className="text-sm text-muted-foreground">
          Tra cứu công nợ, quét vận đơn và lập bảng kê thu tiền.
        </p>
        {collection.isMockMode && collection.hasRead && collection.scope && (
          <p className="text-sm">
            Phạm vi: {collection.scope.scope_type === "branch" ? "Chi nhánh" : "Bưu cục"}{" "}
            <span className="font-mono text-xs font-medium sm:text-sm">{collection.scope.branch_id}</span>
          </p>
        )}
      </header>

      {!collection.isMockMode ? (
        <p role="status" className="rounded-md border p-4 text-sm">
          Chức năng chưa tích hợp Backend Finance; không có thao tác thu tiền tại trang này.
        </p>
      ) : (
        <>
          <div role="note" className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">DEMO — Không phát sinh giao dịch tài chính thật.</p>
            <p>Dữ liệu demo chỉ tồn tại trong phiên làm việc và sẽ mất khi tải lại trang.</p>
          </div>

          {sessionError && (
            <div role="alert" className="space-y-2 rounded-md border border-destructive p-4 text-sm">
              <p>{sessionError}</p>
              {collection.hasRead && collection.isScopeValid && (
                <>
                  <p>Khởi tạo lại sẽ xóa dữ liệu demo của phiên hiện tại.</p>
                  <Button type="button" variant="outline" onClick={onRestart}>
                    Khởi tạo lại phiên Demo
                  </Button>
                </>
              )}
            </div>
          )}

          {!sessionError && (
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <DriverDebtList
                driverDebts={collection.driverDebts}
                currentDebt={collection.currentDebt}
                isMockMode={collection.isMockMode}
                hasRead={collection.hasRead}
                isScopeValid={collection.isScopeValid}
                error={collection.error}
                selectionBlockedReason={selectionBlockedReason}
                onSelectDriver={(driverId) => {
                  const result = collection.selectDriver(driverId);
                  if (!result.ok) toast.error("Không thể chọn tài xế demo. Vui lòng kiểm tra trạng thái và quyền.");
                }}
              />
              <div className="min-w-0 space-y-4">
                <CollectionScanner
                  scopeKey={scopeKey}
                  selectedDriver={collection.selectedDriver}
                  scannedCount={collection.scanned.length}
                  canScan={blockedReason === null}
                  blockedReason={blockedReason}
                  onScan={collection.scanBarcode}
                />
                <CollectionDraft
                  isMockMode={collection.isMockMode}
                  hasRead={collection.hasRead}
                  hasCollect={collection.hasCollect}
                  isScopeValid={collection.isScopeValid}
                  scope={collection.scope}
                  selectedDriver={collection.selectedDriver}
                  driverDebts={collection.driverDebts}
                  scanned={collection.scanned}
                  scannedTotal={collection.scannedTotal}
                  currentCollection={collection.currentCollection}
                  history={collection.history}
                  canCreate={collection.canCreate}
                  canLock={collection.canLock}
                  canCancel={collection.canCancel}
                  canStartNew={canStartNew}
                  onRemoveScanned={collection.removeScanned}
                  onClearScanned={collection.clearScanned}
                  onCreate={collection.createCollection}
                  onLock={collection.lockCollection}
                  onCancel={collection.cancelCollection}
                  onStartNew={collection.startNewCollection}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function BranchCodCollectionPage() {
  const [sessionVersion, setSessionVersion] = useState(0);

  return (
    <BranchCodCollectionSession
      key={sessionVersion}
      onRestart={() => setSessionVersion((version) => version + 1)}
    />
  );
}
