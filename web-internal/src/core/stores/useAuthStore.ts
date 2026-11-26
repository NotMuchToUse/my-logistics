import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import type { InternalUser, RoleCode } from "@/types/rbac.types";

export interface AuthSession {
  user: InternalUser;
  token: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface AuthState {
  user: InternalUser | null;
  token: string | null;
  roles: RoleCode[];
  permissions: string[];
  isAuthenticated: boolean;
  hasPermission: (code: string) => boolean;
  login: (session: AuthSession) => void;
  logout: () => void;
  clearMustChangePassword: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      roles: [],
      permissions: [],
      isAuthenticated: false,
      hasPermission: (code) => {
        const permissions = get().permissions;
        return permissions.includes("*") || permissions.includes(code);
      },
      login: ({ user, token, roles, permissions }) =>
        set({
          user,
          token,
          roles,
          permissions,
          isAuthenticated: true,
        }),
      logout: () => {
        set({
          user: null,
          token: null,
          roles: [],
          permissions: [],
          isAuthenticated: false,
        });
        useBranchScopeStore.getState().clearScopes();
      },
      clearMustChangePassword: () => {
        const user = get().user;

        if (user) {
          set({
            user: {
              ...user,
              must_change_password: 0,
            },
          });
        }
      },
    }),
    {
      name: "vietstar-internal-auth",
    },
  ),
);
