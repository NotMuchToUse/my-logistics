import { z } from "zod";
import type {
  ApiErrorCode,
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "../../../types/api.types.ts";
import {
  DEFAULT_PAGE_SIZE,
  INT_UNSIGNED_MAX,
  MAX_PAGE_SIZE,
} from "../constants/ops-config.constants.ts";
import {
  branchRoutingRuleSchema,
  slaDeadlineSchema,
  thirdPartyPartnerSchema,
  vehicleSchema,
} from "../schemas/ops-config.schema.ts";
import type {
  BranchRoutingRule,
  BranchRoutingRulePayload,
  DatabaseId,
  DriverLookupRecord,
  OpsConfigFilters,
  OpsConfigListParams,
  OpsConfigLookups,
  SlaDeadline,
  SlaDeadlinePayload,
  ThirdPartyPartner,
  ThirdPartyPartnerPayload,
  Vehicle,
  VehiclePayload,
} from "../types/ops-config.types.ts";

export interface OpsConfigMockSeed {
  sla_deadlines: SlaDeadline[];
  routing_rules: BranchRoutingRule[];
  partners: ThirdPartyPartner[];
  vehicles: Vehicle[];
  drivers: DriverLookupRecord[];
}

const fixtureIdSchema = z.union([
  z.number().int().positive().safe(),
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .refine(
      (value) => BigInt(value) <= 18_446_744_073_709_551_615n,
    ),
]);
const fixtureActiveSchema = z.union([z.literal(0), z.literal(1)]);
const timestampSchema = z.string().datetime();
const timestampedFixtureShape = {
  id: fixtureIdSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
};

export const opsConfigMockSeedSchema = z
  .object({
    sla_deadlines: z.array(
      z
        .object({
          ...timestampedFixtureShape,
          service_type_id: fixtureIdSchema,
          route_scope: z.enum([
            "intra_province",
            "intra_region",
            "inter_region",
            "remote_area",
          ]),
          pickup_sla_minutes: z.number().int().positive().max(INT_UNSIGNED_MAX),
          warehouse_inbound_sla_minutes: z
            .number()
            .int()
            .positive()
            .max(INT_UNSIGNED_MAX),
          linehaul_sla_hours: z
            .number()
            .int()
            .positive()
            .max(INT_UNSIGNED_MAX),
          delivery_sla_hours: z
            .number()
            .int()
            .positive()
            .max(INT_UNSIGNED_MAX),
          max_storage_days_before_return: z
            .number()
            .int()
            .positive()
            .max(INT_UNSIGNED_MAX),
          is_active: fixtureActiveSchema,
        })
        .strict(),
    ),
    routing_rules: z.array(
      z
        .object({
          ...timestampedFixtureShape,
          origin_warehouse_id: fixtureIdSchema,
          destination_branch_id: fixtureIdSchema,
          next_hop_warehouse_id: fixtureIdSchema,
          transport_mode: z.enum(["motorbike", "truck", "air_cargo"]),
          estimated_transit_hours: z
            .number()
            .int()
            .positive()
            .max(INT_UNSIGNED_MAX),
          is_active: fixtureActiveSchema,
        })
        .strict(),
    ),
    partners: z.array(
      z
        .object({
          ...timestampedFixtureShape,
          code: z.string().min(1).max(30),
          name: z.string().min(1).max(150),
          partner_type: z.enum([
            "linehaul_carrier",
            "airline_agent",
            "lastmile_3pl",
          ]),
          contact_person: z.string().max(100).nullable(),
          contact_phone: z.string().max(20).nullable(),
          api_endpoint: z.string().max(255).nullable(),
          is_active: fixtureActiveSchema,
        })
        .strict(),
    ),
    vehicles: z.array(
      z
        .object({
          ...timestampedFixtureShape,
          branch_id: fixtureIdSchema,
          partner_id: fixtureIdSchema.nullable(),
          plate_number: z.string().min(1).max(25),
          vehicle_type: z.enum([
            "motorbike",
            "van",
            "truck_light",
            "truck_heavy",
            "air_flight",
          ]),
          max_payload_kg: z.string().regex(/^(?:0|[1-9]\d{0,7})\.\d{2}$/),
          default_driver_id: fixtureIdSchema.nullable(),
          status: z.enum([
            "available",
            "in_transit",
            "maintenance",
            "retired",
          ]),
        })
        .strict(),
    ),
    drivers: z.array(
      z
        .object({
          id: fixtureIdSchema,
          full_name: z.string().min(1),
          roles: z.array(z.string()),
          status: z.string(),
          is_active: fixtureActiveSchema,
        })
        .strict(),
    ),
  })
  .strict();

export function parseOpsConfigMockSeed(input: unknown): OpsConfigMockSeed {
  return opsConfigMockSeedSchema.parse(input);
}

export interface OpsConfigMockService {
  listSlaDeadlines(
    params?: Partial<OpsConfigListParams>,
  ): Promise<ApiPaginationResponse<SlaDeadline>>;
  createSlaDeadline(
    payload: unknown,
  ): Promise<ApiSuccessResponse<SlaDeadline>>;
  updateSlaDeadline(
    id: DatabaseId,
    payload: unknown,
  ): Promise<ApiSuccessResponse<SlaDeadline>>;
  listRoutingRules(
    params?: Partial<OpsConfigListParams>,
  ): Promise<ApiPaginationResponse<BranchRoutingRule>>;
  createRoutingRule(
    payload: unknown,
  ): Promise<ApiSuccessResponse<BranchRoutingRule>>;
  updateRoutingRule(
    id: DatabaseId,
    payload: unknown,
  ): Promise<ApiSuccessResponse<BranchRoutingRule>>;
  listPartners(
    params?: Partial<OpsConfigListParams>,
  ): Promise<ApiPaginationResponse<ThirdPartyPartner>>;
  createPartner(
    payload: unknown,
  ): Promise<ApiSuccessResponse<ThirdPartyPartner>>;
  updatePartner(
    id: DatabaseId,
    payload: unknown,
  ): Promise<ApiSuccessResponse<ThirdPartyPartner>>;
  listVehicles(
    params?: Partial<OpsConfigListParams>,
  ): Promise<ApiPaginationResponse<Vehicle>>;
  createVehicle(payload: unknown): Promise<ApiSuccessResponse<Vehicle>>;
  updateVehicle(
    id: DatabaseId,
    payload: unknown,
  ): Promise<ApiSuccessResponse<Vehicle>>;
  getPartnerLookups(): OpsConfigLookups["partners"];
  getDriverLookups(): DriverLookupRecord[];
  snapshot(): OpsConfigMockSeed;
}

export class OpsConfigMockError extends Error {
  readonly response: {
    success: false;
    error: {
      code: ApiErrorCode;
      message: string;
      details?: Record<string, string[]>;
    };
  };

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "OpsConfigMockError";
    this.response = {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    };
  }
}

