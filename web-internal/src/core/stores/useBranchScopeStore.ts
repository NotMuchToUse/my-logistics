import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserBranchScope } from "@/types/rbac.types";

function getScopeKey(scope: UserBranchScope): string {
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
  setScopes: (scopes: UserBranchScope[]) => void;
  switchBranch: (branchId: number) => void;
  clearScopes: () => void;
}

export const useBranchScopeStore = create<BranchScopeState>()(
  persist(
    (set, get) => ({
      scopes: [],
      activeScope: null,
      activeBranchId: null,
      setScopes: (scopes) => {
        const currentScope = get().activeScope;
        const activeScope =
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
        });
      },
      switchBranch: (branchId) => {
        const activeScope = get().scopes.find(
          (scope) => scope.branch_id === branchId,
        );

        if (!activeScope) {
          throw new RangeError("Chi nhánh không thuộc phạm vi được cấp.");
        }

        set({
          activeScope,
          activeBranchId: activeScope.branch_id,
        });
      },
      clearScopes: () =>
        set({
          scopes: [],
          activeScope: null,
          activeBranchId: null,
        }),
    }),
    {
      name: "vietstar-internal-branch-scope",
    },
  ),
);
