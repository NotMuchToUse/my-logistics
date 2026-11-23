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
  id: number;
  user_id: number;
  branch_id: number | null;
  warehouse_id: number | null;
  scope_type: ScopeType;
}

export interface InternalUser {
  public_id: string;
  must_change_password: 0 | 1;
}