const active = (value: number | boolean) => value === 1 || value === true;
const idKey = (value: DatabaseId) => String(value);
const normalizedText = (value: string) => value.trim().toLocaleLowerCase("vi");

function cloneSeed(seed: OpsConfigMockSeed): OpsConfigMockSeed {
  return {
    sla_deadlines: seed.sla_deadlines.map((row) => ({ ...row })),
    routing_rules: seed.routing_rules.map((row) => ({ ...row })),
    partners: seed.partners.map((row) => ({ ...row })),
    vehicles: seed.vehicles.map((row) => ({ ...row })),
    drivers: seed.drivers.map((row) => ({ ...row, roles: [...row.roles] })),
  };
}

function fail(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string[]>,
): never {
  throw new OpsConfigMockError(code, message, details);
}

function parsePayload<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  const details: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.length ? issue.path.join(".") : "payload";
    details[field] = [...(details[field] ?? []), issue.message];
  }
  return fail(
    "422_VALIDATION_ERROR",
    "Dữ liệu cấu hình không hợp lệ.",
    details,
  );
}

function validateListParams(params: Partial<OpsConfigListParams>) {
  const page = params.page ?? 1;
  const perPage = params.per_page ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(page) || page < 1) {
    return fail("400_BAD_REQUEST", "Trang phải là số nguyên dương.");
  }
  if (
    !Number.isSafeInteger(perPage) ||
    perPage < 1 ||
    perPage > MAX_PAGE_SIZE
  ) {
    return fail(
      "400_BAD_REQUEST",
      `Số dòng mỗi trang phải từ 1 đến ${MAX_PAGE_SIZE}.`,
    );
  }
  return { page, perPage };
}

