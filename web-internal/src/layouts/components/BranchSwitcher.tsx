import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import type { UserBranchScope } from "@/types/rbac.types";

function getScopeLabel(scope: UserBranchScope): string {
  if (scope.scope_type === "warehouse" && scope.warehouse_id !== null) {
    return scope.warehouse_name ?? `Kho #${scope.warehouse_id}`;
  }

  if (scope.scope_type === "post_office") {
    return scope.branch_name ?? `Bưu cục #${scope.branch_id}`;
  }

  if (scope.scope_type === "region_center") {
    return scope.branch_name ?? `Trung tâm vùng #${scope.branch_id}`;
  }

  return scope.branch_name ?? `Chi nhánh #${scope.branch_id}`;
}

export function BranchSwitcher() {
  const scopes = useBranchScopeStore((state) => state.scopes);
  const activeBranchId = useBranchScopeStore(
    (state) => state.activeBranchId,
  );
  const switchBranch = useBranchScopeStore((state) => state.switchBranch);
  const branchScopes = useMemo(() => {
    const availableScopes = new Map<number, UserBranchScope>();

    for (const scope of scopes) {
      if (
        scope.branch_id !== null &&
        !availableScopes.has(scope.branch_id)
      ) {
        availableScopes.set(scope.branch_id, scope);
      }
    }

    return [...availableScopes.values()];
  }, [scopes]);

  function handleBranchChange(value: string): void {
    const branchId = Number(value);

    if (!Number.isSafeInteger(branchId)) {
      throw new RangeError("Mã chi nhánh không hợp lệ.");
    }

    switchBranch(branchId);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Label
        htmlFor="active-branch"
        className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline"
      >
        Phạm vi
      </Label>
      <Select
        value={activeBranchId === null ? "" : String(activeBranchId)}
        onValueChange={handleBranchChange}
        disabled={branchScopes.length === 0}
      >
        <SelectTrigger
          id="active-branch"
          className="h-9 max-w-[170px] truncate sm:max-w-[260px] [&>span]:truncate"
          aria-label="Chi nhánh, bưu cục hoặc kho đang thao tác"
        >
          <SelectValue placeholder="Chưa có phạm vi" />
        </SelectTrigger>
        <SelectContent>
          {branchScopes.map((scope) => (
            <SelectItem
              key={`${scope.scope_type}:${scope.branch_id}:${scope.warehouse_id}`}
              value={String(scope.branch_id)}
            >
              {getScopeLabel(scope)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
