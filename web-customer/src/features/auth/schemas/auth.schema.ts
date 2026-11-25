import { z } from "zod";

const VIETNAMESE_PHONE_PATTERN = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;
const INVALID_PHONE_MESSAGE = "Số điện thoại Việt Nam không đúng định dạng.";

function isEmailOrVietnamesePhone(value: string): boolean {
  if (value.includes("@")) {
    return z.email().safeParse(value).success;
  }

  return VIETNAMESE_PHONE_PATTERN.test(value);
}

export const loginSchema = z.object({
  email_or_phone: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email hoặc số điện thoại.")
    .refine(isEmailOrVietnamesePhone, {
      message: "Vui lòng nhập email hoặc số điện thoại hợp lệ.",
    }),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

export const registerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự."),
  email: z
    .string()
    .trim()
    .pipe(z.email("Vui lòng nhập địa chỉ email hợp lệ.")),
  phone: z
    .string()
    .trim()
    .regex(VIETNAMESE_PHONE_PATTERN, INVALID_PHONE_MESSAGE),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
  accepted_privacy_policy: z.boolean().refine((accepted) => accepted, {
    message: "Bạn cần đồng ý với Chính sách bảo mật và xử lý dữ liệu cá nhân.",
  }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
