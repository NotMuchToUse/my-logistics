export type DatabaseId = number | string;
export type ActiveFlag = 0 | 1;

export interface TimestampedRecord {
  id: DatabaseId;
  created_at: string;
  updated_at: string;
}

export interface SlaDeadline extends TimestampedRecord {
  service_type_id: DatabaseId;
  route_scope: RouteScope;
  pickup_sla_minutes: number;
  warehouse_inbound_sla_minutes: number;
  linehaul_sla_hours: number;
  delivery_sla_hours: number;
  max_storage_days_before_return: number;
  is_active: ActiveFlag;
}

export interface BranchRoutingRule extends TimestampedRecord {
  origin_warehouse_id: DatabaseId;
  destination_branch_id: DatabaseId;
  next_hop_warehouse_id: DatabaseId;
  transport_mode: TransportMode;
  estimated_transit_hours: number;
  is_active: ActiveFlag;
}

export interface ThirdPartyPartner extends TimestampedRecord {
  code: string;
  name: string;
  partner_type: PartnerType;
  contact_person: string | null;
  contact_phone: string | null;
  api_endpoint: string | null;
  is_active: ActiveFlag;
}

export interface Vehicle extends TimestampedRecord {
  branch_id: DatabaseId;
  partner_id: DatabaseId | null;
  plate_number: string;
  vehicle_type: VehicleType;
  max_payload_kg: string;
  default_driver_id: DatabaseId | null;
  status: VehicleStatus;
}

export type RouteScope =
  | "intra_province"
  | "intra_region"
  | "inter_region"
  | "remote_area";

export type TransportMode = "motorbike" | "truck" | "air_cargo";

export type PartnerType =
  | "linehaul_carrier"
  | "airline_agent"
  | "lastmile_3pl";

export type VehicleType =
  | "motorbike"
  | "van"
  | "truck_light"
  | "truck_heavy"
  | "air_flight";

export type VehicleStatus =
  | "available"
  | "in_transit"
  | "maintenance"
  | "retired";

export interface SlaDeadlinePayload {
  service_type_id: DatabaseId;
  route_scope: RouteScope;
  pickup_sla_minutes: number;
  warehouse_inbound_sla_minutes: number;
  linehaul_sla_hours: number;
  delivery_sla_hours: number;
  max_storage_days_before_return: number;
  is_active: ActiveFlag;
}

export interface BranchRoutingRulePayload {
  origin_warehouse_id: DatabaseId;
  destination_branch_id: DatabaseId;
  next_hop_warehouse_id: DatabaseId;
  transport_mode: TransportMode;
  estimated_transit_hours: number;
  is_active: ActiveFlag;
}

export interface ThirdPartyPartnerPayload {
  code: string;
  name: string;
  partner_type: PartnerType;
  contact_person: string | null;
  contact_phone: string | null;
  api_endpoint: string | null;
  is_active: ActiveFlag;
}

export interface VehiclePayload {
  branch_id: DatabaseId;
  partner_id: DatabaseId | null;
  plate_number: string;
  vehicle_type: VehicleType;
  max_payload_kg: string;
  default_driver_id: DatabaseId | null;
  status: VehicleStatus;
}

export interface LookupRecord {
  id: DatabaseId;
  code: string;
  name: string;
  is_active: number | boolean;
}

export interface DriverLookupRecord {
  id: DatabaseId;
  full_name: string;
  roles: string[];
  status: string;
  is_active: number | boolean;
}

export interface OpsConfigLookups {
  service_types: LookupRecord[];
  branches: LookupRecord[];
  warehouses: Array<LookupRecord & { branch_id: DatabaseId }>;
  partners: Array<Pick<ThirdPartyPartner, "id" | "code" | "name" | "is_active">>;
  drivers: DriverLookupRecord[];
}

export interface OpsConfigFilters {
  service_type_id?: string;
  route_scope?: string;
  is_active?: string;
  origin_warehouse_id?: string;
  destination_branch_id?: string;
  transport_mode?: string;
  partner_type?: string;
  vehicle_type?: string;
  branch_id?: string;
  partner_id?: string;
  status?: string;
}

export interface OpsConfigListParams {
  page: number;
  per_page: number;
  search?: string;
  filters?: OpsConfigFilters;
  signal?: AbortSignal;
}

export type OpsConfigResourceKey =
  | "sla_deadlines"
  | "routing_rules"
  | "partners"
  | "vehicles";
