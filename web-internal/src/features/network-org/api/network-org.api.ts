import { toast } from "sonner";
import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import networkOrgMock from "@/mocks/networkOrg.mock.json";
import type {
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "@/types/api.types";
import type {
  Branch,
  BranchInput,
  BranchType,
  NetworkOrgLocations,
  Warehouse,
  WarehouseInput,
  WarehouseType,
} from "../types/network-org.types";

const mockData = networkOrgMock.success_response.data;

function isBranchType(value: string): value is BranchType {
  return ["hq", "regional_hub", "branch", "post_office"].includes(value);
}

function isWarehouseType(value: string): value is WarehouseType {
  return ["hub_sorting", "branch_warehouse", "post_office_storage"].includes(
    value,
  );
}

function readBranchType(value: string): BranchType {
  if (!isBranchType(value)) {
    throw new Error(`Loại đơn vị mạng lưới không hợp lệ trong dữ liệu mẫu: ${value}`);
  }
  return value;
}

function readWarehouseType(value: string): WarehouseType {
  if (!isWarehouseType(value)) {
    throw new Error(`Loại kho không hợp lệ trong dữ liệu mẫu: ${value}`);
  }
  return value;
}

const mockBranches: Branch[] = mockData.branches.map((branch) => ({
  ...branch,
  branch_type: readBranchType(branch.branch_type),
}));
const mockWarehouses: Warehouse[] = mockData.warehouses.map((warehouse) => ({
  ...warehouse,
  warehouse_type: readWarehouseType(warehouse.warehouse_type),
  is_active: 1,
}));

export const networkOrgLocations: NetworkOrgLocations = {
  provinces: mockData.provinces.map(({ id, name }) => ({ id, name })),
  districts: mockData.districts.map(({ id, province_id, name }) => ({
    id,
    province_id,
    name,
  })),
  wards: mockData.wards.map(({ id, district_id, name }) => ({
    id,
    district_id,
    name,
  })),
};

let nextBranchId = Math.max(...mockBranches.map(({ id }) => id)) + 1;
let nextWarehouseId = Math.max(...mockWarehouses.map(({ id }) => id)) + 1;

async function runWithDevMock<T>(
  entity: string,
  mockOperation: () => T,
  apiOperation: () => Promise<T>,
): Promise<T> {
  if (USE_MOCK) {
    return mockOperation();
  }

  if (!import.meta.env.DEV) {
    return apiOperation();
  }

  try {
    return await apiOperation();
  } catch (error) {
    console.warn(`Không gọi được API ${entity}; chuyển sang dữ liệu mẫu dev.`, error);
    toast.warning(`Không kết nối được API ${entity}; đang dùng dữ liệu mẫu trên máy.`);
    return mockOperation();
  }
}

export function getBranches(): Promise<Branch[]> {
  return runWithDevMock(
    "chi nhánh",
    () => mockBranches.map((branch) => ({ ...branch })),
    async () => {
      const response = await axiosClient.get<ApiPaginationResponse<Branch>>(
        "/api/v1/admin/branches",
        { params: { page: 1, per_page: 100 } },
      );
      return response.data.data;
    },
  );
}

export function createBranch(input: BranchInput): Promise<Branch> {
  return runWithDevMock(
    "chi nhánh",
    () => {
      const branch: Branch = {
        ...input,
        id: nextBranchId++,
        public_id: `MOCK-BRANCH-${Date.now()}`,
      };
      mockBranches.push(branch);
      return { ...branch };
    },
    async () => {
      const response = await axiosClient.post<ApiSuccessResponse<Branch>>(
        "/api/v1/admin/branches",
        input,
      );
      return response.data.data;
    },
  );
}

export function updateBranch(
  id: number,
  input: BranchInput,
): Promise<Branch> {
  return runWithDevMock(
    "chi nhánh",
    () => {
      const index = mockBranches.findIndex((branch) => branch.id === id);
      if (index < 0) {
        throw new Error(`Không tìm thấy đơn vị mạng lưới ${id}.`);
      }
      mockBranches[index] = { ...mockBranches[index], ...input };
      return { ...mockBranches[index] };
    },
    async () => {
      const response = await axiosClient.patch<ApiSuccessResponse<Branch>>(
        `/api/v1/admin/branches/${id}`,
        input,
      );
      return response.data.data;
    },
  );
}

export function deleteBranch(id: number): Promise<void> {
  return runWithDevMock(
    "chi nhánh",
    () => {
      const index = mockBranches.findIndex((branch) => branch.id === id);
      if (index < 0) {
        throw new Error(`Không tìm thấy đơn vị mạng lưới ${id}.`);
      }
      mockBranches.splice(index, 1);
    },
    async () => {
      await axiosClient.delete<ApiSuccessResponse<null>>(
        `/api/v1/admin/branches/${id}`,
      );
    },
  );
}

export function getWarehouses(): Promise<Warehouse[]> {
  return runWithDevMock(
    "kho bãi",
    () => mockWarehouses.map((warehouse) => ({ ...warehouse })),
    async () => {
      const response = await axiosClient.get<ApiPaginationResponse<Warehouse>>(
        "/api/v1/admin/warehouses",
        { params: { page: 1, per_page: 100 } },
      );
      return response.data.data;
    },
  );
}

export function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  return runWithDevMock(
    "kho bãi",
    () => {
      const warehouse: Warehouse = {
        ...input,
        id: nextWarehouseId++,
        public_id: `MOCK-WAREHOUSE-${Date.now()}`,
      };
      mockWarehouses.push(warehouse);
      return { ...warehouse };
    },
    async () => {
      const response = await axiosClient.post<ApiSuccessResponse<Warehouse>>(
        "/api/v1/admin/warehouses",
        input,
      );
      return response.data.data;
    },
  );
}

export function updateWarehouse(
  id: number,
  input: WarehouseInput,
): Promise<Warehouse> {
  return runWithDevMock(
    "kho bãi",
    () => {
      const index = mockWarehouses.findIndex((warehouse) => warehouse.id === id);
      if (index < 0) {
        throw new Error(`Không tìm thấy kho ${id}.`);
      }
      mockWarehouses[index] = { ...mockWarehouses[index], ...input };
      return { ...mockWarehouses[index] };
    },
    async () => {
      const response = await axiosClient.patch<ApiSuccessResponse<Warehouse>>(
        `/api/v1/admin/warehouses/${id}`,
        input,
      );
      return response.data.data;
    },
  );
}

export function deleteWarehouse(id: number): Promise<void> {
  return runWithDevMock(
    "kho bãi",
    () => {
      const index = mockWarehouses.findIndex((warehouse) => warehouse.id === id);
      if (index < 0) {
        throw new Error(`Không tìm thấy kho ${id}.`);
      }
      mockWarehouses.splice(index, 1);
    },
    async () => {
      await axiosClient.delete<ApiSuccessResponse<null>>(
        `/api/v1/admin/warehouses/${id}`,
      );
    },
  );
}
