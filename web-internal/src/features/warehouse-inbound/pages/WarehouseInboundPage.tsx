import { useLayoutEffect, useReducer } from "react";
import { FileCheck2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { getScopeKey, useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { BarcodeScannerInput } from "../components/BarcodeScannerInput";
import { InboundScanTable } from "../components/InboundScanTable";
import { InboundTypeSelector } from "../components/InboundTypeSelector";
import { useWarehouseInbound } from "../hooks/useWarehouseInbound";

function WarehouseInboundWorkspace() {
  const model = useWarehouseInbound();

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Nhập kho Barcode
        </h1>
        <p className="text-sm text-muted-foreground">
          Quét mã vận đơn hoặc mã túi để chuẩn bị danh sách nhập kho.
        </p>
      </header>

      <div role="note" className="flex gap-3 rounded-md border bg-muted/50 p-4 text-sm">
        <FlaskConical className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          {model.isMockMode
            ? "CHẾ ĐỘ DEMO — Dữ liệu chỉ lưu trong phiên trình duyệt, không tạo phiếu hay nhập kho thực tế. Chức năng chốt phiếu chưa khả dụng vì Backend chưa có contract."
            : "Chức năng quét demo chỉ khả dụng trong chế độ Mock. Backend chưa có contract để nhập kho hoặc chốt phiếu."}
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        <InboundTypeSelector
          value={model.inboundType}
          onChange={model.setInboundType}
          disabled={model.isInboundTypeLocked}
        />
      </Card>
      <BarcodeScannerInput {...model} />
      <InboundScanTable {...model} />

      <div className="flex flex-col gap-2 sm:items-end">
        <Button type="button" disabled aria-describedby="inbound-confirm-blocked" className="w-full sm:w-auto">
          <FileCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />
          Chốt phiếu nhập kho
        </Button>
        <p id="inbound-confirm-blocked" className="text-sm text-muted-foreground">
          Chưa thể chốt phiếu vì contract Backend chưa được xác nhận.
        </p>
      </div>
    </section>
  );
}

export function WarehouseInboundPage() {
  const [contextVersion, resetWorkspace] = useReducer((version: number) => version + 1, 0);

  useLayoutEffect(() => {
    const unsubscribeAuth = useAuthStore.subscribe((current, previous) => {
      if (
        current.token !== previous.token ||
        current.isAuthenticated !== previous.isAuthenticated ||
        current.user?.public_id !== previous.user?.public_id
      ) resetWorkspace();
    });
    const unsubscribeScope = useBranchScopeStore.subscribe((current, previous) => {
      const currentScope = current.activeScope ? getScopeKey(current.activeScope) : null;
      const previousScope = previous.activeScope ? getScopeKey(previous.activeScope) : null;
      if (
        currentScope !== previousScope ||
        current.activeBranchId !== previous.activeBranchId ||
        current.activeWarehouseId !== previous.activeWarehouseId
      ) resetWorkspace();
    });
    return () => {
      unsubscribeAuth();
      unsubscribeScope();
    };
  }, []);

  return <WarehouseInboundWorkspace key={contextVersion} />;
}
