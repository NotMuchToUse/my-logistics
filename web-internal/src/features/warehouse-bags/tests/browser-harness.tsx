import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../index.css";
import { Button } from "@/components/ui/button";
import { WarehouseBagsPage, WarehouseBagsReadView } from "../pages/WarehouseBagsPage";
import { createWarehouseBagsService } from "../api/warehouse-bags.api";
import { useWarehouseBags } from "../hooks/useWarehouseBags";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";

// Harness cô lập: không sửa auth, router hoặc Page; không xác nhận quyền vận hành.
function Harness() {
  const [mode, setMode] = useState("mock");
  const api = useMemo(() => createWarehouseBagsService({ useMock: mode !== "real", scenario: mode === "empty" ? "empty" : "default" }), [mode]);
  const model = useWarehouseBags(api);
  return <main className="mx-auto min-w-0 max-w-6xl space-y-6 p-4 sm:p-6">
    <p className="text-sm text-muted-foreground">Harness KHA-38 độc lập, không xác nhận RBAC hoặc điều hướng thật.</p>
    <div className="flex flex-wrap gap-2"><Button onClick={() => setMode("mock")}>Test Mock</Button><Button onClick={() => setMode("empty")}>Test Empty</Button><Button onClick={() => setMode("real")}>Test Real</Button><Button onClick={() => setMode("route")}>Test Route Block</Button><Button onClick={() => useBranchScopeStore.setState({ activeBranchId: 88, activeWarehouseId: null })}>Test Context</Button></div>
    {mode === "route" ? <WarehouseBagsPage /> : <WarehouseBagsReadView model={model} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Harness /></StrictMode>);
