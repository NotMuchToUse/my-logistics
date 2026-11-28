import type { WAREHOUSE_INBOUND_OPTIONS } from "../constants/warehouse-inbound.constants";

// Các kiểu này chỉ dùng cho UI/demo, không phải contract Backend.
export type WarehouseInboundType = (typeof WAREHOUSE_INBOUND_OPTIONS)[number]["value"];

export type DemoBarcodeType = "shipment" | "bag";

export interface DemoBarcode {
  barcode: string;
  barcodeType: DemoBarcodeType;
}

export interface DemoScanItem extends DemoBarcode {
  inboundType: WarehouseInboundType;
  scannedAt: string;
}

export type DemoScanResult =
  | { type: "added"; item: DemoScanItem }
  | { type: "invalid" }
  | { type: "duplicate" }
  | { type: "not_found" }
  | { type: "mock_unavailable" };

export type DemoScanSound = "success" | "error";
