import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { PRICING_CATALOG_TABS } from "../constants/pricing-catalog.constants";
import { CatalogResourcePanel } from "../components/CatalogResourcePanel";
import type { CatalogColumn } from "../components/CatalogTable";
import {
  usePricingTariffs,
  useServiceTypes,
  useSurcharges,
  useValueAddedServices,
  useWeightConversionRules,
} from "../hooks/usePricingCatalog";
import type {
  PricingTariff,
  ServiceType,
  Surcharge,
  ValueAddedService,
  WeightConversionRule,
} from "../types/pricing-catalog.types";

function activeBadge(active: number | boolean) {
  const isActive = active === 1 || active === true;
  return (
    <Badge variant="outline" className={isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
      {isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
    </Badge>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

function ServiceTypesTab({ canManage }: { canManage: boolean }) {
  const state = useServiceTypes();
  const columns: CatalogColumn<ServiceType>[] = [
    { key: "code", label: "Mã", render: (row) => <span className="font-mono text-sm">{row.code}</span> },
    { key: "name", label: "Tên dịch vụ", render: (row) => row.name },
    { key: "days", label: "SLA ngày", render: (row) => `${row.estimated_days_min}–${row.estimated_days_max}` },
    { key: "status", label: "Trạng thái", render: (row) => activeBadge(row.is_active) },
  ];
  return (
    <CatalogResourcePanel
      kind="service_types"
      title="Dịch vụ chính"
      description="Quản lý dịch vụ chuyển phát và SLA ngày."
      state={state}
      columns={columns}
      canManage={canManage}
    />
  );
}

function ValueAddedServicesTab({ canManage }: { canManage: boolean }) {
  const state = useValueAddedServices();
  const columns: CatalogColumn<ValueAddedService>[] = [
    { key: "code", label: "Mã", render: (row) => <span className="font-mono text-sm">{row.code}</span> },
    { key: "name", label: "Tên dịch vụ", render: (row) => row.name },
    { key: "fee_type", label: "Cách tính", render: (row) => row.fee_type === "percentage" ? "Phần trăm" : "Cố định" },
    { key: "fee_value", label: "Giá trị phí", render: (row) => row.fee_type === "percentage" ? `${row.fee_value}%` : formatCurrency(row.fee_value), align: "right" },
    { key: "status", label: "Trạng thái", render: (row) => activeBadge(row.is_active) },
  ];
  return (
    <CatalogResourcePanel
      kind="value_added_services"
      title="Dịch vụ gia tăng"
      description="Quản lý bảo hiểm, đồng kiểm, báo phát và dịch vụ gia tăng khác."
      state={state}
      columns={columns}
      canManage={canManage}
    />
  );
}

function SurchargesTab({ canManage }: { canManage: boolean }) {
  const state = useSurcharges();
  const columns: CatalogColumn<Surcharge>[] = [
    { key: "code", label: "Mã", render: (row) => <span className="font-mono text-sm">{row.code}</span> },
    { key: "name", label: "Tên phụ phí", render: (row) => row.name },
    { key: "fee_type", label: "Cách tính", render: (row) => row.fee_type === "percentage" ? "Phần trăm" : "Cố định" },
    { key: "fee_value", label: "Giá trị", render: (row) => row.fee_type === "percentage" ? `${row.fee_value}%` : formatCurrency(row.fee_value), align: "right" },
    { key: "auto", label: "Tự động", render: (row) => activeBadge(row.is_auto_applied) },
    { key: "status", label: "Trạng thái", render: (row) => activeBadge(row.is_active) },
  ];
  return (
    <CatalogResourcePanel
      kind="surcharges"
      title="Phụ phí"
      description="Quản lý phụ phí vận chuyển và điều kiện tự động áp dụng."
      state={state}
      columns={columns}
      canManage={canManage}
    />
  );
}

function TariffsAndRulesTab({ canManage }: { canManage: boolean }) {
  const tariffs = usePricingTariffs();
  const rules = useWeightConversionRules();
  const tariffColumns: CatalogColumn<PricingTariff>[] = [
    { key: "zone_type", label: "Vùng", render: (row) => row.zone_type },
    { key: "service_type_id", label: "Mã dịch vụ", render: (row) => row.service_type_id },
    { key: "weight", label: "Khung trọng lượng", render: (row) => `${row.min_weight_gram.toLocaleString("vi-VN")}–${row.max_weight_gram.toLocaleString("vi-VN")} g` },
    { key: "base_price", label: "Giá cơ bản", render: (row) => formatCurrency(row.base_price), align: "right" },
    { key: "status", label: "Trạng thái", render: (row) => activeBadge(row.is_active) },
  ];
  const ruleColumns: CatalogColumn<WeightConversionRule>[] = [
    { key: "service_type_id", label: "Mã dịch vụ", render: (row) => row.service_type_id },
    { key: "divisor", label: "Divisor", render: (row) => row.divisor, align: "right" },
    { key: "min_chargeable_gram", label: "Trọng lượng tối thiểu", render: (row) => `${row.min_chargeable_gram.toLocaleString("vi-VN")} g`, align: "right" },
    { key: "effective", label: "Hiệu lực", render: (row) => `${row.effective_from}${row.effective_to ? ` → ${row.effective_to}` : ""}` },
  ];

  return (
    <div className="space-y-8">
      <CatalogResourcePanel
        kind="pricing_tariffs"
        title="Bảng giá cước"
        description="Quản lý mức giá theo dịch vụ, vùng và khung trọng lượng."
        state={tariffs}
        columns={tariffColumns}
        canManage={canManage}
      />
      <CatalogResourcePanel
        kind="weight_conversion_rules"
        title="Quy tắc quy đổi trọng lượng"
        description="Quản lý divisor và trọng lượng tính cước tối thiểu."
        state={rules}
        columns={ruleColumns}
        canManage={canManage}
      />
    </div>
  );
}

export function PricingCatalogPage() {
  const roles = useAuthStore((state) => state.roles);
  const canManage = roles.includes("system_admin") || roles.includes("system_dev");

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Danh mục & bảng giá</h1>
        <p className="text-sm text-muted-foreground">Quản lý dịch vụ vận chuyển, dịch vụ gia tăng, phụ phí và bảng giá cước.</p>
      </header>

      <Tabs defaultValue="service-types" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_CATALOG_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="w-full">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="service-types">
          <ServiceTypesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="value-added-services">
          <ValueAddedServicesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="surcharges">
          <SurchargesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="tariffs-and-rules">
          <TariffsAndRulesTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
