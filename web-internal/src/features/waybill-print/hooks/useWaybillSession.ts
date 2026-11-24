import { useMemo } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import type { WaybillSession } from "../types/waybillPrint.types";

export function useWaybillSession(): WaybillSession {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const roles = useAuthStore((state) => state.roles);
  const permissions = useAuthStore((state) => state.permissions);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const scopes = useBranchScopeStore((state) => state.scopes);
  const activeScope = useBranchScopeStore((state) => state.activeScope);
  const activeBranchId = useBranchScopeStore((state) => state.activeBranchId);

  return useMemo(() => ({
    key: JSON.stringify([
      user?.public_id,
      token,
      roles,
      permissions,
      activeScope,
      activeBranchId,
      scopes,
    ]),
    branchId: activeBranchId === null ? null : String(activeBranchId),
    authenticated: authenticated && Boolean(token),
    roles,
    allowedBranchIds: scopes.flatMap((scope) =>
      scope.branch_id === null ? [] : [String(scope.branch_id)],
    ),
    branchOptions: scopes.flatMap((scope) =>
      scope.branch_id === null
        ? []
        : [{
            id: String(scope.branch_id),
            name: scope.branch_name ?? `Chi nhánh ${scope.branch_id}`,
          }],
    ),
    allBranches: scopes.some((scope) => scope.scope_type === "hq_all"),
  }), [
    activeBranchId,
    activeScope,
    authenticated,
    permissions,
    roles,
    scopes,
    token,
    user?.public_id,
  ]);
}
