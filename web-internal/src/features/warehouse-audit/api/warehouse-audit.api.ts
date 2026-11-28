import { toast } from "sonner";
import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import type { ApiPaginationResponse, ApiSuccessResponse } from "@/types/api.types";
import { warehouseAuditMock } from "./warehouse-audit.mock";
import type {
  CreateWarehouseStockAuditInput,
  UpdateWarehouseStockAuditInput,
  WarehouseStockAudit,
} from "../types/warehouse-audit.types";

const ENDPOINT = "/api/v1/warehouse/stock-audits";

async function runWithDevMock<T>(
  operation: () => T,
  request: () => Promise<T>,
): Promise<T> {
  if (USE_MOCK) return operation();
  if (!import.meta.env.DEV) return request();

  try {
    return await request();
  } catch (error) {
    console.warn("Không gọi được API kiểm kê kho; chuyển sang dữ liệu mẫu dev.", error);
    toast.warning("Không kết nối được API kiểm kê kho; đang dùng dữ liệu mẫu trên máy.");
    return operation();
  }
}

export const warehouseAuditApi = {
  list(): Promise<WarehouseStockAudit[]> {
    return runWithDevMock(
      () => warehouseAuditMock.list(),
      async () => {
        const response = await axiosClient.get<
          ApiPaginationResponse<WarehouseStockAudit> | ApiSuccessResponse<WarehouseStockAudit[]>
        >(ENDPOINT, { params: { page: 1, per_page: 100 } });
        return response.data.data;
      },
    );
  },

  detail(id: number): Promise<WarehouseStockAudit> {
    return runWithDevMock(
      () => warehouseAuditMock.detail(id),
      async () => {
        const response = await axiosClient.get<ApiSuccessResponse<WarehouseStockAudit>>(
          `${ENDPOINT}/${id}`,
        );
        return response.data.data;
      },
    );
  },

  create(input: CreateWarehouseStockAuditInput): Promise<WarehouseStockAudit> {
    return runWithDevMock(
      () => warehouseAuditMock.create(input),
      async () => {
        const response = await axiosClient.post<ApiSuccessResponse<WarehouseStockAudit>>(
          ENDPOINT,
          input,
        );
        return response.data.data;
      },
    );
  },

  update(
    id: number,
    input: UpdateWarehouseStockAuditInput,
  ): Promise<WarehouseStockAudit> {
    return runWithDevMock(
      () => warehouseAuditMock.update(id, input),
      async () => {
        const response = await axiosClient.patch<ApiSuccessResponse<WarehouseStockAudit>>(
          `${ENDPOINT}/${id}`,
          input,
        );
        return response.data.data;
      },
    );
  },

  remove(id: number): Promise<void> {
    return runWithDevMock(
      () => warehouseAuditMock.remove(id),
      async () => {
        await axiosClient.delete<ApiSuccessResponse<null>>(`${ENDPOINT}/${id}`);
      },
    );
  },
};
