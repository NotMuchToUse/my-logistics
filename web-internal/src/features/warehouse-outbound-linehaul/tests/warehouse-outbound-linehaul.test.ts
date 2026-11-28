import { describe, expect, it } from "vitest";
import {
  calculateLoadSummary,
  createWarehouseOutboundLinehaulApi,
} from "../api/warehouse-outbound-linehaul.api";
import { mawbNumberSchema } from "../schemas/warehouse-outbound-linehaul.schema";
import type { OutboundScannedItem } from "../types/warehouse-outbound-linehaul.types";

const api = createWarehouseOutboundLinehaulApi(true);

describe("warehouse outbound linehaul demo", () => {
  it("recognizes a valid route and flags a wrong route", async () => {
    const valid = await api.scanCode("VS26112300002", 2, 3);
    const wrong = await api.scanCode("VS26112300002", 2, 1);
    const scopedOrigin = await api.scanCode("DEMO-VS-WH1-0001", 1, 2);

    expect(valid.is_wrong_route).toBe(false);
    expect(valid.expected_next_hop_warehouse_id).toBe(3);
    expect(wrong.is_wrong_route).toBe(true);
    expect(scopedOrigin.is_wrong_route).toBe(false);
  });

  it("accepts only sealed bags scanned from their origin warehouse", async () => {
    const bag = await api.scanCode("MOCK-SEAL-001", 2, 1);

    expect(bag.item_type).toBe("sealed_bag");
    expect(bag.is_wrong_route).toBe(false);
    await expect(api.scanCode("MOCK-SEAL-001", 1, 2)).rejects.toThrow(
      "Túi Seal không thuộc kho xuất hiện tại.",
    );
  });

  it("blocks API mode rather than sending an unconfirmed request", async () => {
    const blockedApi = createWarehouseOutboundLinehaulApi(false);

    await expect(blockedApi.readDataset()).rejects.toThrow(
      "API xuất kho trung chuyển chưa được triển khai",
    );
    await expect(blockedApi.scanCode("VS26112300002", 2, 3)).rejects.toThrow(
      "API xuất kho trung chuyển chưa được triển khai",
    );
  });

  it("calculates vehicle load and prevents overloading", () => {
    const items: OutboundScannedItem[] = [
      {
        item_key: "shipment:VS26112300002",
        item_type: "shipment",
        code: "VS26112300002",
        status: "in_warehouse",
        chargeable_weight_gram: 800,
        expected_next_hop_warehouse_id: 3,
        is_wrong_route: false,
        scanned_at: "2026-11-28T00:00:00.000Z",
      },
      {
        item_key: "sealed_bag:MOCK-SEAL-001",
        item_type: "sealed_bag",
        code: "MOCK-SEAL-001",
        status: "sealed",
        chargeable_weight_gram: 850000,
        expected_next_hop_warehouse_id: 1,
        is_wrong_route: false,
        scanned_at: "2026-11-28T00:00:00.000Z",
      },
      {
        item_key: "sealed_bag:MOCK-SEAL-002",
        item_type: "sealed_bag",
        code: "MOCK-SEAL-002",
        status: "sealed",
        chargeable_weight_gram: 750000,
        expected_next_hop_warehouse_id: 1,
        is_wrong_route: false,
        scanned_at: "2026-11-28T00:00:00.000Z",
      },
    ];

    expect(calculateLoadSummary(items, "1500.00")).toMatchObject({
      total_weight_gram: 1600800,
      max_payload_gram: 1500000,
      is_overloaded: true,
    });
  });

  it("validates the MAWB number format", () => {
    expect(mawbNumberSchema.safeParse("738-12345678").success).toBe(true);
    expect(mawbNumberSchema.safeParse("738 12345678").success).toBe(false);
  });
});
