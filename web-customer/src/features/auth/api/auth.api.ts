import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import authMock from "@/mocks/auth.mock.json";
import { MOCK_LOGIN_CREDENTIALS } from "@/features/auth/constants/auth.constants";
import type {
  AuthResponseData,
  CustomerLoginResponse,
  LoginCredentials,
  LoginPayload,
  RegisterPayload,
} from "@/features/auth/types/auth.types";
import type { ApiSuccessResponse } from "@/types/api.types";

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

export async function loginCustomerApi(
  payload: LoginPayload,
): Promise<AuthResponseData> {
  const response = await loginApi({
    email: payload.email_or_phone,
    password: payload.password,
  });

  return response.data;
}

export async function registerCustomerApi(
  payload: RegisterPayload,
): Promise<AuthResponseData> {
  if (USE_MOCK) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const mockData = authMock.register_success_response.data;

    return {
      ...mockData,
      user: {
        ...mockData.user,
        user_type: "customer",
      },
      customer: {
        ...mockData.customer,
        customer_type: "individual",
      },
    };
  }

  const response = await axiosClient.post<
    ApiSuccessResponse<AuthResponseData>
  >("/api/v1/auth/register", payload);

  return response.data.data;
}
