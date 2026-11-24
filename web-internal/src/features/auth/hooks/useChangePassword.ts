import { useAuthStore } from "@/core/stores/useAuthStore";
import { changePasswordApi } from "@/features/auth/api/auth.api";
import type { ChangePasswordCredentials } from "@/features/auth/types/auth.types";

export function useChangePassword() {
  const clearMustChangePassword = useAuthStore(
    (state) => state.clearMustChangePassword,
  );

  async function changePassword(
    credentials: ChangePasswordCredentials,
  ): Promise<void> {
    await changePasswordApi(credentials);
    clearMustChangePassword();
  }

  return { changePassword };
}
