export type RemittanceStatus =
  | "draft"
  | "submitted"
  | "verified"
  | "rejected";

export interface Remittance {
  public_id: string;
  branch_id: number;
  branch_code?: string | null;
  branch_name?: string | null;
  amount: number;
  submitted_at: string;
  submitted_by_name?: string | null;
  receipt_image_url: string | null;
  status: RemittanceStatus;
  journal_ref?: string | null;
  note?: string | null;
}

export interface RemittanceVerificationInput {
  status: Extract<RemittanceStatus, "verified" | "rejected">;
  journal_ref: string | null;
  note: string | null;
}

export type CustomerInvoiceStatus = "open" | "settled";

export interface CustomerInvoice {
  public_id: string;
  customer_id: string | null;
  customer_name: string;
  billing_period: string;
  ngtts_freight_amount: number;
  cod_collected_amount: number;
  compensation_offset_amount: number;
  settlement_balance: number;
  status: CustomerInvoiceStatus;
  created_at: string;
  settled_at?: string | null;
}

export type CustomerInvoiceInput = Omit<
  CustomerInvoice,
  "public_id" | "status" | "created_at" | "settled_at"
>;
