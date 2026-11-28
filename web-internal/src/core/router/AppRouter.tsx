import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { ProtectedRoute } from "@/core/guards/ProtectedRoute";
import { InternalLayout } from "@/layouts/InternalLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AuthPage } from "@/features/auth/pages/AuthPage";
import { NetworkOrgPage } from "@/features/network-org/pages/NetworkOrgPage";
import { UserManagementPage } from "@/features/user-management/pages/UserManagementPage";
import { PricingCatalogPage } from "@/features/pricing-catalog/pages/PricingCatalogPage";
import { OpsConfigPage } from "@/features/ops-config/pages/OpsConfigPage";
import { PickupDispatchPage } from "@/features/pickup-dispatch/pages/PickupDispatchPage";
import { ShipmentCreatePage } from "@/features/shipment-create/pages/ShipmentCreatePage";
import { ShipmentListPage } from "@/features/shipment-list/pages/ShipmentListPage";
import { ShipmentDetailPage } from "@/features/shipment-detail/pages/ShipmentDetailPage";
import { ShipmentBulkImportPage } from "@/features/shipment-bulk-import/pages/ShipmentBulkImportPage";
import { ShipmentExceptionsPage } from "@/features/shipment-exceptions/pages/ShipmentExceptionsPage";
import { ShipmentIncidentsPage } from "@/features/shipment-incidents/pages/ShipmentIncidentsPage";
import { BranchApprovalsPage } from "@/features/branch-approvals/pages/BranchApprovalsPage";
import { WaybillPrintPage } from "@/features/waybill-print/pages/WaybillPrintPage";
import { WarehouseInboundPage } from "@/features/warehouse-inbound/pages/WarehouseInboundPage";
import { WarehouseBagsPage } from "@/features/warehouse-bags/pages/WarehouseBagsPage";
import { WarehouseOutboundLinehaulPage } from "@/features/warehouse-outbound-linehaul/pages/WarehouseOutboundLinehaulPage";
import { WarehouseOutboundDeliveryPage } from "@/features/warehouse-outbound-delivery/pages/WarehouseOutboundDeliveryPage";
import { WarehouseHistoryPage } from "@/features/warehouse-history/pages/WarehouseHistoryPage";
import { WarehouseAuditPage } from "@/features/warehouse-audit/pages/WarehouseAuditPage";
import { BranchCodCollectionPage } from "@/features/branch-cod-collection/pages/BranchCodCollectionPage";
import { BranchRemittancePage } from "@/features/branch-remittance/pages/BranchRemittancePage";
import { HqFinancePage } from "@/features/hq-finance/pages/HqFinancePage";
import { CompensationsPage } from "@/features/compensations/pages/CompensationsPage";
import { DriverGpsMonitorPage } from "@/features/driver-gps-monitor/pages/DriverGpsMonitorPage";
import { ReportsAnalyticsPage } from "@/features/reports-analytics/pages/ReportsAnalyticsPage";
import { SystemLogsSettingsPage } from "@/features/system-logs-settings/pages/SystemLogsSettingsPage";

function NotFoundPage() {
  return (
    <section className="space-y-2 py-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Không tìm thấy trang
      </h1>
      <p className="text-sm text-muted-foreground">
        Đường dẫn bạn truy cập không tồn tại.
      </p>
    </section>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <InternalLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/shipment-list" replace />} />
          <Route path="auth" element={<AuthPage />} />
          <Route path="network-org" element={<NetworkOrgPage />} />
          <Route path="user-management" element={<UserManagementPage />} />
          <Route path="pricing-catalog" element={<PricingCatalogPage />} />
          <Route path="ops-config" element={<OpsConfigPage />} />
          <Route path="pickup-dispatch" element={<PickupDispatchPage />} />
          <Route path="shipment-create" element={<ShipmentCreatePage />} />
          <Route path="shipment-list" element={<ShipmentListPage />} />
          <Route path="shipment-detail/:publicId?" element={<ShipmentDetailPage />} />
          <Route
            path="shipment-bulk-import"
            element={<ShipmentBulkImportPage />}
          />
          <Route
            path="shipment-exceptions"
            element={<ShipmentExceptionsPage />}
          />
          <Route
            path="shipment-incidents"
            element={<ShipmentIncidentsPage />}
          />
          <Route path="branch-approvals" element={<BranchApprovalsPage />} />
          <Route path="waybill-print" element={<WaybillPrintPage />} />
          <Route path="warehouse-inbound" element={<WarehouseInboundPage />} />
          <Route path="warehouse-bags" element={<WarehouseBagsPage />} />
          <Route
            path="warehouse-outbound-linehaul"
            element={<WarehouseOutboundLinehaulPage />}
          />
          <Route
            path="warehouse-outbound-delivery"
            element={<WarehouseOutboundDeliveryPage />}
          />
          <Route path="warehouse-history" element={<WarehouseHistoryPage />} />
          <Route path="warehouse-history/:publicId" element={<WarehouseHistoryPage />} />
          <Route path="warehouse-audit" element={<WarehouseAuditPage />} />
          <Route
            path="branch-cod-collection"
            element={<BranchCodCollectionPage />}
          />
          <Route
            path="branch-remittance"
            element={<BranchRemittancePage />}
          />
          <Route path="hq-finance" element={<HqFinancePage />} />
          <Route path="compensations" element={<CompensationsPage />} />
          <Route
            path="driver-gps-monitor"
            element={<DriverGpsMonitorPage />}
          />
          <Route
            path="reports-analytics"
            element={<ReportsAnalyticsPage />}
          />
          <Route
            path="system-logs-settings"
            element={<SystemLogsSettingsPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
