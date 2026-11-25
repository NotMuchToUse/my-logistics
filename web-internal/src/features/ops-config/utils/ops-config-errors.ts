import type {
  FieldPath,
  FieldValues,
  UseFormReturn,
} from "react-hook-form";

function readErrorPayload(error: unknown): {
  message?: string;
  details?: Record<string, string[]>;
} | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("response" in error) ||
    typeof error.response !== "object" ||
    error.response === null ||
    !("error" in error.response) ||
    typeof error.response.error !== "object" ||
    error.response.error === null
  ) {
    return null;
  }

  const payload = error.response.error;
  const message =
    "message" in payload && typeof payload.message === "string"
      ? payload.message
      : undefined;
  const details =
    "details" in payload &&
    typeof payload.details === "object" &&
    payload.details !== null &&
    Object.values(payload.details).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((item) => typeof item === "string"),
    )
      ? (payload.details as Record<string, string[]>)
      : undefined;
  return { message, details };
}

export function getOpsConfigErrorMessage(error: unknown): string {
  const payload = readErrorPayload(error);
  if (payload?.message) return payload.message;
  if (error instanceof Error) return error.message;
  return "Không thể xử lý yêu cầu cấu hình vận hành.";
}

export function applyOpsConfigFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
): string {
  const payload = readErrorPayload(error);
  const values = form.getValues();
  for (const [field, messages] of Object.entries(payload?.details ?? {})) {
    if (Object.prototype.hasOwnProperty.call(values, field) && messages[0]) {
      form.setError(field as FieldPath<T>, {
        type: "server",
        message: messages[0],
      });
    }
  }
  return getOpsConfigErrorMessage(error);
}
