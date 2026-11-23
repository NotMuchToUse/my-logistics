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
