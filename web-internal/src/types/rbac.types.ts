export type RoleCode =
  | "receptionist"
  | "coordinator"
  | "warehouse_staff"
  | "branch_accountant"
  | "hq_accountant"
  | "branch_manager"
  | "board_director"
  | "system_admin"
  | "system_dev"
  | "pickup_delivery_driver"
  | "linehaul_driver"
  | "customer_individual"
  | "customer_corporate";

export type ScopeType =
  | "hq_all"
  | "region_center"
  | "branch"
  | "post_office"
  | "warehouse";

export interface UserBranchScope {
  branch_id: number | null;
  warehouse_id: number | null;
  scope_type: ScopeType;
  is_primary?: boolean;
  branch_public_id?: string | null;
  branch_code?: string | null;
  branch_name?: string | null;
  warehouse_public_id?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  id?: number;
  user_id?: number;
}

export interface InternalUser {
  public_id: string;
  must_change_password: boolean | 0 | 1;
  full_name?: string;
  email?: string;
  employee_code?: string | null;
  user_type?: "staff" | "customer" | "system_dev";
  phone_masked?: string;
}
