import type { ShipmentStatus } from "@/types/api.types";

export type OutboundDeliveryReceiptStatus = "draft" | "confirmed" | "cancelled";

export interface DeliveryDriverOption {
  id: number;
  public_id: string;
  employee_code: string;
  full_name: string;
  phone_masked: string;
  branch_id: number;
  vehicle_plate: string | null;
  active_delivery_count: number;
  is_active: boolean;
}

export interface AvailableDeliveryShipment {
  shipment_id: number;
  shipment_public_id: string;
  tracking_code: string;
  status: ShipmentStatus;
  current_branch_id: number;
  current_warehouse_id: number;
  destination_branch_id: number;
  recipient_name: string;
  recipient_phone_masked: string;
  recipient_address: string;
  chargeable_weight_gram: number;
  parcel_count: number;
  cod_amount: number;
}

export interface OutboundDeliveryReceiptItem {
  id: number;
  shipment_id: number;
  shipment_public_id: string;
  tracking_code: string;
  shipment_status: ShipmentStatus;
  recipient_name: string;
  recipient_phone_masked: string;
  recipient_address: string;
  chargeable_weight_gram: number;
  parcel_count: number;
  cod_amount: number;
  scanned_at: string;
  scanned_by_name: string;
  removed_at: string | null;
  remove_reason: string | null;
  removed_by_name: string | null;
}

export interface OutboundDeliveryReceipt {
  public_id: string;
  receipt_code: string;
  receipt_type: "outbound_delivery";
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  branch_id: number;
  branch_name: string;
  driver_id: number;
  driver_code: string;
  driver_name: string;
  driver_phone_masked: string;
  total_shipments: number;
  total_weight_gram: number;
  total_cod_amount: number;
  status: OutboundDeliveryReceiptStatus;
  note: string | null;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  created_by_name: string;
  version: number;
  created_at: string;
  updated_at: string;
  items: OutboundDeliveryReceiptItem[];
}

export interface OutboundDeliveryBootstrapData {
  warehouse: {
    id: number;
    code: string;
    name: string;
    branch_id: number;
    branch_name: string;
  };
  drivers: DeliveryDriverOption[];
  available_shipments: AvailableDeliveryShipment[];
  active_draft: OutboundDeliveryReceipt | null;
  recent_confirmed: OutboundDeliveryReceipt[];
}

export interface CreateOutboundDeliveryPayload {
  warehouse_id: number;
  driver_id: number;
  tracking_codes?: string[];
  note?: string;
}

export interface ScanOutboundDeliveryPayload {
  tracking_code: string;
}

export interface RemoveOutboundDeliveryItemPayload {
  item_id: number;
  remove_reason: string;
  version: number;
}

export interface ConfirmOutboundDeliveryPayload {
  note?: string;
  version: number;
}
