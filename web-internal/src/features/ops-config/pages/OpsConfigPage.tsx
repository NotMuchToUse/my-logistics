import { Settings } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { USE_MOCK } from "@/core/api/axiosClient";
import { OPS_CONFIG_TABS } from "../constants/ops-config.constants";
import { PartnersPanel } from "../components/PartnersPanel";
import { RoutingRulesPanel } from "../components/RoutingRulesPanel";
import { SlaDeadlinesPanel } from "../components/SlaDeadlinesPanel";
import { VehiclesPanel } from "../components/VehiclesPanel";
import { useOpsConfig } from "../hooks/useOpsConfig";
import { canManageOpsConfig } from "../utils/ops-config-access";

export function OpsConfigPage() {
  const roles = useAuthStore((state) => state.roles);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const activeScope = useBranchScopeStore((state) => state.activeScope);
  const canManage = canManageOpsConfig(
    roles,
    hasPermission("system.manage_settings"),
    activeScope?.scope_type ?? null,
  );
  const config = useOpsConfig(canManage);

  if (!canManage) {
    return (
      <section className="min-w-0">
        <EmptyState
          icon={Settings}
          title="Không có quyền truy cập"
          description="Trang này chỉ dành cho tài khoản system_admin có quyền system.manage_settings trong phạm vi HQ."
        />
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Cấu hình vận hành
          </h1>
          <span
            className={
              USE_MOCK
                ? "w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                : "w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800"
            }
          >
            {USE_MOCK ? "MOCK ONLY" : "API thật BLOCKED"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Quản lý SLA, ma trận định tuyến, đối tác 3PL và phương tiện trong
          phạm vi cấu hình vận hành hệ thống.
        </p>
      </header>

      {!USE_MOCK ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            API thật BLOCKED: chưa xác nhận method, payload, response, lookup
            và permission mapping. Không gửi request hoặc tự động chuyển sang
            Mock Mode.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void config.reloadLookups()}
          >
            Thử tải lại
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Mock Mode: thay đổi được lưu trong phiên làm việc hiện tại; chưa
          đồng bộ Backend.
        </p>
      )}

      {config.lookupError ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được dữ liệu tham chiếu: {config.lookupError}
        </p>
      ) : null}

      <Tabs defaultValue="sla" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          {OPS_CONFIG_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="w-full whitespace-normal text-center"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sla" className="mt-4 min-w-0">
          <SlaDeadlinesPanel
            state={config.slaDeadlines}
            lookups={config.lookups}
            lookupLoading={config.lookupLoading}
            canEdit={USE_MOCK}
          />
        </TabsContent>

        <TabsContent value="routing" className="mt-4 min-w-0">
          <RoutingRulesPanel
            state={config.routingRules}
            lookups={config.lookups}
            lookupLoading={config.lookupLoading}
            canEdit={USE_MOCK}
          />
        </TabsContent>

        <TabsContent value="partners-vehicles" className="mt-4 min-w-0">
          <Tabs defaultValue="partners" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-2">
              <TabsTrigger value="partners" className="w-full">
                Đối tác 3PL
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="w-full">
                Phương tiện
              </TabsTrigger>
            </TabsList>
            <TabsContent value="partners" className="mt-4 min-w-0">
              <PartnersPanel state={config.partners} canEdit={USE_MOCK} />
            </TabsContent>
            <TabsContent value="vehicles" className="mt-4 min-w-0">
              <VehiclesPanel
                state={config.vehicles}
                lookups={config.lookups}
                lookupLoading={config.lookupLoading}
                canEdit={USE_MOCK}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </section>
  );
}
