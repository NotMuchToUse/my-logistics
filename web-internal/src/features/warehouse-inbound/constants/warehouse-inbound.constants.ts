// Giá trị UI theo TASK, chưa phải enum Backend đã được xác minh.
export const WAREHOUSE_INBOUND_OPTIONS = [
  { value: "new_pickup", label: "Hàng mới lấy" },
  { value: "linehaul_in", label: "Hàng trung chuyển" },
  { value: "redelivery", label: "Hàng giao lại" },
  { value: "counter_created", label: "Hàng tạo tại quầy" },
] as const;
