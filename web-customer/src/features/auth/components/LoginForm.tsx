import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_FORM_LABELS } from "@/features/auth/constants/auth.constants";
import { useCustomerAuth } from "@/features/auth/hooks/useCustomerAuth";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schemas/auth.schema";

export function LoginForm() {
  const { isLoading, error, login, clearError } = useCustomerAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email_or_phone: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!error) {
      return;
    }

    for (const field of ["email_or_phone", "password"] as const) {
      const message = error.fieldErrors[field];
      if (message) {
        setError(field, { type: "server", message });
      }
    }
  }, [error, setError]);

  async function onSubmit(values: LoginFormValues): Promise<void> {
    await login(values);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error.message}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="email_or_phone">{AUTH_FORM_LABELS.emailOrPhone}</Label>
        <Input
          id="email_or_phone"
          autoComplete="username"
          {...register("email_or_phone", { onChange: clearError })}
          aria-invalid={Boolean(errors.email_or_phone)}
          aria-describedby={
            errors.email_or_phone ? "email_or_phone-error" : undefined
          }
        />
        {errors.email_or_phone && (
          <p id="email_or_phone-error" className="text-sm text-destructive">
            {errors.email_or_phone.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">{AUTH_FORM_LABELS.password}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password", { onChange: clearError })}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "login-password-error" : undefined}
        />
        {errors.password && (
          <p id="login-password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
