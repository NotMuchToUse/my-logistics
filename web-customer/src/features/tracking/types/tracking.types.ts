export interface ShipmentStatusHistoryItem {
  from_status: string | null;
  to_status: string;
  description: string;
  is_public_visible?: number | boolean;
  occurred_at: string;
}

export interface PublicTrackingShipment {
  public_id: string;
  tracking_code: string;
  status: string;
  sender_name: string;
  sender_phone_masked: string;
  recipient_name: string;
  recipient_phone_masked: string;
  origin_branch_id: number;
  destination_branch_id: number;
  service_type_id: number;
  created_at: string;
  updated_at?: string;
  delivered_at?: string;
  shipment_status_history: ShipmentStatusHistoryItem[];
}

export interface TrackingSearchResult {
  tracking_code: string;
  shipment?: PublicTrackingShipment;
  error?: string;
}
