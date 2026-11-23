import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getScopeKey,
  useBranchScopeStore,
} from "@/core/stores/useBranchScopeStore";
import type { UserBranchScope } from "@/types/rbac.types";

function getScopeLabel(scope: UserBranchScope): string {
  if (scope.scope_type === "hq_all") {
    return "Toàn hệ thống";
  }

  const branchLabel =
    scope.branch_name ??
    (scope.scope_type === "post_office"
      ? `Bưu cục #${scope.branch_id}`
      : scope.scope_type === "region_center"
        ? `Trung tâm vùng #${scope.branch_id}`
        : `Chi nhánh #${scope.branch_id}`);

  if (scope.warehouse_id !== null) {
    const warehouseLabel =
      scope.warehouse_name ?? `Kho #${scope.warehouse_id}`;

    return `${branchLabel} · ${warehouseLabel}`;
  }

  return branchLabel;
}

export function BranchSwitcher() {
  const scopes = useBranchScopeStore((state) => state.scopes);
  const activeScope = useBranchScopeStore((state) => state.activeScope);
  const switchScope = useBranchScopeStore((state) => state.switchScope);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Label
        htmlFor="active-branch"
        className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline"
      >
        Phạm vi
      </Label>
      <Select
        value={activeScope ? getScopeKey(activeScope) : ""}
        onValueChange={switchScope}
        disabled={scopes.length === 0}
      >
        <SelectTrigger
          id="active-branch"
          className="h-9 max-w-[170px] truncate sm:max-w-[260px] [&>span]:truncate"
          aria-label="Chi nhánh, bưu cục hoặc kho đang thao tác"
        >
          <SelectValue placeholder="Chưa có phạm vi" />
        </SelectTrigger>
        <SelectContent>
          {scopes.map((scope) => (
            <SelectItem
              key={getScopeKey(scope)}
              value={getScopeKey(scope)}
            >
              {getScopeLabel(scope)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
