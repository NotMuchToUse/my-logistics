import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import authMock from "@/mocks/auth.mock.json";
import { MOCK_LOGIN_CREDENTIALS } from "@/features/auth/constants/auth.constants";
import type {
  CustomerLoginResponse,
  LoginCredentials,
} from "@/features/auth/types/auth.types";

const mockLoginData = authMock.success_response.data;

export async function loginApi(
  credentials: LoginCredentials,
): Promise<CustomerLoginResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));

    if (
      credentials.email.trim().toLowerCase() !==
        MOCK_LOGIN_CREDENTIALS.email ||
      credentials.password !== MOCK_LOGIN_CREDENTIALS.password
    ) {
      throw new Error("Email hoặc mật khẩu không chính xác.");
    }

    return {
      success: true,
      message: authMock.success_response.message,
      data: {
        access_token: mockLoginData.access_token,
        token_type: "Bearer",
        expires_at: mockLoginData.expires_at,
        user: {
          ...mockLoginData.user,
          user_type: "customer",
        },
        customer: {
          ...mockLoginData.customer,
          customer_type: "individual",
        },
        roles: mockLoginData.roles,
        permissions: mockLoginData.permissions,
      },
      meta: authMock.success_response.meta,
    };
  }

  const response = await axiosClient.post<CustomerLoginResponse>(
    "/api/v1/auth/login",
    {
      identifier: credentials.email,
      password: credentials.password,
    },
  );

  return response.data;
}
