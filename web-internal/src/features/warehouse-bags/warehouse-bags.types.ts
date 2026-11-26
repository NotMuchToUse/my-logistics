import type { z } from "zod";
import type {
  bagClosingFormSchema,
  bagLookupFormSchema,
  bagStatusSchema,
  shipmentScanFormSchema,
} from "./warehouse-bags.schema.ts";

export type BagStatus = z.infer<typeof bagStatusSchema>;
export type BagClosingFormValues = z.infer<typeof bagClosingFormSchema>;
export type ShipmentScanFormValues = z.infer<typeof shipmentScanFormSchema>;
export type BagLookupFormValues = z.infer<typeof bagLookupFormSchema>;

// Projection các cột đã xác nhận (KHA-38 mục 5.1), không phải response DTO.
export interface BagSummaryData {
  public_id: string;
  bag_code: string;
  seal_number: string;
  status: BagStatus;
  shipment_count: number;
  total_weight_gram: number;
  version: number;
}

// null biểu thị chưa có dữ liệu, khác giá trị 0 đã được xác nhận.
export interface BagSummaryViewState {
  bag: BagSummaryData | null;
  confirmedWeightGram: number | null;
}
