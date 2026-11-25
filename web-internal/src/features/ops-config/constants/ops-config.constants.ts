import type {
  PartnerType,
  RouteScope,
  TransportMode,
  VehicleStatus,
  VehicleType,
} from "../types/ops-config.types.ts";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const INT_UNSIGNED_MAX = 4_294_967_295;
export const DECIMAL_10_2_MAX = "99999999.99";

export const ROUTE_SCOPE_OPTIONS: Array<{
  value: RouteScope;
  label: string;
}> = [
  { value: "intra_province", label: "Nội tỉnh" },
  { value: "intra_region", label: "Nội vùng" },
  { value: "inter_region", label: "Liên vùng" },
  { value: "remote_area", label: "Vùng sâu, vùng xa" },
];

export const TRANSPORT_MODE_OPTIONS: Array<{
  value: TransportMode;
  label: string;
}> = [
  { value: "motorbike", label: "Xe máy" },
  { value: "truck", label: "Xe tải" },
  { value: "air_cargo", label: "Hàng không" },
];

export const PARTNER_TYPE_OPTIONS: Array<{
  value: PartnerType;
  label: string;
}> = [
  { value: "linehaul_carrier", label: "Vận tải trung chuyển" },
  { value: "airline_agent", label: "Đại lý hàng không" },
  { value: "lastmile_3pl", label: "Giao hàng chặng cuối" },
];

export const VEHICLE_TYPE_OPTIONS: Array<{
  value: VehicleType;
  label: string;
}> = [
  { value: "motorbike", label: "Xe máy" },
  { value: "van", label: "Xe van" },
  { value: "truck_light", label: "Xe tải nhẹ" },
  { value: "truck_heavy", label: "Xe tải nặng" },
  { value: "air_flight", label: "Phương tiện/chuyến bay hàng không" },
];

export const VEHICLE_STATUS_OPTIONS: Array<{
  value: VehicleStatus;
  label: string;
}> = [
  { value: "available", label: "Sẵn sàng" },
  { value: "in_transit", label: "Đang vận chuyển" },
  { value: "maintenance", label: "Đang bảo trì" },
  { value: "retired", label: "Ngừng khai thác" },
];

export const OPS_CONFIG_TABS = [
  { value: "sla", label: "SLA Deadline" },
  { value: "routing", label: "Ma trận định tuyến" },
  { value: "partners-vehicles", label: "Đối tác 3PL & Phương tiện" },
] as const;

export const OPS_CONFIG_API_BLOCKED_MESSAGE =
  "API thật đang BLOCKED: Backend chưa xác nhận method, payload, response và permission mapping cho các nhóm CRUD cấu hình vận hành. Dữ liệu hiện tại chỉ chạy ở Mock Mode.";

export const MOCK_ONLY_NOTICE =
  "Chức năng này chỉ là MOCK ONLY; không khẳng định Backend đã hỗ trợ.";