function isAbortError(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Request was aborted.", "AbortError");
  }
}

function wait(signal?: AbortSignal): Promise<void> {
  isAbortError(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 250);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Request was aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function matchesFilter(value: unknown, filter: string | undefined): boolean {
  return filter === undefined || String(value) === filter;
}

function pagination<T>(
  rows: T[],
  params: Partial<OpsConfigListParams>,
  message: string,
): ApiPaginationResponse<T> {
  const { page, perPage } = validateListParams(params);
  const total = rows.length;
  const offset = (page - 1) * perPage;
  return {
    success: true,
    message,
    data: rows.slice(offset, offset + perPage).map((row) => ({ ...row })),
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    },
  };
}

function success<T>(data: T, message: string): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}

function nextId(rows: Array<{ id: DatabaseId }>): string {
  let max = 0n;
  for (const row of rows) {
    if (/^\d+$/.test(String(row.id))) {
      const current = BigInt(String(row.id));
      if (current > max) max = current;
    }
  }
  return (max + 1n).toString();
}

function ensureReference<T extends { id: DatabaseId; is_active: number | boolean }>(
  rows: T[],
  id: DatabaseId,
  currentId: DatabaseId | null,
  label: string,
): void {
  const item = rows.find((row) => idKey(row.id) === idKey(id));
  if (!item) {
    fail("422_VALIDATION_ERROR", "Dữ liệu tham chiếu không hợp lệ.", {
      [label]: ["Bản ghi tham chiếu không tồn tại."],
    });
  }
  if (!active(item.is_active) && idKey(id) !== idKey(currentId ?? "")) {
    fail("422_VALIDATION_ERROR", "Dữ liệu tham chiếu không hợp lệ.", {
      [label]: ["Không thể chọn bản ghi đã ngừng hoạt động."],
    });
  }
}

function assertUnique<T extends { id: DatabaseId }>(
  rows: T[],
  currentId: DatabaseId | null,
  key: (row: T) => string,
  candidate: string,
  field: string,
  message: string,
): void {
  const duplicate = rows.some(
    (row) =>
      idKey(row.id) !== idKey(currentId ?? "") &&
      key(row) === candidate,
  );
  if (duplicate) {
    fail("422_VALIDATION_ERROR", "Dữ liệu cấu hình không hợp lệ.", {
      [field]: [message],
    });
  }
}

