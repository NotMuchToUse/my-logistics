import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserBranchScope } from "@/types/rbac.types";

export function getScopeKey(scope: UserBranchScope): string {
  return [
    scope.scope_type,
    scope.branch_id ?? "none",
    scope.warehouse_id ?? "none",
  ].join(":");
}

export interface BranchScopeState {
  scopes: UserBranchScope[];
  activeScope: UserBranchScope | null;
  activeBranchId: number | null;
  activeWarehouseId: number | null;
  setScopes: (scopes: UserBranchScope[]) => void;
  switchBranch: (branchId: number) => void;
  switchScope: (scopeKey: string) => void;
  clearScopes: () => void;
}

export const useBranchScopeStore = create<BranchScopeState>()(
  persist(
    (set, get) => ({
      scopes: [],
      activeScope: null,
      activeBranchId: null,
      activeWarehouseId: null,
      setScopes: (scopes) => {
        const currentScope = get().activeScope;
        const activeScope =
          scopes.find((scope) => scope.is_primary === true) ??
          (currentScope
            ? scopes.find(
                (scope) => getScopeKey(scope) === getScopeKey(currentScope),
              )
            : undefined) ??
          scopes.find((scope) => scope.branch_id !== null) ??
          scopes[0] ??
          null;

        set({
          scopes,
          activeScope,
          activeBranchId: activeScope?.branch_id ?? null,
          activeWarehouseId: activeScope?.warehouse_id ?? null,
        });
      },
      switchBranch: (branchId) => {
        const matchingScopes = get().scopes.filter(
          (scope) => scope.branch_id === branchId,
        );
        const activeScope =
          matchingScopes.find((scope) => scope.is_primary === true) ??
          matchingScopes[0];

        if (!activeScope) {
          throw new RangeError("Chi nhánh không thuộc phạm vi được cấp.");
        }

        set({
          activeScope,
          activeBranchId: activeScope.branch_id,
          activeWarehouseId: activeScope.warehouse_id,
        });
      },
      switchScope: (scopeKey) => {
        const activeScope = get().scopes.find(
          (scope) => getScopeKey(scope) === scopeKey,
        );

        if (!activeScope) {
          throw new RangeError("Phạm vi không thuộc danh sách được cấp.");
        }

        set({
          activeScope,
          activeBranchId: activeScope.branch_id,
          activeWarehouseId: activeScope.warehouse_id,
        });
      },
      clearScopes: () =>
        set({
          scopes: [],
          activeScope: null,
          activeBranchId: null,
          activeWarehouseId: null,
        }),
    }),
    {
      name: "vietstar-internal-branch-scope",
    },
  ),
);
