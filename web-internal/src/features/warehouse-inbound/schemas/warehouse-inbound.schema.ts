import { z } from "zod";
import { WAREHOUSE_INBOUND_OPTIONS } from "../constants/warehouse-inbound.constants.ts";
import type { WarehouseInboundType } from "../types/warehouse-inbound.types.ts";

const inboundTypes: WarehouseInboundType[] = WAREHOUSE_INBOUND_OPTIONS.map(
  (option) => option.value,
);

// Schema chỉ xác thực đầu vào UI/demo, không phải payload Backend.
export const warehouseInboundScanSchema = z.object(
  {
    inboundType: z.enum(inboundTypes, {
      error: "Vui lòng chọn phân loại nhập kho hợp lệ.",
    }),
    barcode: z.string({ error: "Vui lòng nhập mã barcode." })
      .trim()
      .min(1, "Vui lòng nhập mã barcode."),
  },
  { error: "Dữ liệu quét không hợp lệ." },
);

export type WarehouseInboundScanInput = z.infer<typeof warehouseInboundScanSchema>;
