import { USE_MOCK } from "@/core/api/axiosClient";
import { warehouseInboundScanSchema } from "../schemas/warehouse-inbound.schema.ts";
import type {
  DemoBarcode,
  DemoScanResult,
  WarehouseInboundType,
} from "../types/warehouse-inbound.types.ts";

type DemoLookupError = Extract<
  DemoScanResult,
  { type: "invalid" | "not_found" | "mock_unavailable" }
> & { message: string };

// Kết quả tra cứu UI/demo, không phải phản hồi API Backend.
export type DemoBarcodeLookupResult =
  | { type: "found"; item: DemoBarcode; inboundType: WarehouseInboundType }
  | DemoLookupError;

export async function lookupDemoBarcode(input: unknown): Promise<DemoBarcodeLookupResult> {
  if (!USE_MOCK) {
    return {
      type: "mock_unavailable",
      message: "Chức năng tra cứu demo chỉ khả dụng trong chế độ Mock.",
    };
  }

  const parsed = warehouseInboundScanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      type: "invalid",
      message: parsed.error.issues.map((issue) => issue.message).join(" "),
    };
  }

  const { WAREHOUSE_INBOUND_DEMO_FIXTURE } = await import(
    "../mocks/warehouse-inbound.mock.ts"
  );
  const item = WAREHOUSE_INBOUND_DEMO_FIXTURE.barcodes.find(
    (entry) => entry.barcode === parsed.data.barcode,
  );

  if (!item) {
    return {
      type: "not_found",
      message: "Không tìm thấy mã barcode trong dữ liệu demo.",
    };
  }

  return { type: "found", item, inboundType: parsed.data.inboundType };
}
