import type {
  PickupRequestStatus,
  ShipmentStatus,
} from "@/types/api.types";
import type { ShipmentStatusHistoryItem } from "@/features/tracking/types/tracking.types";

export interface ShipmentParcel {
  parcel_index: number;
  parcel_barcode: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  actual_weight_gram: number;
  volumetric_weight_gram: number;
  chargeable_weight_gram: number;
  description: string;
}

export interface ShipmentRecord {
  kind: "shipment";
  public_id: string;
  tracking_code: string;
  status: ShipmentStatus;
  origin_branch_id: number;
  destination_branch_id: number;
  parcel_count: number;
  chargeable_weight_gram: number;
  base_freight_amount: number;
  surcharge_amount?: number;
  vas_amount?: number;
  vat_amount?: number;
  total_freight_amount: number;
  cod_amount: number;
  version: number;
  created_at: string;
  delivered_at?: string;
  pickup_request_id?: number;
  sender_name?: string;
  sender_phone_masked?: string;
  sender_address?: string;
  recipient_name?: string;
  recipient_phone_masked?: string;
  recipient_address?: string;
  shipment_parcels: ShipmentParcel[];
  shipment_status_history: ShipmentStatusHistoryItem[];
}

export interface PickupRequestRecord {
  kind: "pickup_request";
  public_id: string;
  request_code: string;
  status: PickupRequestStatus | "pending_pickup";
  tracking_code?: string;
  pickup_type?: string;
  pickup_address?: string;
  created_at: string;
  version?: number;
  shipment?: ShipmentRecord;
}

export type ShipmentHistoryRecord = ShipmentRecord | PickupRequestRecord;
export type ShipmentRecordType = "all" | "shipment" | "pickup_request";

export interface CustomerShipmentsData {
  shipments: ShipmentRecord[];
  pickupRequests: PickupRequestRecord[];
}
