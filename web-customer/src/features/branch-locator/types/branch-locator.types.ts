export interface BranchProvince {
  id: number;
  code: string;
  name: string;
  region: string;
  is_active: number | boolean;
}

export interface BranchDistrict {
  id: number;
  province_id: number;
  code: string;
  name: string;
  is_remote_area: number | boolean;
  is_active: number | boolean;
}

export interface LogisticsBranch {
  id: number;
  public_id: string;
  parent_branch_id: number | null;
  code: string;
  name: string;
  branch_type: string;
  province_id: number;
  district_id: number;
  ward_id: number;
  address_line: string;
  latitude: number;
  longitude: number;
  operating_hours?: string;
  hotline_phone?: string;
  accepts_counter_dropoff: number | boolean;
  is_active: number | boolean;
}

export interface PublicBranchDirectory {
  branches: LogisticsBranch[];
  provinces: BranchProvince[];
  districts: BranchDistrict[];
}
