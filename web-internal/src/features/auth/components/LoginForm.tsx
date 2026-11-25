import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USE_MOCK } from "@/core/api/axiosClient";
import { MOCK_LOGIN_CREDENTIALS } from "@/features/auth/constants/auth.constants";
import { useLogin } from "@/features/auth/hooks/useLogin";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schemas/login.schema";
import type { ApiErrorCode, ApiErrorResponse } from "@/types/api.types";

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

const SAFE_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  "400_BAD_REQUEST": "Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.",
  "401_UNAUTHORIZED": "Thông tin đăng nhập không chính xác.",
  "403_FORBIDDEN": "Tài khoản không được phép đăng nhập hoặc đã bị khóa.",
  "403_BRANCH_SCOPE": "Tài khoản không có phạm vi truy cập phù hợp.",
  "404_NOT_FOUND": "Không tìm thấy tài nguyên yêu cầu.",
  "409_VERSION_CONFLICT": "Dữ liệu đã thay đổi. Vui lòng thử lại.",
  "409_IDEMPOTENCY_DUPLICATE": "Yêu cầu đã được tiếp nhận trước đó.",
  "422_VALIDATION_ERROR": "Thông tin đăng nhập chưa hợp lệ.",
  "429_TOO_MANY_REQUESTS": "Bạn đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
  "500_INTERNAL_ERROR": "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
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

  const apiError = value.error;
  if (
    typeof apiError !== "object" ||
    apiError === null ||
    !("code" in apiError) ||
    typeof apiError.code !== "string" ||
    !API_ERROR_CODES.some((code) => code === apiError.code) ||
    !("message" in apiError) ||
    typeof apiError.message !== "string"
  ) {
    return false;
  }

  if ("details" in apiError && apiError.details !== undefined) {
    if (
      typeof apiError.details !== "object" ||
      apiError.details === null
    ) {
      return false;
    }

    const detailsAreValid = Object.values(apiError.details).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    );

    if (!detailsAreValid) {
      return false;
    }
  }

  return !("trace_id" in apiError) || typeof apiError.trace_id === "string";
}

export function LoginForm() {
  const { login } = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: USE_MOCK ? MOCK_LOGIN_CREDENTIALS.identifier : "",
      password: USE_MOCK ? MOCK_LOGIN_CREDENTIALS.password : "",
    },
  });

  async function onSubmit(values: LoginFormValues): Promise<void> {
    try {
      await login(values);
    } catch (error: unknown) {
      if (!isApiErrorResponse(error)) {
        setError("root.server", {
          type: "server",
          message: "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
        });
        return;
      }

      if (error.error.code === "422_VALIDATION_ERROR" && error.error.details) {
        const identifierMessage = error.error.details.identifier?.[0];
        const passwordMessage = error.error.details.password?.[0];

        if (identifierMessage) {
          setError("identifier", {
            type: "server",
            message: identifierMessage,
          });
        }

        if (passwordMessage) {
          setError("password", {
            type: "server",
            message: passwordMessage,
          });
        }
      }

      setError("root.server", {
        type: "server",
        message: SAFE_ERROR_MESSAGES[error.error.code],
      });
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Đăng nhập cổng vận hành</CardTitle>
        <CardDescription>
          Sử dụng email hoặc mã nhân viên Vietstar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="identifier">Email hoặc mã nhân viên</Label>
            <Input
              id="identifier"
              autoComplete="username"
              aria-invalid={Boolean(errors.identifier)}
              {...register("identifier")}
            />
            {errors.identifier && (
              <p className="text-sm text-destructive" role="alert">
                {errors.identifier.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>
          {errors.root?.server?.message && (
            <p className="text-sm text-destructive" role="alert">
              {errors.root.server.message}
            </p>
          )}
          {USE_MOCK && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Tài khoản dùng thử</p>
              <p className="mt-1 break-all text-muted-foreground">
                Email: {MOCK_LOGIN_CREDENTIALS.identifier}
              </p>
              <p className="break-all text-muted-foreground">
                Mật khẩu: {MOCK_LOGIN_CREDENTIALS.password}
              </p>
            </div>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden="true" />
            )}
            Đăng nhập
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
