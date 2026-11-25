import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangePassword } from "@/features/auth/hooks/useChangePassword";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/features/auth/schemas/change-password.schema";
import type { ApiErrorCode, ApiErrorResponse } from "@/types/api.types";

type PasswordField =
  | "current_password"
  | "new_password"
  | "new_password_confirmation";

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
  "401_UNAUTHORIZED": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  "403_FORBIDDEN": "Bạn không có quyền thực hiện thao tác này.",
  "403_BRANCH_SCOPE": "Phạm vi truy cập không hợp lệ.",
  "404_NOT_FOUND": "Không tìm thấy tài nguyên yêu cầu.",
  "409_VERSION_CONFLICT": "Dữ liệu đã thay đổi. Vui lòng thử lại.",
  "409_IDEMPOTENCY_DUPLICATE": "Yêu cầu đã được tiếp nhận trước đó.",
  "422_VALIDATION_ERROR": "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  "429_TOO_MANY_REQUESTS": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
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

function setServerErrors(
  error: unknown,
  setError: ReturnType<
    typeof useForm<ChangePasswordFormValues>
  >["setError"],
): void {
  if (!isApiErrorResponse(error)) {
    setError("root.server", {
      type: "server",
      message: "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
    });
    return;
  }

  if (error.error.code === "422_VALIDATION_ERROR" && error.error.details) {
    const fields: PasswordField[] = [
      "current_password",
      "new_password",
      "new_password_confirmation",
    ];

    for (const field of fields) {
      const message = error.error.details[field]?.[0];

      if (message) {
        setError(field, { type: "server", message });
      }
    }
  }

  setError("root.server", {
    type: "server",
    message: SAFE_ERROR_MESSAGES[error.error.code],
  });
}

export function ChangePasswordForm() {
  const { changePassword } = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      new_password_confirmation: "",
    },
  });

  async function onSubmit(values: ChangePasswordFormValues): Promise<void> {
    try {
      await changePassword(values);
    } catch (error: unknown) {
      setServerErrors(error, setError);
    }
  }

  const fields: {
    name: PasswordField;
    label: string;
    autocomplete: "current-password" | "new-password";
  }[] = [
    {
      name: "current_password",
      label: "Mật khẩu hiện tại",
      autocomplete: "current-password",
    },
    {
      name: "new_password",
      label: "Mật khẩu mới",
      autocomplete: "new-password",
    },
    {
      name: "new_password_confirmation",
      label: "Xác nhận mật khẩu mới",
      autocomplete: "new-password",
    },
  ];

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      {fields.map(({ name, label, autocomplete }) => (
        <div key={name} className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <Input
            id={name}
            type="password"
            autoComplete={autocomplete}
            aria-invalid={Boolean(errors[name])}
            {...register(name)}
          />
          {errors[name]?.message && (
            <p className="text-sm text-destructive" role="alert">
              {errors[name].message}
            </p>
          )}
        </div>
      ))}

      {errors.root?.server?.message && (
        <p className="text-sm text-destructive" role="alert">
          {errors.root.server.message}
        </p>
      )}

      <Button
        type="submit"
        className="w-full sm:w-auto"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        )}
        Đổi mật khẩu
      </Button>
    </form>
  );
}
