import { createRoot } from "react-dom/client";
import "@/index.css";
import { BranchRemittancePage } from "../pages/BranchRemittancePage";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";

const scope = { scope_type: "post_office" as const, branch_id: 4, warehouse_id: null, is_primary: true, branch_name: "Bưu cục Sơn Trà" };
useAuthStore.setState({
  user: { public_id: "01JDC9X8K2M4N6P8Q0R2S4T6V8", must_change_password: 0 },
  token: "harness-only-token",
  roles: ["branch_accountant"],
  permissions: ["finance.read", "finance.remit"],
  isAuthenticated: true,
});
useBranchScopeStore.setState({ scopes: [scope], activeScope: scope, activeBranchId: 4, activeWarehouseId: null });

createRoot(document.getElementById("root")!).render(<BranchRemittancePage />);
