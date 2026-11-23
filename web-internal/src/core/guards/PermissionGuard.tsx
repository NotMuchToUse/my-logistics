import type { ReactNode } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";

export interface PermissionGuardProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const hasPermission = useAuthStore((state) =>
    state.hasPermission(permission),
  );

  return hasPermission ? children : fallback;
}
