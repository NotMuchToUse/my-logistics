import { z } from "zod";
import { INTERNAL_ROLE_CODES } from "../types/user-management.types";

const employeeScopeSchema = z
  .object({
    branch_id: z.number().int().positive("Vui lòng chọn chi nhánh / bưu cục."),
    warehouse_id: z.number().int().positive().nullable(),
    can_view: z.boolean(),
    can_operate: z.boolean(),
    can_approve: z.boolean(),
  })
  .refine(
    (scope) => scope.can_view || scope.can_operate || scope.can_approve,
    {
      message: "Chọn ít nhất một quyền trong phạm vi này.",
      path: ["can_view"],
    },
  );

export const employeeFormSchema = z.object({
  employee_code: z.string().trim().min(1, "Vui lòng nhập mã nhân viên."),
  full_name: z.string().trim().min(1, "Vui lòng nhập họ tên."),
  email: z.string().trim().email("Email không hợp lệ."),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^[+0-9(). -]{8,20}$/.test(value),
      "Số điện thoại không hợp lệ.",
    ),
  user_has_roles: z
    .array(z.enum(INTERNAL_ROLE_CODES))
    .min(1, "Chọn ít nhất một vai trò."),
  user_branch_scopes: z
    .array(employeeScopeSchema)
    .min(1, "Thêm ít nhất một phạm vi chi nhánh / kho."),
});

export type EmployeeFormValues = z.input<typeof employeeFormSchema>;
