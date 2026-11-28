import type {
  ApiPaginationResponse,
  PaginationMeta,
  ShipmentStatus,
} from "@/types/api.types";

export type ShipmentExceptionsTab = "exceptions" | "pending-return";

export type ShipmentExceptionStatus = "delivery_failed" | "incident";

export type PendingReturnStatus = "pending_return";

export type ShipmentType =
  | "standard"
  | "return_shipment"
  | "forward_shipment";

export interface ShipmentParcel {
  parcel_index: number;
  parcel_barcode: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  actual_weight_gram: number;
  volumetric_weight_gram: number;
  chargeable_weight_gram: number;
  description: string | null;
}

export interface ShipmentStatusHistoryItem {
  client_event_uuid?: string;
  from_status: ShipmentStatus | null;
  to_status: ShipmentStatus;
  branch_id?: number;
  warehouse_id?: number | null;
  actor_id?: number;
  description: string;
  is_public_visible: 1 | 0;
  occurred_at: string;
}

export interface RawShipmentMockListItem {
  public_id: string;
  tracking_code: string;
  shipment_type?: ShipmentType;
  status: ShipmentStatus;
  origin_branch_id: number;
  destination_branch_id: number;
  current_branch_id: number;
  current_warehouse_id?: number;
  assigned_driver_id?: number;
  service_type_id: number;
  cargo_category_id: number;
  parcel_count: number;
  chargeable_weight_gram: number;
  total_freight_amount: number | string;
  cod_amount: number | string;
  delivery_attempt_count?: number;
  note?: string;
  sender_name?: string;
  sender_phone_masked?: string;
  recipient_name?: string;
  recipient_phone_masked?: string;
  version: number;
  created_at: string;
  shipment_parcels: ShipmentParcel[];
  shipment_status_history: ShipmentStatusHistoryItem[];
  parent_shipment_id?: number;
}

export interface RawShipmentMockDetail {
  public_id: string;
  tracking_code: string;
  shipment_type?: ShipmentType;
  status: ShipmentStatus;
  origin_branch_id: number;
  destination_branch_id: number;
  current_branch_id: number;
  current_warehouse_id: number | null;
  assigned_driver_id: number | null;
  service_type_id: number;
  cargo_category_id: number;
  sender_name: string;
  sender_phone_masked: string;
  sender_province_id: number;
  sender_district_id: number;
  sender_ward_id: number;
  sender_address: string;
  recipient_name: string;
  recipient_phone_masked: string;
  recipient_province_id: number;
  recipient_district_id: number;
  recipient_ward_id: number;
  recipient_address: string;
  parcel_count: number;
  total_actual_weight_gram: number;
  total_volumetric_weight_gram: number;
  chargeable_weight_gram: number;
  declared_value: number | string;
  payment_method: "ngttn" | "ngtts" | "nntn";
  cod_amount: number | string;
  delivery_attempt_count: number;
  note: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  shipment_parcels: ShipmentParcel[];
  shipment_status_history: ShipmentStatusHistoryItem[];
  parent_shipment_id?: number;
}

export interface ShipmentExceptionListItem {
  public_id: string;
  tracking_code: string;
  status: ShipmentStatus;
  shipment_type?: ShipmentType;
  recipient_name?: string;
  recipient_phone_masked?: string;
  origin_branch_id: number;
  destination_branch_id: number;
  current_branch_id: number;
  delivery_attempt_count?: number;
  cod_amount: number | string;
  version: number;
  created_at: string;
  note?: string;
  parent_shipment_id?: number;
}

export type ShipmentExceptionsResponse =
  ApiPaginationResponse<RawShipmentMockListItem>;

export type ShipmentExceptionsPagination = PaginationMeta;

export interface ShipmentExceptionsQuery {
  page: number;
  per_page: number;
  status?: ShipmentStatus;
  tracking_code?: string;
}

export interface ShipmentExceptionsUiFilter {
  tab: ShipmentExceptionsTab;
  tracking_code: string;
  status: ShipmentExceptionStatus | PendingReturnStatus | "";
}

export type ForwardShipmentField =
  | "recipient_name"
  | "recipient_phone"
  | "recipient_address"
  | "recipient_province_id"
  | "recipient_district_id"
  | "recipient_ward_id"
  | "destination_branch_id";

export interface ForwardShipmentRequest {
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_province_id: number;
  recipient_district_id: number;
  recipient_ward_id: number;
  destination_branch_id: number;
}

export interface ForwardShipmentFormValues {
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_province_id: string;
  recipient_district_id: string;
  recipient_ward_id: string;
  destination_branch_id: string;
}

export type ForwardShipmentFormInputValues = {
  [Field in ForwardShipmentField]: string;
};

export interface ForwardShipmentFormBlankValues {
  recipient_name: "";
  recipient_phone: "";
  recipient_address: "";
  recipient_province_id: "";
  recipient_district_id: "";
  recipient_ward_id: "";
  destination_branch_id: "";
}

export interface ShipmentInheritedInfo {
  public_id: string;
  tracking_code: string;
  shipment_type?: ShipmentType;
  sender_name: string;
  sender_phone_masked: string;
  sender_address: string;
  sender_province_id: number;
  sender_district_id: number;
  sender_ward_id: number;
  parcel_count: number;
  cod_amount: number | string;
  recipient_name: string;
  recipient_phone_masked: string;
  recipient_address: string;
  recipient_province_id: number;
  recipient_district_id: number;
  recipient_ward_id: number;
  destination_branch_id: number;
}

export interface ShipmentExceptionCapabilities {
  canViewList: boolean;
  canOpenReturnModal: boolean;
  canCreateReturnShipment: boolean;
  canOpenForwardModal: boolean;
  canCreateForwardShipment: boolean;
  canApproveRedelivery: boolean;
  unavailableReason?: string;
}

export type ShipmentExceptionAction =
  | "view-detail"
  | "open-return-modal"
  | "create-return-shipment"
  | "open-forward-modal"
  | "create-forward-shipment"
  | "approve-redelivery";

export type ShipmentExceptionDataSource = "mock" | "backend";
