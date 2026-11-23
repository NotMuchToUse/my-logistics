import type { ApiSuccessResponse } from "@/types/api.types";
import type { InternalUser, UserBranchScope } from "@/types/rbac.types";

export interface AuthLoginData {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: InternalUser;
  roles: string[];
  permissions: string[];
  branch_scopes: UserBranchScope[];
}

export type AuthLoginResponse = ApiSuccessResponse<AuthLoginData>;

export interface LoginCredentials {
  identifier: string;
  password: string;
}
