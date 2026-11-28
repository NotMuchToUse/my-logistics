import fixture from "@/mocks/warehouseOutboundLinehaul.mock.json";
import { z } from "zod";
import type { ApiSuccessResponse } from "@/types/api.types";
import {
  mawbNumberSchema,
  outboundScanSchema,
} from "../schemas/warehouse-outbound-linehaul.schema";
import type {
  LoadSummary,
  OutboundLinehaulDataset,
  OutboundScannedItem,
} from "../types/warehouse-outbound-linehaul.types";

const idSchema = z.number().int().positive();
const datasetSchema = z.object({
  warehouses: z.array(z.object({
    id: idSchema,
    code: z.string(),
    name: z.string(),
  })),
  vehicles: z.array(z.object({
    id: idSchema,
    plate_number: z.string(),
    vehicle_type: z.string(),
    max_payload_kg: z.string(),
    status: z.string(),
  })),
  partners: z.array(z.object({
    id: idSchema,
    code: z.string(),
    name: z.string(),
    partner_type: z.enum(["linehaul_carrier", "airline_agent", "lastmile_3pl"]),
    is_active: z.number(),
  })),
  shipments: z.array(z.object({
    tracking_code: z.string(),
    status: z.string(),
    current_warehouse_id: idSchema,
    destination_branch_id: idSchema,
    chargeable_weight_gram: z.number().int().nonnegative(),
  })),
  sealed_bags: z.array(z.object({
    seal_number: z.string(),
    origin_warehouse_id: idSchema,
    destination_warehouse_id: idSchema,
    chargeable_weight_gram: z.number().int().nonnegative(),
    is_sealed: z.boolean(),
  })),
  routing_rules: z.array(z.object({
    origin_warehouse_id: idSchema,
    destination_branch_id: idSchema,
    next_hop_warehouse_id: idSchema,
    is_active: z.number(),
  })),
}) satisfies z.ZodType<OutboundLinehaulDataset>;

export class WarehouseOutboundLinehaulApiBlockedError extends Error {
  constructor() {
    super("API xuất kho trung chuyển chưa được triển khai; không gửi request.");
    this.name = "WarehouseOutboundLinehaulApiBlockedError";
  }
}

function readDataset(): OutboundLinehaulDataset {
  const parsed = datasetSchema.safeParse(fixture.success_response.data);
  if (!parsed.success) {
    throw new Error("Dữ liệu demo xuất kho trung chuyển không hợp lệ.");
  }
  return parsed.data;
}

function success<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    message: fixture.success_response.message,
    data,
    meta: structuredClone(fixture.success_response.meta),
  };
}

export function calculateLoadSummary(
  items: readonly OutboundScannedItem[],
  maxPayloadKg: string,
): LoadSummary {
  const totalWeight = items.reduce(
    (total, item) => total + item.chargeable_weight_gram,
    0,
  );
  const maxPayload = Math.round(Number(maxPayloadKg) * 1000);
  const loadPercentage = maxPayload > 0
    ? Math.round((totalWeight / maxPayload) * 100)
    : 0;

  return {
    total_weight_gram: totalWeight,
    max_payload_gram: maxPayload,
    load_percentage: loadPercentage,
    is_overloaded: maxPayload > 0 && totalWeight > maxPayload,
  };
}

export function createWarehouseOutboundLinehaulApi(useMock: boolean) {
  function requireMock(): void {
    if (!useMock) throw new WarehouseOutboundLinehaulApiBlockedError();
  }

  return {
    async readDataset(): Promise<ApiSuccessResponse<OutboundLinehaulDataset>> {
      requireMock();
      return success(readDataset());
    },

    async scanCode(
      rawCode: string,
      originWarehouseId: number,
      targetWarehouseId: number,
    ): Promise<OutboundScannedItem> {
      requireMock();
      const code = outboundScanSchema.parse(rawCode);
      if (originWarehouseId === targetWarehouseId) {
        throw new Error("Kho nhận phải khác kho xuất hiện tại.");
      }

      const data = readDataset();
      const shipment = data.shipments.find(
        (item) => item.tracking_code === code,
      );
      if (shipment) {
        if (shipment.current_warehouse_id !== originWarehouseId) {
          throw new Error("Vận đơn không thuộc kho xuất hiện tại.");
        }
        if (!["in_warehouse", "bagged"].includes(shipment.status)) {
          throw new Error("Trạng thái vận đơn không cho phép xuất trung chuyển.");
        }

        const routingRule = data.routing_rules.find(
          (rule) => rule.is_active === 1
            && rule.origin_warehouse_id === originWarehouseId
            && rule.destination_branch_id === shipment.destination_branch_id,
        );
        const expectedNextHop = routingRule?.next_hop_warehouse_id ?? null;

        return {
          item_key: `shipment:${shipment.tracking_code}`,
          item_type: "shipment",
          code: shipment.tracking_code,
          status: shipment.status,
          chargeable_weight_gram: shipment.chargeable_weight_gram,
          expected_next_hop_warehouse_id: expectedNextHop,
          is_wrong_route: expectedNextHop !== targetWarehouseId,
          scanned_at: new Date().toISOString(),
        };
      }

      const bag = data.sealed_bags.find((item) => item.seal_number === code);
      if (bag) {
        if (bag.origin_warehouse_id !== originWarehouseId) {
          throw new Error("Túi Seal không thuộc kho xuất hiện tại.");
        }
        if (!bag.is_sealed) {
          throw new Error("Chỉ được xuất túi đã niêm phong.");
        }
        return {
          item_key: `sealed_bag:${bag.seal_number}`,
          item_type: "sealed_bag",
          code: bag.seal_number,
          status: "sealed",
          chargeable_weight_gram: bag.chargeable_weight_gram,
          expected_next_hop_warehouse_id: bag.destination_warehouse_id,
          is_wrong_route: bag.destination_warehouse_id !== targetWarehouseId,
          scanned_at: new Date().toISOString(),
        };
      }

      throw new Error("Không tìm thấy mã trong dữ liệu demo.");
    },

    validateMawbNumber(value: string): string {
      return mawbNumberSchema.parse(value);
    },
  };
}

export const warehouseOutboundLinehaulApi = createWarehouseOutboundLinehaulApi(
  import.meta.env.VITE_USE_MOCK === "true",
);
