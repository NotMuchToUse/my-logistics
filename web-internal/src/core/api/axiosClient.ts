import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import type { ApiErrorCode, ApiErrorResponse } from "@/types/api.types";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : undefined);

const API_ERROR_CODES: readonly ApiErrorCode[] = [
  "400_BAD_REQUEST",
  "401_UNAUTHORIZED",
  "403_FORBIDDEN",
  "403_BRANCH_SCOPE",
  "404_NOT_FOUND",
  "409_VERSION_CONFLICT",
  "409_IDEMPOTENCY_DUPLICATE",
  "422_VALIDATION_ERROR",
  "429_TOO_MANY_REQUESTS",
  "500_INTERNAL_ERROR",
];

const STATUS_ERROR_CODES: Record<number, ApiErrorCode> = {
  400: "400_BAD_REQUEST",
  401: "401_UNAUTHORIZED",
  403: "403_FORBIDDEN",
  404: "404_NOT_FOUND",
  409: "409_VERSION_CONFLICT",
  422: "422_VALIDATION_ERROR",
  429: "429_TOO_MANY_REQUESTS",
};

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !("success" in value) ||
    value.success !== false ||
    !("error" in value)
  ) {
    return false;
  }

  const { error } = value;

  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string" ||
    !API_ERROR_CODES.some((code) => code === error.code) ||
    !("message" in error) ||
    typeof error.message !== "string"
  ) {
    return false;
  }

  if ("details" in error && error.details !== undefined) {
    if (typeof error.details !== "object" || error.details === null) {
      return false;
    }

    const detailsAreValid = Object.values(error.details).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    );

    if (!detailsAreValid) {
      return false;
    }
  }

  return !("trace_id" in error) || typeof error.trace_id === "string";
}

function normalizeApiError(error: unknown): ApiErrorResponse {
  const isAxiosFailure = axios.isAxiosError<unknown>(error);
  const axiosError = isAxiosFailure ? (error as AxiosError<unknown>) : null;
  const responseData = axiosError?.response?.data;

  if (isApiErrorResponse(responseData)) {
    return responseData;
  }

  const status = axiosError?.response?.status;
  const code = status
    ? (STATUS_ERROR_CODES[status] ?? "500_INTERNAL_ERROR")
    : "500_INTERNAL_ERROR";
  const message =
    typeof responseData === "object" &&
    responseData !== null &&
    "message" in responseData &&
    typeof responseData.message === "string"
      ? responseData.message
      : error instanceof Error
        ? error.message
        : "Không thể kết nối đến máy chủ.";

  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function redirectUnauthorized(): void {
  useAuthStore.getState().logout();

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function configureRequest(
  request: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  request.headers.set("Accept", "application/json");
  request.headers.set("X-Client-Type", "web_internal");

  const { token } = useAuthStore.getState();
  const { activeBranchId } = useBranchScopeStore.getState();

  if (token) {
    request.headers.set("Authorization", `Bearer ${token}`);
  } else {
    request.headers.delete("Authorization");
  }

  if (activeBranchId !== null) {
    request.headers.set("X-Branch-Id", String(activeBranchId));
  } else {
    request.headers.delete("X-Branch-Id");
  }

  const method = request.method?.toLowerCase();

  if (
    (method === "post" || method === "patch") &&
    !request.headers.has("Idempotency-Key")
  ) {
    request.headers.set("Idempotency-Key", crypto.randomUUID());
  }

  return request;
}

function handleApiError(error: unknown): Promise<never> {
  const apiError = normalizeApiError(error);

  switch (apiError.error.code) {
    case "401_UNAUTHORIZED":
      redirectUnauthorized();
      break;
    case "403_BRANCH_SCOPE":
      toast.error("Bạn không có quyền truy cập phạm vi chi nhánh này.");
      break;
    case "403_FORBIDDEN":
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      break;
    case "409_VERSION_CONFLICT":
      toast.warning(
        "Dữ liệu vừa được người khác cập nhật, vui lòng tải lại.",
      );
      break;
    default:
      break;
  }

  return Promise.reject(apiError);
}

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "X-Client-Type": "web_internal",
  },
});

axiosClient.interceptors.request.use(configureRequest);
axiosClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => handleApiError(error),
);

export default axiosClient;
