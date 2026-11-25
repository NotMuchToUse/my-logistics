import type {
  ApiPaginationResponse,
  ShipmentStatus,
} from "@/types/api.types";

export type ShipmentType =
  | "standard"
  | "return_shipment"
  | "forward_shipment";

export type PaymentMethod = "ngttn" | "ngtts" | "nntn";

export type FreightPaymentStatus =
  | "unpaid"
  | "paid_at_counter"
  | "collected_by_driver"
  | "invoiced_postpaid";

export interface ShipmentListItem {
  public_id: string;
  tracking_code: string;
  status: ShipmentStatus;
  sender_name: string;
  sender_phone_masked: string;
  recipient_name: string;
  recipient_phone_masked: string;
  origin_branch_name: string;
  destination_branch_name: string;
  service_type_name: string;
  assigned_driver_name: string | null;
  parcel_count: number;
  chargeable_weight_gram: number;
  total_freight_amount: number | string;
  cod_amount: number | string;
  is_priority: boolean;
  version: number;
  created_at: string;
}

export type ShipmentListResponse = ApiPaginationResponse<ShipmentListItem>;

export interface ShipmentListQuery {
  page: number;
  per_page: number;
  tracking_code?: string;
  phone?: string;
  status?: ShipmentStatus;
  service_type_id?: number;
  is_priority?: boolean;
  from_date?: string;
  to_date?: string;
  sort_by: ShipmentSortField;
  sort_direction: SortDirection;
}

export interface ShipmentFilterValues {
  tracking_code: string;
  phone: string;
  origin_branch_id: string;
  destination_branch_id: string;
  service_type_id: string;
  status: ShipmentStatus | "";
  from_date: string;
  to_date: string;
  is_priority: "all" | "1" | "0";
}

export interface ShipmentPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export type ShipmentSortField =
  | "created_at"
  | "tracking_code"
  | "cod_amount"
  | "total_freight_amount";

export type SortDirection = "ASC" | "DESC";

export interface ShipmentPriorityMutation {
  is_priority: boolean;
  version: number;
}

export interface ShipmentCancelMutation {
  version: number;
  cancel_reason?: string;
}

export interface ShipmentExportOptions {
  scope: "filtered" | "current_page";
}
