import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { getCurrentSessionApi } from "@/features/auth/api/auth.api";
import { ROLE_CODES } from "@/features/auth/constants/auth.constants";
import type { RoleCode } from "@/types/rbac.types";

export interface ProtectedRouteProps {
  children: ReactNode;
}

function isRoleCode(value: string): value is RoleCode {
  return ROLE_CODES.some((roleCode) => roleCode === value);
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const setScopes = useBranchScopeStore((state) => state.setScopes);
  const location = useLocation();
  const [sessionStatus, setSessionStatus] = useState<
    "checking" | "ready" | "error"
  >("checking");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    let isActive = true;
    const sessionToken = token;

    async function verifySession(): Promise<void> {
      try {
        const response = await getCurrentSessionApi();

        if (!isActive) {
          return;
        }

        const roles = response.data.roles.filter(isRoleCode);

        if (roles.length === 0) {
          logout();
          setSessionStatus("error");
          return;
        }

        setScopes(response.data.branch_scopes);
        setSession({
          user: response.data.user,
          token: sessionToken,
          roles,
          permissions: response.data.permissions,
        });
        setSessionStatus("ready");
      } catch {
        if (isActive) {
          setSessionStatus("error");
        }
      }
    }

    void verifySession();

    return () => {
      isActive = false;
    };
  }, [
    isAuthenticated,
    logout,
    retryCount,
    setScopes,
    setSession,
    token,
  ]);

  if (!isAuthenticated || !token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (sessionStatus === "checking") {
    return (
      <section
        className="space-y-4 py-12"
        role="status"
        aria-label="Đang xác thực phiên làm việc"
      >
        <Skeleton className="mx-auto h-8 w-64" />
        <Skeleton className="mx-auto h-4 w-48" />
      </section>
    );
  }

  if (sessionStatus === "error") {
    return (
      <section className="space-y-4 py-12 text-center" role="alert">
        <p className="text-sm text-destructive">
          Không thể xác thực phiên làm việc. Vui lòng thử lại.
        </p>
        <Button
          type="button"
          onClick={() => {
            setSessionStatus("checking");
            setRetryCount((count) => count + 1);
          }}
        >
          Thử lại
        </Button>
      </section>
    );
  }

  return children;
}
