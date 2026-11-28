export interface CashCollection {
  public_id: string;
  collection_code: string;
  branch_id: number;
  shipment_count: number;
  total_amount: string;
  status: "draft" | "locked" | "cancelled";
  locked_at: string | null;
  version: number;
}

export interface RemittanceMockState {
  collections: CashCollection[];
  remitted_collection_ids: string[];
  selected_recipient_name: string;
  branch_names: Record<number, string>;
}

export interface ReceiptUpload {
  receipt_image_url: string;
  file_name: string;
  size: number;
}

export interface TransferFormValues {
  bank_name: string;
  bank_account_no: string;
  bank_reference_no: string;
}

export interface RemittanceMockSubmission {
  public_id: string;
  remittance_code: string;
  total_amount: string;
  status: "submitted";
  submitted_at: string;
  collection_ids: string[];
}

export interface MockRemittanceAttempt {
  idempotency_key: string;
  branch_id: number;
  collection_ids: string[];
  values: TransferFormValues;
  receipt: ReceiptUpload;
}
