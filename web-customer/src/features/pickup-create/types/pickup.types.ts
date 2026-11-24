export interface PickupAddress {
  id: number;
  customer_id: number;
  label: string;
  address_role: string;
  contact_name: string;
  phone_masked: string;
  address_detail: string;
  deleted_at: string | null;
}

export interface DropoffBranch {
  public_id: string;
  name: string;
  address_detail: string;
  latitude: number;
  longitude: number;
  operating_hours: string;
  accepts_customer_dropoff: number;
  is_active: number;
  deleted_at: string | null;
}

export interface PickupOptions {
  addresses: PickupAddress[];
  branches: DropoffBranch[];
}

// Local form command only; not an HTTP request contract.
export interface PickupDraft {
  handoverMode: "driver_pickup" | "counter_dropoff";
  addressId: string;
  branchPublicId: string;
  parcelCount: number;
  weightGram: number;
}

export interface PickupReceipt {
  request_code: string;
  handover_mode: PickupDraft["handoverMode"];
  estimated_parcel_count: number;
  estimated_weight_gram: number;
  status: "pending";
  version: number;
}
