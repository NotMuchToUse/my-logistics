import { toast } from "sonner";
import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import type { ApiSuccessResponse } from "@/types/api.types";
import type { ShipmentDetail } from "../types/shipment-detail.types";

function createMockShipment(publicId: string): ShipmentDetail {
  return {
    id: 1,
    public_id: publicId,
    status: "in_transit",
    service_name: "Chuyển phát tiêu chuẩn",
    created_at: "2026-11-20T08:30:00+07:00",
    sender: {
      full_name: "Nguyễn Văn An",
      phone_masked: "09*****123",
      address_line: "12 Nguyễn Huệ",
      ward_name: "Bến Nghé",
      district_name: "Quận 1",
      province_name: "TP. Hồ Chí Minh",
    },
    receiver: {
      full_name: "Trần Thị Bình",
      phone_masked: "09*****456",
      address_line: "45 Lê Lợi",
      ward_name: "Hàng Trống",
      district_name: "Hoàn Kiếm",
      province_name: "Hà Nội",
    },
    shipment_parcels: [
      {
        id: "parcel-1",
        parcel_code: "PK-001",
        description: "Hàng dễ vỡ",
        length_cm: 30,
        width_cm: 20,
        height_cm: 15,
        actual_weight_kg: 2.4,
        volumetric_weight_kg: 1.8,
        chargeable_weight_kg: 2.4,
      },
    ],
    shipment_vas: [{ id: "vas-1", vas_name: "Bảo hiểm hàng hóa", amount: 15000 }],
    shipment_surcharges: [
      { id: "surcharge-1", surcharge_name: "Phụ phí vùng xa", amount: 10000 },
    ],
    base_shipping_fee: 45000,
    cod_amount: 250000,
    cod_fee: 5000,
    shipment_status_history: [
      {
        id: "history-1",
        status: "picked_up",
        description: "Bưu tá đã lấy hàng",
        occurred_at: "2026-11-20T09:00:00+07:00",
        location_name: "Bưu cục Quận 1",
        visibility: "public",
      },
      {
        id: "history-2",
        status: "in_transit",
        description: "Hàng đã rời trung tâm khai thác",
        occurred_at: "2026-11-21T02:15:00+07:00",
        location_name: "Trung tâm khai thác TP. Hồ Chí Minh",
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
}

export async function getShipmentDetail(
  publicId: string,
): Promise<ShipmentDetail> {
  const mock = () => createMockShipment(publicId);

  if (USE_MOCK) {
    return mock();
  }

  try {
    const response = await axiosClient.get<ApiSuccessResponse<ShipmentDetail>>(
      `/api/v1/shipments/${encodeURIComponent(publicId)}`,
    );
    return response.data.data;
  } catch (error) {
    if (!import.meta.env.DEV) {
      throw error;
    }

    console.warn("Không gọi được API chi tiết vận đơn; dùng dữ liệu mẫu dev.", error);
    toast.warning("Không kết nối được API vận đơn; đang dùng dữ liệu mẫu trên máy.");
    return mock();
  }
}
