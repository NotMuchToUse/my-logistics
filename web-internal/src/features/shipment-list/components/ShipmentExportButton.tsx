import { useEffect, useMemo, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/core/stores/useAuthStore";
import {
  getScopeKey,
  useBranchScopeStore,
} from "@/core/stores/useBranchScopeStore";
import { fetchShipmentsApi } from "../api/shipment-list.api";
import type { useShipmentList } from "../hooks/useShipmentList";
import {
  canExportShipmentList,
  collectShipmentsForExport,
  downloadShipmentCsv,
  ShipmentExportAbortedError,
  ShipmentExportLimitError,
} from "../utils/shipment-list-export";
import { getShipmentErrorMessage } from "../utils/shipment-list-display";

type ShipmentListState = ReturnType<typeof useShipmentList>;

interface ShipmentExportButtonProps {
  list: ShipmentListState;
}

export function ShipmentExportButton({ list }: ShipmentExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const activeController = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const sessionKey = useAuthStore((state) =>
    JSON.stringify([
      state.isAuthenticated,
      state.user?.public_id ?? null,
      state.token,
      state.permissions,
    ]),
  );
  const canExport = useAuthStore((state) =>
    canExportShipmentList(state.isAuthenticated, state.permissions),
  );
  const hasMockOnlyBranchFilter =
    list.appliedFilters.origin_branch_id !== "" ||
    list.appliedFilters.destination_branch_id !== "";
  const contextKey = useMemo(
    () =>
      JSON.stringify([
        list.canRead,
        canExport,
        sessionKey,
        list.branchScope.key,
        list.appliedFilters,
        list.sorting,
        list.capabilities.branchFilters,
      ]),
    [
      list.appliedFilters,
      list.branchScope.key,
      list.canRead,
      canExport,
      list.capabilities.branchFilters,
      sessionKey,
      list.sorting,
    ],
  );
  const currentContextKey = useRef(contextKey);
  currentContextKey.current = contextKey;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeController.current?.abort();
    };
  }, []);

  useEffect(
    () => () => {
      activeController.current?.abort();
    },
    [contextKey],
  );

  const handleExport = async () => {
    if (
      !list.canRead ||
      !canExport ||
      exporting ||
      (!list.capabilities.branchFilters && hasMockOnlyBranchFilter)
    ) {
      return;
    }

    const controller = new AbortController();
    const startContextKey = contextKey;
    const scopeKey = list.branchScope.key;
    const startSessionKey = sessionKey;
    activeController.current = controller;
    setExporting(true);

    const isContextCurrent = () => {
      const auth = useAuthStore.getState();
      const scope = useBranchScopeStore.getState().activeScope;
      const currentScopeKey = scope ? getScopeKey(scope) : "none";
      const currentSessionKey = JSON.stringify([
        auth.isAuthenticated,
        auth.user?.public_id ?? null,
        auth.token,
        auth.permissions,
      ]);
      return (
        !controller.signal.aborted &&
        currentContextKey.current === startContextKey &&
        currentSessionKey === startSessionKey &&
        canExportShipmentList(auth.isAuthenticated, auth.permissions) &&
        currentScopeKey === scopeKey
      );
    };

    try {
      const rows = await collectShipmentsForExport({
        filters: list.appliedFilters,
        sorting: list.sorting,
        branchFiltersSupported: list.capabilities.branchFilters,
        scope: {
          branchId: list.branchScope.branchId,
          warehouseId: list.branchScope.warehouseId,
        },
        signal: controller.signal,
        isContextCurrent,
        fetchPage: fetchShipmentsApi,
      });

      if (!isContextCurrent()) {
        throw new ShipmentExportAbortedError();
      }

      downloadShipmentCsv(rows);
      toast.success(`Đã xuất ${rows.length.toLocaleString("vi-VN")} vận đơn CSV.`);
    } catch (error) {
      if (!mounted.current) return;
      if (
        error instanceof ShipmentExportAbortedError ||
        controller.signal.aborted
      ) {
        toast.warning(
          "Đã dừng xuất vì bộ lọc, quyền truy cập hoặc Branch Scope thay đổi.",
        );
      } else if (error instanceof ShipmentExportLimitError) {
        toast.error(error.message);
      } else {
        toast.error(getShipmentErrorMessage(error, "Không thể xuất file CSV."));
      }
    } finally {
      if (activeController.current === controller) {
        activeController.current = null;
      }
      if (mounted.current) setExporting(false);
    }
  };

  const disabled =
    !list.canRead ||
    !canExport ||
    exporting ||
    (!list.capabilities.branchFilters && hasMockOnlyBranchFilter);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => void handleExport()}
        aria-describedby="shipment-export-help"
      >
        {exporting ? (
          <LoaderCircle
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {exporting ? "Đang xuất..." : "Xuất CSV"}
      </Button>
      <p id="shipment-export-help" className="max-w-sm text-xs text-muted-foreground">
        Xuất toàn bộ kết quả đang lọc, giữ thứ tự sắp xếp; tối đa 5.000 dòng.
        Quyền xuất danh sách KHA-26 chưa được xác nhận; thao tác đang tạm khóa.
        Dữ liệu có thể thay đổi trong lúc tải nhiều trang.
      </p>
    </div>
  );
}
