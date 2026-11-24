import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";
import {
  loginCustomerApi,
  registerCustomerApi,
} from "@/features/auth/api/auth.api";
import type { ApiErrorResponse } from "@/types/api.types";
import type {
  LoginPayload,
  RegisterPayload,
} from "@/features/auth/types/auth.types";

interface AuthErrorState {
  message: string;
  fieldErrors: Record<string, string>;
}

function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  if (
    typeof error !== "object" ||
    error === null ||
    !("success" in error) ||
    error.success !== false ||
    !("error" in error)
  ) {
    return false;
  }

  const apiError = error.error;

  return (
    typeof apiError === "object" &&
    apiError !== null &&
    "message" in apiError &&
    typeof apiError.message === "string"
  );
}

function getAuthError(error: unknown, fallbackMessage: string): AuthErrorState {
  if (!isApiErrorResponse(error)) {
    return { message: fallbackMessage, fieldErrors: {} };
  }

  const fieldErrors = Object.fromEntries(
    Object.entries(error.error.details ?? {})
      .filter(([, messages]) => messages.length > 0)
      .map(([field, messages]) => [field, messages[0]]),
  );

  return { message: error.error.message, fieldErrors };
}

export function useCustomerAuth() {
  const loginSession = useCustomerAuthStore((state) => state.login);
  const clearSession = useCustomerAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthErrorState | null>(null);

  async function submitAuth(
    request: () => Promise<Awaited<ReturnType<typeof loginCustomerApi>>>,
    fallbackMessage: string,
  ): Promise<boolean> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await request();
      loginSession({
        user: response.user,
        customer: response.customer ?? null,
        token: response.access_token,
      });
      navigate("/customer/shipments", { replace: true });
      return true;
    } catch (requestError) {
      setError(getAuthError(requestError, fallbackMessage));
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  function login(payload: LoginPayload): Promise<boolean> {
    return submitAuth(
      () => loginCustomerApi(payload),
      "Không thể đăng nhập. Vui lòng thử lại.",
    );
  }

  function register(payload: RegisterPayload): Promise<boolean> {
    return submitAuth(
      () => registerCustomerApi(payload),
      "Không thể tạo tài khoản. Vui lòng thử lại.",
    );
  }

  function logout(): void {
    clearSession();
    useCustomerAuthStore.persist.clearStorage();
    navigate("/login", { replace: true });
  }

  function clearError(): void {
    setError(null);
  }

  return {
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}
