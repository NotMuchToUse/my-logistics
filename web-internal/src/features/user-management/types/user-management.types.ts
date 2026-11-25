import type { ScopeType } from "@/types/rbac.types";

export const INTERNAL_ROLE_CODES = [
  "receptionist",
  "coordinator",
  "warehouse_staff",
  "branch_accountant",
  "hq_accountant",
  "branch_manager",
  "board_director",
  "system_admin",
  "system_dev",
  "pickup_delivery_driver",
  "linehaul_driver",
] as const;

export type InternalRoleCode = (typeof INTERNAL_ROLE_CODES)[number];
export type CustomerType = "individual" | "corporate_postpaid";
export type UserStatus = "active" | "suspended" | "inactive";
export type ScopePermission = "view" | "operate" | "approve";

export interface EmployeeBranchScope {
  branch_id: number | null;
  warehouse_id: number | null;
  scope_type: ScopeType;
  can_view: boolean;
  can_operate: boolean;
  can_approve: boolean;
}

export interface EmployeeUser {
  public_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone_masked: string;
  status?: UserStatus;
  is_active?: boolean | 0 | 1;
  user_has_roles: InternalRoleCode[];
  user_branch_scopes: EmployeeBranchScope[];
}

export interface EmployeeInput {
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  user_has_roles: InternalRoleCode[];
  user_branch_scopes: EmployeeBranchScope[];
}

export interface Customer {
  public_id: string;
  customer_code: string;
  customer_type: CustomerType;
  full_name: string;
  company_name: string | null;
  tax_code: string | null;
  credit_limit: number | null;
  email: string;
  phone_masked: string;
  status: UserStatus;
}

export type CustomerInput = Omit<Customer, "public_id">;

export const ROLE_LABELS: Record<InternalRoleCode, string> = {
  receptionist: "Nhân viên tiếp tân",
  coordinator: "Nhân viên điều phối",
  warehouse_staff: "Nhân viên kho",
  branch_accountant: "Kế toán bưu cục",
  hq_accountant: "Kế toán trung tâm",
  branch_manager: "Quản lý chi nhánh",
  board_director: "Ban giám đốc",
  system_admin: "Quản trị hệ thống",
  system_dev: "Phát triển hệ thống",
  pickup_delivery_driver: "Tài xế lấy/giao hàng",
  linehaul_driver: "Tài xế trung chuyển",
};
