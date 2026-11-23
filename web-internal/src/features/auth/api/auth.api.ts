import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import authMock from "@/mocks/auth.mock.json";
import { MOCK_LOGIN_CREDENTIALS } from "@/features/auth/constants/auth.constants";
import type {
  ChangePasswordCredentials,
  ChangePasswordResponse,
  AuthLoginResponse,
  AuthMeResponse,
  LoginCredentials,
} from "@/features/auth/types/auth.types";
import type { ApiSuccessResponse } from "@/types/api.types";
import type { ScopeType, UserBranchScope } from "@/types/rbac.types";

const mockLoginData = authMock.success_response.data;

function getScopeType(scopeType: string): ScopeType {
  switch (scopeType) {
    case "hq_all":
    case "region_center":
    case "branch":
    case "post_office":
    case "warehouse":
      return scopeType;
    default:
      throw new Error(`Unsupported mock branch scope: ${scopeType}`);
  }
}

export async function loginApi(
  credentials: LoginCredentials,
): Promise<AuthLoginResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    const identifier = credentials.identifier.trim().toLowerCase();
    const isKnownIdentifier = [
      mockLoginData.user.email,
      mockLoginData.user.employee_code,
    ].some((value) => value.toLowerCase() === identifier);

    if (
      !isKnownIdentifier ||
      credentials.password !== MOCK_LOGIN_CREDENTIALS.password
    ) {
      throw new Error("Thông tin đăng nhập không chính xác.");
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
          user_type: "staff",
          must_change_password: 0,
        },
        roles: mockLoginData.roles,
        permissions: mockLoginData.permissions,
        branch_scopes: mockLoginData.branch_scopes.map(
          (scope): UserBranchScope => ({
            ...scope,
            scope_type: getScopeType(scope.scope_type),
          }),
        ),
      },
      meta: authMock.success_response.meta,
    };
  }

  const response = await axiosClient.post<AuthLoginResponse>(
    "/api/v1/auth/login",
    credentials,
  );

  return response.data;
}

export async function getCurrentSessionApi(): Promise<AuthMeResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));

    return {
      success: true,
      message: "Lấy thông tin phiên thành công.",
      data: {
        user: {
          ...mockLoginData.user,
          user_type: "staff",
          must_change_password: 0,
        },
        roles: mockLoginData.roles,
        permissions: mockLoginData.permissions,
        branch_scopes: mockLoginData.branch_scopes.map(
          (scope): UserBranchScope => ({
            ...scope,
            scope_type: getScopeType(scope.scope_type),
          }),
        ),
      },
      meta: authMock.success_response.meta,
    };
  }

  const response = await axiosClient.get<AuthMeResponse>("/api/v1/auth/me");

  return response.data;
}

export async function changePasswordApi(
  credentials: ChangePasswordCredentials,
): Promise<ChangePasswordResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));

    return {
      success: true,
      message: "Đổi mật khẩu thành công.",
      data: null,
      meta: authMock.success_response.meta,
    };
  }

  const response = await axiosClient.post<ChangePasswordResponse>(
    "/api/v1/auth/change-password",
    credentials,
  );

  return response.data;
}

export async function logoutApi(): Promise<ApiSuccessResponse<null>> {
  if (USE_MOCK) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));

    return {
      success: true,
      message: "Đăng xuất thành công.",
      data: null,
      meta: authMock.success_response.meta,
    };
  }

  const response = await axiosClient.post<ApiSuccessResponse<null>>(
    "/api/v1/auth/logout",
  );

  return response.data;
}
