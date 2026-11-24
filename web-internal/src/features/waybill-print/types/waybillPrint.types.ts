import type { z } from "zod";
import type { printDocumentTypeSchema, trackingRangeInputSchema, trackingRangeRecordSchema, trackingRangeStatusSchema } from "../schemas/trackingRange.schema";

export type PrintDocumentType = z.infer<typeof printDocumentTypeSchema>;
export type TrackingRangeStatus = z.infer<typeof trackingRangeStatusSchema>;
export type TrackingRangeInput = z.infer<typeof trackingRangeInputSchema>;
export type TrackingRangeRecord = z.infer<typeof trackingRangeRecordSchema>;

// Rendering model, not a shipment response DTO or print-log request.
export interface PrintableParcel {
  parcelBarcode: string;
  parcelSequence: number;
  actualWeightGram: number | null;
}

export interface PrintableContact {
  name: string;
  phoneDisplay: string | null;
  addressDisplay: string;
}

export interface WaybillPrintModel {
  publicId: string;
  trackingCode: string;
  sender: PrintableContact;
  receiver: PrintableContact;
  parcelCount: number;
  parcels: PrintableParcel[];
  serviceName: string | null;
  actualWeightGram: number | null;
  volumetricWeightGram: number | null;
  chargeableWeightGram: number | null;
  freightAmount: string | null;
  codAmount: string | null;
  declaredValue: string | null;
  paymentMethod: "ngttn" | "ngtts" | "nntn";
  createdAt: string;
  originBranchName: string | null;
  destinationBranchName: string | null;
  baseFreightAmount: string | null;
  surchargeAmount: string | null;
  vasAmount: string | null;
  discountAmount: string | null;
  vatAmount: string | null;
}

export interface PrintCommand {
  shipmentPublicId: string;
  documentType: PrintDocumentType;
  parcelBarcodes: string[];
}

export interface PrintReceipt {
  requestId: string;
  message: string;
}

export interface WaybillSession {
  key: string;
  branchId: string | null;
  authenticated: boolean;
  roles: readonly string[];
  allowedBranchIds: readonly string[];
  branchOptions: readonly { id: string; name: string }[];
  allBranches: boolean;
}
