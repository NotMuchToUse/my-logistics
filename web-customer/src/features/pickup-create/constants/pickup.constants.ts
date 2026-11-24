export const PICKUP_MODES = [
  { value: "driver_pickup", label: "Tài xế đến lấy hàng", description: "Chọn địa chỉ gửi đã lưu của bạn." },
  { value: "counter_dropoff", label: "Mang hàng ra bưu cục", description: "Chọn điểm nhận hàng trên bản đồ hoặc danh sách." },
] as const;

export const INTEGRATION_UNAVAILABLE = "Chức năng gửi hàng chưa kết nối dịch vụ. Vui lòng thử lại sau.";
export const DEFAULT_PICKUP_VALUES = {
  handoverMode: "driver_pickup" as const,
  addressId: "",
  branchPublicId: "",
  parcelCount: 1,
  weightGram: 1000,
};
