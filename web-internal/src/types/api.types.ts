export type ApiErrorCode =
  | "400_BAD_REQUEST"
  | "401_UNAUTHORIZED"
  | "403_FORBIDDEN"
  | "403_BRANCH_SCOPE"
  | "404_NOT_FOUND"
  | "409_VERSION_CONFLICT"
  | "409_IDEMPOTENCY_DUPLICATE"
  | "422_VALIDATION_ERROR"
  | "429_TOO_MANY_REQUESTS"
  | "500_INTERNAL_ERROR";

export type ShipmentStatus =
  | "draft"
  | "pending_pickup"
  | "picked_up"
  | "in_warehouse"
  | "bagged"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delivery_failed"
  | "pending_return"
  | "returning"
  | "returned"
  | "incident"
  | "cancelled";

export type CodTransactionStatus =
  | "pending"
  | "driver_holding"
  | "collected_by_branch"
  | "remitted_to_hq"
  | "settled_to_customer"
  | "cancelled";

export type PickupRequestStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "picked_up"
  | "pickup_failed"
  | "cancelled";

export type CashCollectionStatus = "draft" | "locked" | "cancelled";

export type CashRemittanceStatus =
  | "draft"
  | "submitted"
  | "verified"
  | "rejected";

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiMeta {
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: ApiMeta;
}

export interface ApiPaginationResponse<T> {
  success: true;
  message: string;
  data: T[];
  meta: ApiMeta & {
    pagination: PaginationMeta;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string[]>;
    trace_id?: string;
  };
}
