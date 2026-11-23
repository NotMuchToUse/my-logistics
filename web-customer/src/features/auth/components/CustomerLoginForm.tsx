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
import { useCustomerLogin } from "@/features/auth/hooks/useCustomerLogin";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schemas/login.schema";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  return "Không thể đăng nhập. Vui lòng thử lại.";
}

export function CustomerLoginForm() {
  const { login } = useCustomerLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: USE_MOCK ? MOCK_LOGIN_CREDENTIALS.email : "",
      password: USE_MOCK ? MOCK_LOGIN_CREDENTIALS.password : "",
    },
  });

  async function onSubmit(values: LoginFormValues): Promise<void> {
    try {
      await login(values);
    } catch (error: unknown) {
      setError("root.server", {
        type: "server",
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Đăng nhập khách hàng</CardTitle>
        <CardDescription>
          Đăng nhập để quản lý địa chỉ và theo dõi các yêu cầu gửi hàng.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive" role="alert">
                {errors.email.message}
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
                Email: {MOCK_LOGIN_CREDENTIALS.email}
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
