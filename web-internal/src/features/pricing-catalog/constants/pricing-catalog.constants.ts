export const PRICING_CATALOG_TABS = [
  { value: "service-types", label: "Dịch vụ chính" },
  { value: "value-added-services", label: "Dịch vụ gia tăng" },
  { value: "surcharges", label: "Phụ phí" },
  { value: "tariffs-and-rules", label: "Bảng giá & Quy đổi" },
] as const;

export const FEE_TYPES = [
  { value: "fixed", label: "Cố định" },
  { value: "percentage", label: "Phần trăm" },
] as const;

export const ZONE_TYPES = [
  { value: "intra_province", label: "Nội tỉnh" },
  { value: "inter_region_near", label: "Liên vùng gần" },
  { value: "inter_region_far", label: "Liên vùng xa" },
] as const;
