export type ShipmentHistoryVisibility = "internal" | "public";

export interface ShipmentParty {
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  phone_masked?: string | null;
  address?: string | null;
  address_line?: string | null;
  province_name?: string | null;
  district_name?: string | null;
  ward_name?: string | null;
}

export interface ShipmentParcel {
  id: number | string;
  parcel_code?: string | null;
  description?: string | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  actual_weight_kg?: number | null;
  volumetric_weight_kg?: number | null;
  chargeable_weight_kg?: number | null;
  actual_weight_g?: number | null;
  volumetric_weight_g?: number | null;
  chargeable_weight_g?: number | null;
}

export interface ShipmentChargeSnapshot {
  id: number | string;
  code?: string | null;
  name?: string | null;
  vas_name?: string | null;
  surcharge_name?: string | null;
  amount?: number | null;
  unit_price?: number | null;
  quantity?: number | null;
}

export interface ShipmentStatusHistory {
  id: number | string;
  status: string;
  description?: string | null;
  note?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
  location_name?: string | null;
  visibility?: ShipmentHistoryVisibility | null;
  scope?: ShipmentHistoryVisibility | null;
  is_public?: boolean | null;
}

export interface ShipmentPrintLog {
  id: number | string;
  print_type?: string | null;
  document_type?: string | null;
  printed_at?: string | null;
  created_at?: string | null;
  printed_by_name?: string | null;
  employee_name?: string | null;
  copies?: number | null;
}

export interface ShipmentDetail {
  id: number | string;
  public_id: string;
  status?: string | null;
  service_name?: string | null;
  created_at?: string | null;
  sender?: ShipmentParty | null;
  receiver?: ShipmentParty | null;
  shipment_parcels?: ShipmentParcel[] | null;
  shipment_vas?: ShipmentChargeSnapshot[] | null;
  shipment_surcharges?: ShipmentChargeSnapshot[] | null;
  shipping_fee?: number | null;
  base_shipping_fee?: number | null;
  freight_fee?: number | null;
  cod_amount?: number | null;
  cod_fee?: number | null;
  status_history?: ShipmentStatusHistory[] | null;
  shipment_status_history?: ShipmentStatusHistory[] | null;
  print_logs?: ShipmentPrintLog[] | null;
}
