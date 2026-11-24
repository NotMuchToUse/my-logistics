import type { ApiSuccessResponse } from "@/types/api.types";
import type {
  CustomerAuthUser,
  CustomerProfile,
} from "@/core/stores/useCustomerAuthStore";

export interface CustomerLoginData {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: CustomerAuthUser;
  customer?: CustomerProfile;
  roles: string[];
  permissions: string[];
}

export type CustomerLoginResponse = ApiSuccessResponse<CustomerLoginData>;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginPayload {
  email_or_phone: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  accepted_privacy_policy: boolean;
}

export interface AuthResponseData {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: CustomerAuthUser;
  customer?: CustomerProfile;
  roles?: string[];
  permissions?: string[];
  branch_scopes?: string[];
}
