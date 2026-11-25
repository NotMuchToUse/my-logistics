import type { PickupRequestStatus } from "@/types/api.types";
import type {
  BranchOption,
  DriverOption,
  GeoOption,
  PickupMode,
} from "../types/pickup-dispatch.types";

export const SLA_WARNING_MINUTES = 30;

export const PICKUP_STATUS_META: Record<
  PickupRequestStatus,
  {
    label: string;
    badgeClass: string;
  }
> = {
  pending: {
    label: "Chờ phân công",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
  },
  assigned: {
    label: "Đã phân công",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  accepted: {
    label: "Tài xế đang đến",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300",
  },
  picked_up: {
    label: "Đã lấy hàng",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  pickup_failed: {
    label: "Lấy thất bại",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
  },
  cancelled: {
    label: "Đã hủy",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-300",
  },
};

export const PICKUP_MODE_LABELS: Record<PickupMode, string> = {
  driver_pickup: "Tài xế đến lấy",
  counter_dropoff: "Khách mang ra bưu cục",
};

export const QUICK_CANCEL_REASONS: readonly string[] = [
  "Khách hàng liên hệ hủy yêu cầu lấy hàng",
  "Khách mang hàng trực tiếp ra bưu cục gửi",
  "Sai địa chỉ hoặc ngoài phạm vi phục vụ của bưu cục",
  "Trùng lặp yêu cầu lấy hàng đã tạo trước đó",
];

export const FALLBACK_BRANCHES: readonly BranchOption[] = [
  { id: 1, code: "HQ-HCM", name: "Tổng công ty TP.HCM", province_id: 79, district_id: 760 },
  { id: 3, code: "BC-HC1", name: "Bưu cục Hải Châu 1 - Đà Nẵng", province_id: 48, district_id: 490 },
  { id: 4, code: "BC-ST1", name: "Bưu cục Sơn Trà - Đà Nẵng", province_id: 48, district_id: 493 },
  { id: 5, code: "BC-BD1", name: "Bưu cục Ba Đình - Hà Nội", province_id: 1, district_id: 1 },
];

export const FALLBACK_DRIVERS: readonly DriverOption[] = [
  {
    id: 201,
    public_id: "01JDC9X8K2M4N6P8Q0R2S4DRV1",
    employee_code: "TX001",
    full_name: "Nguyễn Văn Hùng",
    phone_masked: "090***1101",
    branch_id: 3,
    active_pickup_count: 1,
  },
  {
    id: 202,
    public_id: "01JDC9X8K2M4N6P8Q0R2S4DRV2",
    employee_code: "TX002",
    full_name: "Trần Minh Tuấn",
    phone_masked: "091***2202",
    branch_id: 3,
    active_pickup_count: 2,
  },
  {
    id: 203,
    public_id: "01JDC9X8K2M4N6P8Q0R2S4DRV3",
    employee_code: "TX003",
    full_name: "Phạm Hoàng Long",
    phone_masked: "093***3303",
    branch_id: 5,
    active_pickup_count: 0,
  },
  {
    id: 204,
    public_id: "01JDC9X8K2M4N6P8Q0R2S4DRV4",
    employee_code: "TX004",
    full_name: "Lê Quốc Khánh",
    phone_masked: "098***4404",
    branch_id: 4,
    active_pickup_count: 1,
  },
];

export const FALLBACK_PROVINCES: readonly GeoOption[] = [
  { id: 48, name: "Thành phố Đà Nẵng" },
  { id: 79, name: "Thành phố Hồ Chí Minh" },
  { id: 1, name: "Thành phố Hà Nội" },
  { id: 92, name: "Thành phố Cần Thơ" },
];

export const FALLBACK_DISTRICTS: Record<number, readonly GeoOption[]> = {
  48: [
    { id: 490, name: "Quận Hải Châu" },
    { id: 493, name: "Quận Sơn Trà" },
    { id: 492, name: "Quận Thanh Khê" },
  ],
  79: [
    { id: 760, name: "Quận 1" },
    { id: 769, name: "Thành phố Thủ Đức" },
  ],
  1: [
    { id: 1, name: "Quận Ba Đình" },
    { id: 2, name: "Quận Hoàn Kiếm" },
  ],
  92: [
    { id: 916, name: "Quận Ninh Kiều" },
    { id: 918, name: "Quận Bình Thủy" },
  ],
};

export const FALLBACK_WARDS: Record<number, readonly GeoOption[]> = {
  490: [
    { id: 20194, name: "Phường Hải Châu I" },
    { id: 20195, name: "Phường Hải Châu II" },
  ],
  493: [
    { id: 20200, name: "Phường An Hải Bắc" },
    { id: 20203, name: "Phường Phước Mỹ" },
  ],
  492: [{ id: 20210, name: "Phường Chính Gián" }],
  760: [{ id: 26734, name: "Phường Bến Nghé" }],
  769: [{ id: 26815, name: "Phường Linh Trung" }],
  1: [{ id: 1, name: "Phường Phúc Xá" }],
  2: [{ id: 40, name: "Phường Hàng Trống" }],
  916: [{ id: 31117, name: "Phường Xuân Khánh" }],
  918: [{ id: 31150, name: "Phường Bình Thủy" }],
};