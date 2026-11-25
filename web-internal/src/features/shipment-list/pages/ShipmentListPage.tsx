import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PermissionGuard } from "@/core/guards/PermissionGuard";
import { SHIPMENT_LIST_PERMISSIONS } from "../constants/shipment-list.constants.ts";
import { useShipmentList } from "../hooks/useShipmentList";
import { ShipmentDataTable } from "../components/ShipmentDataTable";
import { ShipmentExportButton } from "../components/ShipmentExportButton";
import { ShipmentListFilters } from "../components/ShipmentListFilters";

export function ShipmentListPage() {
  const list = useShipmentList();

  return (
    <PermissionGuard
      permission={SHIPMENT_LIST_PERMISSIONS.read}
      fallback={
        <EmptyState
          icon={PackageSearch}
          title="Không có quyền xem vận đơn"
          description="Tài khoản hiện tại chưa được cấp quyền shipment.read."
        />
      }
    >
      <section className="min-w-0 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Danh sách vận đơn
            </h1>
            <p className="text-sm text-muted-foreground">
              Tra cứu, lọc và theo dõi vận đơn trong phạm vi được cấp.
            </p>
          </div>
          <ShipmentExportButton list={list} />
        </header>

        <ShipmentListFilters list={list} />
        <ShipmentDataTable list={list} />
      </section>
    </PermissionGuard>
  );
}
