import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { loginApi } from "@/features/auth/api/auth.api";
import { ROLE_CODES } from "@/features/auth/constants/auth.constants";
import type { RoleCode } from "@/types/rbac.types";
import type { LoginCredentials } from "@/features/auth/types/auth.types";

function isRoleCode(value: string): value is RoleCode {
  return ROLE_CODES.some((roleCode) => roleCode === value);
}

export function useLogin() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.login);
  const setScopes = useBranchScopeStore((state) => state.setScopes);

  async function login(credentials: LoginCredentials): Promise<void> {
    const response = await loginApi(credentials);
    const roles = response.data.roles.filter(isRoleCode);

    if (roles.length === 0) {
      throw new Error("Tài khoản không có vai trò được phép đăng nhập.");
    }

    setSession({
      user: response.data.user,
      token: response.data.access_token,
      roles,
      permissions: response.data.permissions,
    });
    setScopes(response.data.branch_scopes);
    navigate("/shipment-list", { replace: true });
  }

  return { login };
}