export function createOpsConfigMockService(
  seed: OpsConfigMockSeed,
  getLookups: () => Promise<OpsConfigLookups>,
): OpsConfigMockService {
  const state = cloneSeed(seed);

  const list = async <T>(
    source: T[],
    params: Partial<OpsConfigListParams>,
    message: string,
    searchable: (row: T) => string,
    filter: (row: T, filters: OpsConfigFilters) => boolean,
  ): Promise<ApiPaginationResponse<T>> => {
    await wait(params.signal);
    const filters = params.filters ?? {};
    const search = normalizedText(params.search ?? "");
    const rows = source.filter(
      (row) =>
        (!search || normalizedText(searchable(row)).includes(search)) &&
        filter(row, filters),
    );
    return pagination(rows, params, message);
  };

  const timestamp = () => new Date().toISOString();

  return {
    async listSlaDeadlines(params = {}) {
      return list(
        state.sla_deadlines,
        params,
        "Lấy danh sách SLA thành công.",
        (row) => `${row.service_type_id} ${row.route_scope}`,
        (row, filters) =>
          matchesFilter(row.service_type_id, filters.service_type_id) &&
          matchesFilter(row.route_scope, filters.route_scope) &&
          matchesFilter(row.is_active, filters.is_active),
      );
    },
    async createSlaDeadline(input) {
      const payload = parsePayload<SlaDeadlinePayload>(slaDeadlineSchema, input);
      const lookups = await getLookups();
      ensureReference(
        lookups.service_types,
        payload.service_type_id,
        null,
        "service_type_id",
      );
      assertUnique(
        state.sla_deadlines,
        null,
        (row) => `${idKey(row.service_type_id)}:${row.route_scope}`,
        `${idKey(payload.service_type_id)}:${payload.route_scope}`,
        "route_scope",
        "Dịch vụ đã có cấu hình SLA cho phạm vi tuyến này.",
      );
      const now = timestamp();
      const record: SlaDeadline = {
        ...payload,
        id: nextId(state.sla_deadlines),
        created_at: now,
        updated_at: now,
      };
      state.sla_deadlines.push(record);
      return success({ ...record }, "Tạo cấu hình SLA thành công.");
    },
    async updateSlaDeadline(id, input) {
      const current = state.sla_deadlines.find((row) => idKey(row.id) === idKey(id));
      if (!current) return fail("404_NOT_FOUND", "Không tìm thấy cấu hình SLA.");
      const payload = parsePayload<SlaDeadlinePayload>(slaDeadlineSchema, input);
      const lookups = await getLookups();
      ensureReference(
        lookups.service_types,
        payload.service_type_id,
        current.service_type_id,
        "service_type_id",
      );
      assertUnique(
        state.sla_deadlines,
        id,
        (row) => `${idKey(row.service_type_id)}:${row.route_scope}`,
        `${idKey(payload.service_type_id)}:${payload.route_scope}`,
        "route_scope",
        "Dịch vụ đã có cấu hình SLA cho phạm vi tuyến này.",
      );
      const updated = { ...current, ...payload, updated_at: timestamp() };
      state.sla_deadlines[state.sla_deadlines.indexOf(current)] = updated;
      return success({ ...updated }, "Cập nhật cấu hình SLA thành công.");
    },
    async listRoutingRules(params = {}) {
      return list(
        state.routing_rules,
        params,
        "Lấy danh sách quy tắc định tuyến thành công.",
        (row) =>
          `${row.origin_warehouse_id} ${row.destination_branch_id} ${row.next_hop_warehouse_id} ${row.transport_mode}`,
        (row, filters) =>
          matchesFilter(row.origin_warehouse_id, filters.origin_warehouse_id) &&
          matchesFilter(
            row.destination_branch_id,
            filters.destination_branch_id,
          ) &&
          matchesFilter(row.transport_mode, filters.transport_mode) &&
          matchesFilter(row.is_active, filters.is_active),
      );
    },
    async createRoutingRule(input) {
      const payload = parsePayload<BranchRoutingRulePayload>(
        branchRoutingRuleSchema,
        input,
      );
      const lookups = await getLookups();
      ensureReference(
        lookups.warehouses,
        payload.origin_warehouse_id,
        null,
        "origin_warehouse_id",
      );
      ensureReference(
        lookups.branches,
        payload.destination_branch_id,
        null,
        "destination_branch_id",
      );
      ensureReference(
        lookups.warehouses,
        payload.next_hop_warehouse_id,
        null,
        "next_hop_warehouse_id",
      );
      assertUnique(
        state.routing_rules,
        null,
        (row) =>
          `${idKey(row.origin_warehouse_id)}:${idKey(row.destination_branch_id)}`,
        `${idKey(payload.origin_warehouse_id)}:${idKey(payload.destination_branch_id)}`,
        "destination_branch_id",
        "Kho xuất phát đã có tuyến đến chi nhánh này.",
      );
      const now = timestamp();
      const record: BranchRoutingRule = {
        ...payload,
        id: nextId(state.routing_rules),
        created_at: now,
        updated_at: now,
      };
      state.routing_rules.push(record);
      return success({ ...record }, "Tạo quy tắc định tuyến thành công.");
    },
    async updateRoutingRule(id, input) {
      const current = state.routing_rules.find(
        (row) => idKey(row.id) === idKey(id),
      );
      if (!current) {
        return fail("404_NOT_FOUND", "Không tìm thấy quy tắc định tuyến.");
      }
      const payload = parsePayload<BranchRoutingRulePayload>(
        branchRoutingRuleSchema,
        input,
      );
      const lookups = await getLookups();
      ensureReference(
        lookups.warehouses,
        payload.origin_warehouse_id,
        current.origin_warehouse_id,
        "origin_warehouse_id",
      );
      ensureReference(
        lookups.branches,
        payload.destination_branch_id,
        current.destination_branch_id,
        "destination_branch_id",
      );
      ensureReference(
        lookups.warehouses,
        payload.next_hop_warehouse_id,
        current.next_hop_warehouse_id,
        "next_hop_warehouse_id",
      );
      assertUnique(
        state.routing_rules,
        id,
        (row) =>
          `${idKey(row.origin_warehouse_id)}:${idKey(row.destination_branch_id)}`,
        `${idKey(payload.origin_warehouse_id)}:${idKey(payload.destination_branch_id)}`,
        "destination_branch_id",
        "Kho xuất phát đã có tuyến đến chi nhánh này.",
      );
      const updated = { ...current, ...payload, updated_at: timestamp() };
      state.routing_rules[state.routing_rules.indexOf(current)] = updated;
      return success({ ...updated }, "Cập nhật quy tắc định tuyến thành công.");
    },
    async listPartners(params = {}) {
      return list(
        state.partners,
        params,
        "Lấy danh sách đối tác thành công.",
        (row) => `${row.code} ${row.name}`,
        (row, filters) =>
          matchesFilter(row.partner_type, filters.partner_type) &&
          matchesFilter(row.is_active, filters.is_active),
      );
    },
    async createPartner(input) {
      const payload = parsePayload<ThirdPartyPartnerPayload>(
        thirdPartyPartnerSchema,
        input,
      );
      assertUnique(
        state.partners,
        null,
        (row) => normalizedText(row.code),
        normalizedText(payload.code),
        "code",
        "Mã đối tác đã tồn tại.",
      );
      const now = timestamp();
      const record: ThirdPartyPartner = {
        ...payload,
        id: nextId(state.partners),
        created_at: now,
        updated_at: now,
      };
      state.partners.push(record);
      return success({ ...record }, "Tạo đối tác thành công.");
    },
    async updatePartner(id, input) {
      const current = state.partners.find((row) => idKey(row.id) === idKey(id));
      if (!current) return fail("404_NOT_FOUND", "Không tìm thấy đối tác.");
      const payload = parsePayload<ThirdPartyPartnerPayload>(
        thirdPartyPartnerSchema,
        input,
      );
      assertUnique(
        state.partners,
        id,
        (row) => normalizedText(row.code),
        normalizedText(payload.code),
        "code",
        "Mã đối tác đã tồn tại.",
      );
      const updated = { ...current, ...payload, updated_at: timestamp() };
      state.partners[state.partners.indexOf(current)] = updated;
      return success({ ...updated }, "Cập nhật đối tác thành công.");
    },
    async listVehicles(params = {}) {
      return list(
        state.vehicles,
        params,
        "Lấy danh sách phương tiện thành công.",
        (row) => row.plate_number,
        (row, filters) =>
          matchesFilter(row.vehicle_type, filters.vehicle_type) &&
          matchesFilter(row.branch_id, filters.branch_id) &&
          matchesFilter(row.partner_id, filters.partner_id) &&
          matchesFilter(row.status, filters.status),
      );
    },
    async createVehicle(input) {
      const payload = parsePayload<VehiclePayload>(vehicleSchema, input);
      const lookups = await getLookups();
      ensureReference(lookups.branches, payload.branch_id, null, "branch_id");
      if (payload.partner_id !== null) {
        ensureReference(
          lookups.partners,
          payload.partner_id,
          null,
          "partner_id",
        );
      }
      if (payload.default_driver_id !== null) {
        const driverId = payload.default_driver_id;
        const driver = lookups.drivers.find(
          (item) => idKey(item.id) === idKey(driverId),
        );
        if (
          !driver ||
          !active(driver.is_active) ||
          driver.status !== "active" ||
          !driver.roles.some((role) =>
            ["pickup_delivery_driver", "linehaul_driver"].includes(role),
          )
        ) {
          return fail("422_VALIDATION_ERROR", "Tài xế mặc định không hợp lệ.", {
            default_driver_id: ["Chọn tài xế đang hoạt động từ danh mục."],
          });
        }
      }
      assertUnique(
        state.vehicles,
        null,
        (row) => normalizedText(row.plate_number),
        normalizedText(payload.plate_number),
        "plate_number",
        "Biển số hoặc mã hiệu phương tiện đã tồn tại.",
      );
      const now = timestamp();
      const record: Vehicle = {
        ...payload,
        id: nextId(state.vehicles),
        created_at: now,
        updated_at: now,
      };
      state.vehicles.push(record);
      return success({ ...record }, "Tạo phương tiện thành công.");
    },
    async updateVehicle(id, input) {
      const current = state.vehicles.find((row) => idKey(row.id) === idKey(id));
      if (!current) return fail("404_NOT_FOUND", "Không tìm thấy phương tiện.");
      const payload = parsePayload<VehiclePayload>(vehicleSchema, input);
      const lookups = await getLookups();
      ensureReference(
        lookups.branches,
        payload.branch_id,
        current.branch_id,
        "branch_id",
      );
      if (payload.partner_id !== null) {
        ensureReference(
          lookups.partners,
          payload.partner_id,
          current.partner_id,
          "partner_id",
        );
      }
      if (payload.default_driver_id !== null) {
        const driverId = payload.default_driver_id;
        const driver = lookups.drivers.find(
          (item) => idKey(item.id) === idKey(driverId),
        );
        const unchanged = idKey(driverId) ===
          idKey(current.default_driver_id ?? "");
        const validRole = driver?.roles.some((role) =>
          ["pickup_delivery_driver", "linehaul_driver"].includes(role),
        );
        if (
          !driver ||
          !validRole ||
          ((!active(driver.is_active) || driver.status !== "active") &&
            !unchanged)
        ) {
          return fail("422_VALIDATION_ERROR", "Tài xế mặc định không hợp lệ.", {
            default_driver_id: ["Chọn tài xế đang hoạt động từ danh mục."],
          });
        }
      }
      assertUnique(
        state.vehicles,
        id,
        (row) => normalizedText(row.plate_number),
        normalizedText(payload.plate_number),
        "plate_number",
        "Biển số hoặc mã hiệu phương tiện đã tồn tại.",
      );
      const updated = { ...current, ...payload, updated_at: timestamp() };
      state.vehicles[state.vehicles.indexOf(current)] = updated;
      return success({ ...updated }, "Cập nhật phương tiện thành công.");
    },
    getPartnerLookups() {
      return state.partners.map(({ id, code, name, is_active }) => ({
        id,
        code,
        name,
        is_active,
      }));
    },
    getDriverLookups() {
      return state.drivers.map((driver) => ({ ...driver, roles: [...driver.roles] }));
    },
    snapshot() {
      return cloneSeed(state);
    },
  };
}
