export const BRANCH_TYPES = [
  "hq",
  "regional_hub",
  "branch",
  "post_office",
] as const;

export type BranchType = (typeof BRANCH_TYPES)[number];

export const WAREHOUSE_TYPES = [
  "hub_sorting",
  "branch_warehouse",
  "post_office_storage",
] as const;

export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];

export interface Branch {
  id: number;
  public_id: string;
  parent_branch_id: number | null;
  code: string;
  name: string;
  branch_type: BranchType;
  province_id: number;
  district_id: number;
  ward_id: number;
  address_line: string;
  latitude: number;
  longitude: number;
  operating_hours: string;
  accepts_counter_dropoff: number;
  is_active: number;
}

export interface Warehouse {
  id: number;
  public_id: string;
  branch_id: number;
  code: string;
  name: string;
  warehouse_type: WarehouseType;
  address_line: string;
  latitude: number;
  longitude: number;
  max_capacity_parcels: number;
  province_id?: number;
  district_id?: number;
  ward_id?: number;
  operating_hours?: string;
  is_active: number;
}

export type BranchInput = Omit<Branch, "id" | "public_id">;
export type WarehouseInput = Omit<Warehouse, "id" | "public_id">;

export interface NetworkOrgLocations {
  provinces: Array<{ id: number; name: string }>;
  districts: Array<{ id: number; province_id: number; name: string }>;
  wards: Array<{ id: number; district_id: number; name: string }>;
}
