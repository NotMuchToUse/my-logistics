import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import pickupMock from "@/mocks/pickup.mock.json";
import type {
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "@/types/api.types";
import {
  FALLBACK_BRANCHES,
  FALLBACK_DISTRICTS,
  FALLBACK_DRIVERS,
  FALLBACK_PROVINCES,
  FALLBACK_WARDS,
} from "../constants/pickup-dispatch.constants";
import type {
  AssignDriverInput,
  BranchOption,
  CancelPickupInput,
  CreatePickupRequestInput,
  DriverOption,
  GeoOption,
  PickupDispatchFilters,
  PickupRequestItem,
} from "../types/pickup-dispatch.types";

const mockPickupStore: PickupRequestItem[] = (
  pickupMock.pagination_response.data as unknown as PickupRequestItem[]
).map((item, idx) => {
  const now = Date.now();
  const adjustedDeadline =
    idx === 0
      ? new Date(now + 18 * 60_000).toISOString()
      : idx === 4
        ? new Date(now - 25 * 60_000).toISOString()
        : item.sla_deadline_at;

  const matchedDriver = FALLBACK_DRIVERS.find(
    (d) => d.id === item.assigned_driver_id,
  );
  const matchedBranch = FALLBACK_BRANCHES.find((b) => b.id === item.branch_id);

  return {
    ...item,
    branch_code: matchedBranch?.code ?? `BC-${item.branch_id}`,
    branch_name: matchedBranch?.name ?? `Bưu cục #${item.branch_id}`,
    assigned_driver_name: matchedDriver?.full_name ?? null,
    assigned_driver_phone_masked: matchedDriver?.phone_masked ?? null,
    sla_deadline_at: adjustedDeadline,
  };
});

let mockSequence = 10;

async function runWithDevMock<T>(
  label: string,
  mockFn: () => T,
  apiFn: () => Promise<T>,
): Promise<T> {
  if (USE_MOCK) {
    return mockFn();
  }

  if (!import.meta.env.DEV) {
    return apiFn();
  }

  try {
    return await apiFn();
  } catch (error) {
    console.warn(`Fallback mock cho ${label}:`, error);
    return mockFn();
  }
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return phone;
  }
  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function normalizePickupItem(
  raw: PickupRequestItem & {
    assigned_driver?: {
      id: number;
      full_name?: string | null;
      phone_masked?: string | null;
    } | null;
  },
): PickupRequestItem {
  return {
    ...raw,
    assigned_driver_id:
      raw.assigned_driver_id ?? raw.assigned_driver?.id ?? null,
    assigned_driver_name:
      raw.assigned_driver_name ?? raw.assigned_driver?.full_name ?? null,
    assigned_driver_phone_masked:
      raw.assigned_driver_phone_masked ??
      raw.assigned_driver?.phone_masked ??
      null,
  };
}

export function getPickupRequests(
  filters: PickupDispatchFilters,
): Promise<PickupRequestItem[]> {
  return runWithDevMock(
    "danh sách yêu cầu lấy hàng",
    () => {
      return mockPickupStore
        .filter((item) => {
          if (filters.branch_id && item.branch_id !== filters.branch_id) {
            return false;
          }
          if (
            filters.status &&
            filters.status !== "all" &&
            item.status !== filters.status
          ) {
            return false;
          }
          if (filters.search && filters.search.trim() !== "") {
            const q = filters.search.trim().toLowerCase();
            const haystack = [
              item.request_code,
              item.sender_name,
              item.sender_phone_masked,
              item.pickup_address,
              item.assigned_driver_name ?? "",
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(q)) {
              return false;
            }
          }
          return true;
        })
        .map((i) => ({ ...i }));
    },
    async () => {
      const params: Record<string, string | number> = {
        page: 1,
        per_page: 100,
      };
      if (filters.branch_id) {
        params.branch_id = filters.branch_id;
      }
      if (filters.status && filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.search && filters.search.trim() !== "") {
        params.search = filters.search.trim();
      }

      const response = await axiosClient.get<
        ApiPaginationResponse<PickupRequestItem>
      >("/api/v1/pickup-requests", { params });
      return response.data.data.map(normalizePickupItem);
    },
  );
}

export function createPickupRequest(
  input: CreatePickupRequestInput,
): Promise<PickupRequestItem> {
  return runWithDevMock(
    "tạo yêu cầu lấy hàng",
    () => {
      const seq = mockSequence++;
      const now = new Date();
      const deadline = new Date(now.getTime() + 90 * 60_000);
      const branch = FALLBACK_BRANCHES.find((b) => b.id === input.branch_id);

      const created: PickupRequestItem = {
        public_id: `01JDC9X8K2M4N6P8Q0R2S4MOCK${seq}`,
        request_code: `PU26112400${seq}`,
        customer_id: null,
        branch_id: input.branch_id,
        branch_code: branch?.code ?? `BC-${input.branch_id}`,
        branch_name: branch?.name ?? `Bưu cục #${input.branch_id}`,
        pickup_mode: input.pickup_mode,
        sender_name: input.sender_name,
        sender_phone: input.sender_phone,
        sender_phone_masked: maskPhone(input.sender_phone),
        province_id: input.province_id,
        district_id: input.district_id,
        ward_id: input.ward_id,
        pickup_address: input.pickup_address,
        estimated_parcel_count: input.estimated_parcel_count,
        estimated_weight_gram: input.estimated_weight_gram,
        note: input.note?.trim() || null,
        assigned_driver_id: null,
        assigned_driver_name: null,
        assigned_driver_phone_masked: null,
        sla_deadline_at: deadline.toISOString(),
        status: "pending",
        version: 1,
        created_at: now.toISOString(),
      };

      mockPickupStore.unshift(created);
      return { ...created };
    },
    async () => {
      const response = await axiosClient.post<
        ApiSuccessResponse<PickupRequestItem>
      >("/api/v1/pickup-requests", input, {
        headers: { "X-Branch-Id": String(input.branch_id) },
      });
      return normalizePickupItem(response.data.data);
    },
  );
}

export function assignPickupDriver(
  publicId: string,
  input: AssignDriverInput,
): Promise<PickupRequestItem> {
  return runWithDevMock(
    "phân công tài xế",
    () => {
      const idx = mockPickupStore.findIndex((i) => i.public_id === publicId);
      const existing = idx >= 0 ? mockPickupStore[idx] : undefined;
      if (!existing) {
        throw new Error("Không tìm thấy yêu cầu lấy hàng.");
      }

      const branchDrivers = FALLBACK_DRIVERS.filter(
        (d) => d.branch_id === existing.branch_id,
      );
      const pool = branchDrivers.length > 0 ? branchDrivers : FALLBACK_DRIVERS;

      const chosenDriver = input.auto_assign
        ? [...pool].sort(
            (a, b) => a.active_pickup_count - b.active_pickup_count,
          )[0]
        : pool.find((d) => d.id === input.driver_id);

      if (!chosenDriver) {
        throw new Error("Không tìm thấy tài xế khả dụng thuộc bưu cục.");
      }

      const updated: PickupRequestItem = {
        ...existing,
        assigned_driver_id: chosenDriver.id,
        assigned_driver_name: chosenDriver.full_name,
        assigned_driver_phone_masked: chosenDriver.phone_masked,
        assigned_at: new Date().toISOString(),
        status: "assigned",
        version: existing.version + 1,
      };
      mockPickupStore[idx] = updated;
      return { ...updated };
    },
    async () => {
      const response = await axiosClient.patch<
        ApiSuccessResponse<PickupRequestItem>
      >(`/api/v1/pickup-requests/${encodeURIComponent(publicId)}/assign`, input);
      return normalizePickupItem(response.data.data);
    },
  );
}

export function cancelPickupRequest(
  publicId: string,
  input: CancelPickupInput,
): Promise<PickupRequestItem> {
  return runWithDevMock(
    "hủy yêu cầu lấy hàng",
    () => {
      const idx = mockPickupStore.findIndex((i) => i.public_id === publicId);
      const existing = idx >= 0 ? mockPickupStore[idx] : undefined;
      if (!existing) {
        throw new Error("Không tìm thấy yêu cầu lấy hàng.");
      }

      const updated: PickupRequestItem = {
        ...existing,
        status: "cancelled",
        cancel_reason: input.cancel_reason,
        version: existing.version + 1,
      };
      mockPickupStore[idx] = updated;
      return { ...updated };
    },
    async () => {
      const response = await axiosClient.post<
        ApiSuccessResponse<PickupRequestItem>
      >(`/api/v1/pickup-requests/${encodeURIComponent(publicId)}/cancel`, input);
      return normalizePickupItem(response.data.data);
    },
  );
}

export function getBranchDrivers(branchId: number): Promise<DriverOption[]> {
  return runWithDevMock(
    "danh sách tài xế chi nhánh",
    () => {
      const filtered = FALLBACK_DRIVERS.filter((d) => d.branch_id === branchId);
      return filtered.length > 0 ? filtered : [...FALLBACK_DRIVERS];
    },
    async () => {
      const response = await axiosClient.get<
        ApiSuccessResponse<DriverOption[]>
      >("/api/v1/pickup-requests/drivers/available", {
        headers: { "X-Branch-Id": String(branchId) },
      });
      return response.data.data.length > 0
        ? response.data.data
        : [...FALLBACK_DRIVERS];
    },
  );
}

export function getBranchOptions(): Promise<BranchOption[]> {
  return runWithDevMock(
    "danh sách bưu cục",
    () => [...FALLBACK_BRANCHES],
    async () => {
      const response = await axiosClient.get<
        ApiSuccessResponse<
          Array<{
            id?: number;
            public_id: string;
            code: string;
            name: string;
            province_id: number;
            district_id: number;
          }>
        >
      >("/api/v1/public/branches");

      if (!Array.isArray(response.data.data) || response.data.data.length === 0) {
        return [...FALLBACK_BRANCHES];
      }

      return response.data.data.map((b, idx) => ({
        id: b.id ?? idx + 1,
        code: b.code,
        name: b.name,
        province_id: b.province_id,
        district_id: b.district_id,
      }));
    },
  );
}

export function getProvinceOptions(): Promise<GeoOption[]> {
  return runWithDevMock(
    "danh sách tỉnh thành",
    () => [...FALLBACK_PROVINCES],
    async () => {
      const response = await axiosClient.get<ApiSuccessResponse<GeoOption[]>>(
        "/api/v1/public/provinces",
      );
      return response.data.data.length > 0
        ? response.data.data
        : [...FALLBACK_PROVINCES];
    },
  );
}

export function getDistrictOptions(provinceId: number): Promise<GeoOption[]> {
  return runWithDevMock(
    "danh sách quận huyện",
    () => [...(FALLBACK_DISTRICTS[provinceId] ?? [])],
    async () => {
      const response = await axiosClient.get<ApiSuccessResponse<GeoOption[]>>(
        "/api/v1/public/districts",
        { params: { province_id: provinceId } },
      );
      return response.data.data.length > 0
        ? response.data.data
        : [...(FALLBACK_DISTRICTS[provinceId] ?? [])];
    },
  );
}

export function getWardOptions(districtId: number): Promise<GeoOption[]> {
  return runWithDevMock(
    "danh sách phường xã",
    () => [...(FALLBACK_WARDS[districtId] ?? [])],
    async () => {
      const response = await axiosClient.get<ApiSuccessResponse<GeoOption[]>>(
        "/api/v1/public/wards",
        { params: { district_id: districtId } },
      );
      return response.data.data.length > 0
        ? response.data.data
        : [...(FALLBACK_WARDS[districtId] ?? [])];
    },
  );
}