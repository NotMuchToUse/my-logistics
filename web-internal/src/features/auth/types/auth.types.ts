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

export type AuthMeData = Pick<
  AuthLoginData,
  "user" | "roles" | "permissions" | "branch_scopes"
>;

export type AuthMeResponse = ApiSuccessResponse<AuthMeData>;

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface ChangePasswordCredentials {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

export type ChangePasswordResponse = ApiSuccessResponse<null>;
