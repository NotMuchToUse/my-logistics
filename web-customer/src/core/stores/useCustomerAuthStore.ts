import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CustomerAuthUser {
  public_id: string;
  full_name?: string;
  email?: string;
  user_type?: "customer";
  must_change_password?: boolean | 0 | 1;
}

export interface CustomerProfile {
  public_id: string;
  customer_code?: string;
  customer_type?: "individual" | "corporate_postpaid";
  company_name?: string | null;
  tax_code?: string | null;
  full_name?: string;
  phone_masked?: string;
  email?: string | null;
}

export interface CustomerLoginPayload {
  user: CustomerAuthUser;
  customer: CustomerProfile | null;
  token: string;
}

export interface CustomerAuthState {
  user: CustomerAuthUser | null;
  customer: CustomerProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (payload: CustomerLoginPayload) => void;
  logout: () => void;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set) => ({
      user: null,
      customer: null,
      token: null,
      isAuthenticated: false,
      login: ({ user, customer, token }) =>
        set({
          user,
          customer,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          customer: null,
          token: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "vietstar-customer-auth",
    },
  ),
);
