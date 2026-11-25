import type { RoleCode, ScopeType } from "../../../types/rbac.types.ts";

export function canManageOpsConfig(
  roles: readonly RoleCode[],
  hasSettingsPermission: boolean,
  scopeType: ScopeType | null,
): boolean {
  return (
    roles.includes("system_admin") &&
    hasSettingsPermission &&
    scopeType === "hq_all"
  );
}
