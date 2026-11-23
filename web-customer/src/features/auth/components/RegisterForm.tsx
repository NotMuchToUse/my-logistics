import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_FORM_LABELS } from "@/features/auth/constants/auth.constants";
import { Nd13ConsentModal } from "@/features/auth/components/Nd13ConsentModal";
import { useCustomerAuth } from "@/features/auth/hooks/useCustomerAuth";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas/auth.schema";

export function RegisterForm() {
  const { isLoading, error, register: createAccount, clearError } =
    useCustomerAuth();
  const [isConsentChecked, setIsConsentChecked] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      password: "",
      accepted_privacy_policy: false,
    },
  });

  useEffect(() => {
    if (!error) {
      return;
    }

    for (const field of [
      "full_name",
      "email",
      "phone",
      "password",
      "accepted_privacy_policy",
    ] as const) {
      const message = error.fieldErrors[field];
      if (message) {
        setError(field, { type: "server", message });
      }
    }
  }, [error, setError]);

  async function onSubmit(values: RegisterFormValues): Promise<void> {
    await createAccount(values);
  }

  function confirmConsent(): void {
    setIsConsentChecked(true);
    setValue("accepted_privacy_policy", true, {
      shouldDirty: true,
      shouldValidate: true,
    });
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
        <Label htmlFor="full_name">{AUTH_FORM_LABELS.fullName}</Label>
        <Input
          id="full_name"
          autoComplete="name"
          {...register("full_name", { onChange: clearError })}
          aria-invalid={Boolean(errors.full_name)}
          aria-describedby={errors.full_name ? "full_name-error" : undefined}
        />
        {errors.full_name && (
          <p id="full_name-error" className="text-sm text-destructive">
            {errors.full_name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">{AUTH_FORM_LABELS.email}</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          {...register("email", { onChange: clearError })}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "register-email-error" : undefined}
        />
        {errors.email && (
          <p id="register-email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-phone">{AUTH_FORM_LABELS.phone}</Label>
        <Input
          id="register-phone"
          type="tel"
          autoComplete="tel"
          {...register("phone", { onChange: clearError })}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "register-phone-error" : undefined}
        />
        {errors.phone && (
          <p id="register-phone-error" className="text-sm text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">{AUTH_FORM_LABELS.password}</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          {...register("password", { onChange: clearError })}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "register-password-error" : undefined
          }
        />
        {errors.password && (
          <p id="register-password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <input
            id="accepted_privacy_policy"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-input accent-primary"
            {...register("accepted_privacy_policy", {
              onChange: (event) => {
                setIsConsentChecked(event.target.checked);
                clearError();
              },
            })}
            checked={isConsentChecked}
            aria-invalid={Boolean(errors.accepted_privacy_policy)}
            aria-describedby={
              errors.accepted_privacy_policy
                ? "privacy-consent-error"
                : undefined
            }
          />
          <Label
            htmlFor="accepted_privacy_policy"
            className="font-normal leading-6"
          >
            {AUTH_FORM_LABELS.privacyConsent}
          </Label>
        </div>
        <Nd13ConsentModal onConfirm={confirmConsent} />
        {errors.accepted_privacy_policy && (
          <p id="privacy-consent-error" className="text-sm text-destructive">
            {errors.accepted_privacy_policy.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Đang tạo tài khoản..." : "Đăng ký"}
      </Button>
    </form>
  );
}
