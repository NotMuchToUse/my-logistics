import { z } from "zod";

const PASSWORD_POLICY_MESSAGE =
  "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.";

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    new_password: z
      .string()
      .min(8, PASSWORD_POLICY_MESSAGE)
      .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
      .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
      .regex(/[0-9]/, PASSWORD_POLICY_MESSAGE),
    new_password_confirmation: z
      .string()
      .min(1, "Vui lòng xác nhận mật khẩu mới."),
  })
  .superRefine((values, context) => {
    if (values.new_password === values.current_password) {
      context.addIssue({
        code: "custom",
        path: ["new_password"],
        message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
      });
    }

    if (values.new_password !== values.new_password_confirmation) {
      context.addIssue({
        code: "custom",
        path: ["new_password_confirmation"],
        message: "Xác nhận mật khẩu mới không khớp.",
      });
    }
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
