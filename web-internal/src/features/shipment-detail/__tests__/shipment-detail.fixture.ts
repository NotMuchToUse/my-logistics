import type { ShipmentDetail } from "../types/shipment-detail.types";

export const shipmentFixture: ShipmentDetail = {
  id: 101,
  public_id: "SHIP-TEST-001",
  status: "in_transit",
  service_name: "Chuyển phát tiêu chuẩn",
  created_at: "2026-11-20T08:30:00+07:00",
  sender: {
    full_name: "Nguyễn Văn Gửi",
    phone_masked: "090*****01",
    address_line: "12 Nguyễn Huệ",
    ward_name: "Bến Nghé",
    district_name: "Quận 1",
    province_name: "TP. Hồ Chí Minh",
  },
  receiver: {
    full_name: "Trần Thị Nhận",
    phone_masked: "091*****02",
    address_line: "45 Lê Lợi",
    ward_name: "Hàng Trống",
    district_name: "Hoàn Kiếm",
    province_name: "Hà Nội",
  },
  shipment_parcels: [
    {
      id: "parcel-1",
      parcel_code: "PK-TEST-1",
      description: "Hàng mẫu",
      length_cm: 30,
      width_cm: 20,
      height_cm: 10,
      actual_weight_kg: 1.5,
      volumetric_weight_kg: 1.2,
      chargeable_weight_kg: 1.5,
    },
  ],
  shipment_vas: [
    { id: "vas-1", vas_name: "Bảo hiểm", amount: 15000 },
  ],
  shipment_surcharges: [
    { id: "surcharge-1", surcharge_name: "Phụ phí vùng xa", amount: 10000 },
  ],
  base_shipping_fee: 45000,
  cod_amount: 250000,
  cod_fee: 5000,
  shipment_status_history: [
    {
      id: "history-public",
      status: "picked_up",
      description: "Mốc công khai",
      occurred_at: "2026-11-20T09:00:00+07:00",
      visibility: "public",
    },
    {
      id: "history-internal",
      status: "in_transit",
      description: "Mốc nội bộ",
      occurred_at: "2026-11-21T02:15:00+07:00",
      visibility: "internal",
    },
  ],
  print_logs: [
    {
      id: "print-1",
      print_type: "Phiếu gửi",
      printed_at: "2026-11-20T08:32:00+07:00",
      printed_by_name: "Nhân viên quầy",
      copies: 1,
    },
  ],
};
