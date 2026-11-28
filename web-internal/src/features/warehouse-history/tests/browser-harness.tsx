import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WarehouseHistoryScreen } from "../pages/WarehouseHistoryPage";
import { ManifestPreview } from "../components/ManifestPreview";
import { createFixtures } from "../api/warehouse-history.mock";
import "@/index.css";
const context = { authenticated: true, can_read: true, roles: ["branch_manager"], branch_id: 3, warehouse_id: null, demo_scope: true, unlock_capability: true };
export function BrowserHarness() {
  const [branch, setBranch] = useState(3);
  const [allowed, setAllowed] = useState(true);
  const receipt = createFixtures()[1];
  receipt.receipt_code = "DEMO-LONG-" + "X".repeat(100);
  receipt.items = Array.from({ length: 180 }, (_, index) => ({ tracking_code: `DEMO-LONG-${index + 1}-${"X".repeat(60)}`, scanned_at: null, inbound_source_type: null, is_wrong_route: false, removed_at: null }));
  receipt.total_shipments = 180; receipt.total_bags = 0;
  return <main className="min-w-0 p-4"><div className="mb-4 flex flex-wrap gap-2"><button onClick={() => setBranch((value) => value === 3 ? 4 : 3)}>Test đổi chi nhánh</button><button onClick={() => setAllowed((value) => !value)}>Test quyền</button></div><Routes>
    <Route path="/qa/manifest" element={<ManifestPreview receipt={receipt} mock onClose={() => {}} />} />
    <Route path="*" element={<WarehouseHistoryScreen key={`${branch}-${allowed}`} context={{ ...context, branch_id: branch, can_read: allowed }} />} />
    <Route path="warehouse-history/:publicId" element={<WarehouseHistoryScreen key={`${branch}-${allowed}`} context={{ ...context, branch_id: branch, can_read: allowed }} />} />
  </Routes></main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><BrowserHarness /></BrowserRouter></StrictMode>);
