import fixture from "../../../mocks/warehouse-bags.mock.json" with { type: "json" };
import type { ApiSuccessResponse, ApiPaginationResponse } from "../../../types/api.types.ts";
import type { BagLookupFormValues, BagSummaryData } from "../warehouse-bags.types.ts";
import { bagLookupFormSchema, bagStatusSchema, shipmentScanFormSchema } from "../warehouse-bags.schema.ts";

// Các kiểu dưới đây chỉ là projection fixture UI, không phải DTO KHA-39.
export type BagFixtureRow = Omit<BagSummaryData, "total_weight_gram"> & {
  id: number;
  origin_warehouse_id: number;
  destination_warehouse_id: number;
};
type FixtureDataset = Omit<typeof fixture.success_response.data, "manifest_bags"> & {
  manifest_bags: BagFixtureRow[];
};
export type BagFixtureErrorName = {
  [K in keyof typeof fixture]: typeof fixture[K] extends { error: unknown } ? K : never;
}[keyof typeof fixture];

export class WarehouseBagsContractBlockedError extends Error {
  constructor() {
    super("BLOCKED: KHA-39 chưa xác nhận method/path/DTO và quyền truy cập. Không gửi request hoặc fallback Mock.");
    this.name = "WarehouseBagsContractBlockedError";
  }
}

interface FixtureServiceOptions {
  useMock: boolean;
  scenario?: "default" | "empty";
}

// Cấu hình nội bộ để kiểm thử fixture; không phải query/payload API.
export function createWarehouseBagsService({ useMock, scenario = "default" }: FixtureServiceOptions) {
  function requireMock(): void {
    if (!useMock) throw new WarehouseBagsContractBlockedError();
  }

  function readDataset(): FixtureDataset {
    const data = structuredClone(fixture.success_response.data);
    const dataset: FixtureDataset = {
      ...data,
      manifest_bags: data.manifest_bags.map((bag) => ({ ...bag, status: bagStatusSchema.parse(bag.status) })),
    };
    if (scenario === "empty") {
      dataset.manifest_bags = [];
      dataset.shipments = [];
      dataset.manifest_bag_items = [];
    }
    return dataset;
  }

  function success<T>(data: T): ApiSuccessResponse<T> {
    return {
      success: true,
      message: fixture.success_response.message,
      data,
      meta: structuredClone(fixture.success_response.meta),
    };
  }

  function validate<T>(result: { success: true; data: T } | {
    success: false;
    error: { issues: { path: PropertyKey[]; message: string }[] };
  }): T {
    if (result.success) return result.data;
    const error = structuredClone(fixture.invalid_form_response);
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] === "value" ? "value" : String(issue.path[0]);
      (details[key] ??= []).push(issue.message);
    }
    throw { ...error, error: { ...error.error, details } };
  }

  return {
    async readFixtureDataset(): Promise<ApiSuccessResponse<FixtureDataset>> {
      requireMock();
      return success(readDataset());
    },

    async listBags(): Promise<ApiPaginationResponse<BagFixtureRow>> {
      requireMock();
      const template = scenario === "empty" ? fixture.empty_response : fixture.pagination_response;
      return { ...structuredClone(template), success: true, data: readDataset().manifest_bags };
    },

    async findBag(input: BagLookupFormValues) {
      requireMock();
      const lookup = validate(bagLookupFormSchema.safeParse(input));
      const data = readDataset();
      const bag = data.manifest_bags.find((row) => row[lookup.lookupBy] === lookup.value);
      if (!bag) throw structuredClone(fixture.bag_not_found_response);
      const items = data.manifest_bag_items.filter((item) => item.bag_id === bag.id);
      const shipmentIds = new Set(items.map((item) => item.shipment_id));
      return success({
        bag,
        manifest_bag_items: items,
        shipments: data.shipments.filter((row) => shipmentIds.has(row.id)),
      });
    },

    async findShipment(tracking_code: string) {
      requireMock();
      const input = validate(shipmentScanFormSchema.safeParse({ tracking_code }));
      const shipment = readDataset().shipments.find((row) => row.tracking_code === input.tracking_code);
      if (!shipment) throw structuredClone(fixture.shipment_not_found_response);
      return success(shipment);
    },

    async readErrorFixture(name: BagFixtureErrorName) {
      requireMock();
      return structuredClone(fixture[name]);
    },
  };
}

// Cùng công tắc với axiosClient; adapter HTTP bị khóa tới khi có contract.
export const warehouseBagsApi = createWarehouseBagsService({
  useMock: import.meta.env?.VITE_USE_MOCK === "true",
});
