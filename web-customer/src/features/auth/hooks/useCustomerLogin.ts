import { useNavigate } from "react-router-dom";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";
import { loginApi } from "@/features/auth/api/auth.api";
import type { LoginCredentials } from "@/features/auth/types/auth.types";

export function useCustomerLogin() {
  const navigate = useNavigate();
  const setSession = useCustomerAuthStore((state) => state.login);

  async function login(credentials: LoginCredentials): Promise<void> {
    const response = await loginApi(credentials);
    setSession({
      user: response.data.user,
      customer: response.data.customer ?? null,
      token: response.data.access_token,
    });
    navigate("/customer/shipments", { replace: true });
  }

  return { login };
}
