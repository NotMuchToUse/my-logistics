export type OutboundTransportMode = "vehicle" | "partner";
export type OutboundItemType = "shipment" | "sealed_bag";

export interface WarehouseOption {
  id: number;
  code: string;
  name: string;
}

export interface OutboundVehicle {
  id: number;
  plate_number: string;
  vehicle_type: string;
  max_payload_kg: string;
  status: string;
}

export interface OutboundPartner {
  id: number;
  code: string;
  name: string;
  partner_type: "linehaul_carrier" | "airline_agent" | "lastmile_3pl";
  is_active: number;
}

export interface OutboundShipmentFixture {
  tracking_code: string;
  status: string;
  current_warehouse_id: number;
  destination_branch_id: number;
  chargeable_weight_gram: number;
}

export interface OutboundSealedBagFixture {
  seal_number: string;
  origin_warehouse_id: number;
  destination_warehouse_id: number;
  chargeable_weight_gram: number;
  is_sealed: boolean;
}

export interface OutboundRoutingRuleFixture {
  origin_warehouse_id: number;
  destination_branch_id: number;
  next_hop_warehouse_id: number;
  is_active: number;
}

export interface OutboundLinehaulDataset {
  warehouses: WarehouseOption[];
  vehicles: OutboundVehicle[];
  partners: OutboundPartner[];
  shipments: OutboundShipmentFixture[];
  sealed_bags: OutboundSealedBagFixture[];
  routing_rules: OutboundRoutingRuleFixture[];
}

export interface OutboundScannedItem {
  item_key: string;
  item_type: OutboundItemType;
  code: string;
  status: string;
  chargeable_weight_gram: number;
  expected_next_hop_warehouse_id: number | null;
  is_wrong_route: boolean;
  scanned_at: string;
}

export interface OutboundDraftConfirmation {
  receipt_code: string;
  confirmed_at: string;
  item_count: number;
  total_weight_gram: number;
}

export interface LoadSummary {
  total_weight_gram: number;
  max_payload_gram: number;
  load_percentage: number;
  is_overloaded: boolean;
}
