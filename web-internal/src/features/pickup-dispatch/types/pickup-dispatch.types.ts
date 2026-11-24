import type { PickupRequestStatus } from "@/types/api.types";

export type PickupMode = "driver_pickup" | "counter_dropoff";

export type SlaUrgency = "overdue" | "warning" | "normal" | "completed";

export interface PickupRequestItem {
  public_id: string;
  request_code: string;
  customer_id: number | null;
  branch_id: number;
  branch_code?: string | null;
  branch_name?: string | null;
  pickup_mode: PickupMode;
  sender_name: string;
  sender_phone?: string | null;
  sender_phone_masked: string;
  province_id: number;
  district_id: number;
  ward_id: number;
  pickup_address: string;
  latitude?: number | null;
  longitude?: number | null;
  estimated_parcel_count: number;
  estimated_weight_gram: number;
  note?: string | null;
  assigned_driver_id: number | null;
  assigned_driver_name?: string | null;
  assigned_driver_phone_masked?: string | null;
  assigned_at?: string | null;
  sla_deadline_at: string | null;
  status: PickupRequestStatus;
  picked_up_at?: string | null;
  failure_reason?: string | null;
  cancel_reason?: string | null;
  version: number;
  created_at: string;
  updated_at?: string;
}

export interface DriverOption {
  id: number;
  public_id: string;
  employee_code: string;
  full_name: string;
  phone_masked: string;
  branch_id: number | null;
  active_pickup_count: number;
}

export interface BranchOption {
  id: number;
  code: string;
  name: string;
  province_id: number;
  district_id: number;
}

export interface GeoOption {
  id: number;
  name: string;
}

export interface CreatePickupRequestInput {
  branch_id: number;
  pickup_mode: PickupMode;
  sender_name: string;
  sender_phone: string;
  province_id: number;
  district_id: number;
  ward_id: number;
  pickup_address: string;
  estimated_parcel_count: number;
  estimated_weight_gram: number;
  note?: string;
}

export interface AssignDriverInput {
  driver_id?: number | null;
  auto_assign?: boolean;
  version: number;
}

export interface CancelPickupInput {
  cancel_reason: string;
  version: number;
}

export interface PickupDispatchFilters {
  branch_id?: number | null;
  status?: PickupRequestStatus | "all";
  search?: string;
  sla_alert_only?: boolean;
}