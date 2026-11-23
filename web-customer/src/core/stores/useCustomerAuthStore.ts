import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CustomerAuthUser {
  public_id: string;
}

export interface CustomerProfile {
  public_id: string;
}

export interface CustomerLoginPayload {
  user: CustomerAuthUser;
  customer: CustomerProfile;
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
