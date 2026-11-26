import { ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BagClosingTab } from "../components/BagClosingTab";
import { BagOpeningTab } from "../components/BagOpeningTab";
import type { WarehouseBagsModel } from "../components/BagReadFeedback";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { USE_MOCK } from "@/core/api/axiosClient";
import { createWarehouseBagsDemoService, isWarehouseBagsDemoEnabled } from "../demo/warehouse-bags-demo.service";
import { useWarehouseBagsDemo } from "../hooks/useWarehouseBags";


// View dùng state hook duy nhất; harness kiểm thử độc lập không cấp quyền route.
export function WarehouseBagsReadView({ model }: { model: WarehouseBagsModel }) {
  return <section className="min-w-0 space-y-6">
    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Đóng túi &amp; Mở túi hàng</h1>
    <Tabs defaultValue="closing" className="min-w-0">
      <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="closing">Đóng túi hàng</TabsTrigger><TabsTrigger value="opening">Mở túi hàng</TabsTrigger></TabsList>
      <TabsContent value="closing"><BagClosingTab model={model} /></TabsContent>
      <TabsContent value="opening"><BagOpeningTab model={model} /></TabsContent>
    </Tabs>
  </section>;
}

function WarehouseBagsDemoPage() {
  const service = useMemo(() => createWarehouseBagsDemoService(), []);
  const model = useWarehouseBagsDemo(service);
  return <section className="space-y-4"><p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">CHẾ ĐỘ DEMO — Dữ liệu và thao tác giả lập, không ảnh hưởng hệ thống thật.</p><WarehouseBagsReadView model={model} /></section>;
}

export function WarehouseBagsPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const demoMode = isWarehouseBagsDemoEnabled({
    isDevelopment: import.meta.env.DEV === true,
    useMock: USE_MOCK,
    demoFlag: import.meta.env.VITE_WAREHOUSE_BAGS_DEMO,
    isAuthenticated,
    hasToken: Boolean(token),
  });
  if (demoMode) return <WarehouseBagsDemoPage />;
  return (
    <section className="min-w-0 space-y-4">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Đóng túi &amp; Mở túi hàng</h1>
      <div role="alert" className="flex gap-3 rounded-md border p-4 text-sm sm:p-6">
        <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="space-y-2"><p className="font-semibold">BLOCKED — Chưa xác nhận quyền truy cập trang.</p><p>Quyền đọc và phạm vi kho chưa được xác nhận. Vui lòng liên hệ người phụ trách để được mở truy cập.</p><p className="text-muted-foreground">Chức năng tạo, thêm vận đơn, niêm phong và mở túi đang khóa.</p></div>
      </div>
    </section>
  );
}
