import { WAREHOUSE_INBOUND_OPTIONS } from "../constants/warehouse-inbound.constants.ts";
import type { DemoBarcode } from "../types/warehouse-inbound.types.ts";

// Dữ liệu trình diễn dùng chung cho các lựa chọn UI, không xác nhận nghiệp vụ nhập kho.
export const WAREHOUSE_INBOUND_DEMO_FIXTURE = {
  inboundOptions: WAREHOUSE_INBOUND_OPTIONS,
  barcodes: [
    { barcode: "DEMO-0001", barcodeType: "shipment" },
    { barcode: "DEMO-0002", barcodeType: "shipment" },
    { barcode: "DEMO-0003", barcodeType: "shipment" },
    { barcode: "DEMO-0004", barcodeType: "shipment" },
    { barcode: "DEMO-0005", barcodeType: "shipment" },
    { barcode: "DEMO-0006", barcodeType: "shipment" },
    { barcode: "DEMO-0007", barcodeType: "shipment" },
    { barcode: "DEMO-0008", barcodeType: "shipment" },
    { barcode: "DEMO-0009", barcodeType: "bag" },
    { barcode: "DEMO-0010", barcodeType: "bag" },
    { barcode: "DEMO-0011", barcodeType: "bag" },
    { barcode: "DEMO-0012", barcodeType: "bag" },
  ] satisfies readonly DemoBarcode[],
} as const;
