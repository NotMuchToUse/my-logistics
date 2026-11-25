export const SHIPMENT_IMPORT_TEMPLATE_FILENAME =
  "mau_import_van_don_chuan.xlsx";

export const SHIPMENT_IMPORT_COLUMNS = [
  { key: "sender_name", label: "Tên người gửi" },
  { key: "sender_phone", label: "Số điện thoại người gửi" },
  { key: "sender_address", label: "Địa chỉ người gửi" },
  { key: "sender_province_id", label: "Mã tỉnh người gửi" },
  { key: "sender_district_id", label: "Mã huyện người gửi" },
  { key: "sender_ward_id", label: "Mã xã người gửi" },
  { key: "recipient_name", label: "Tên người nhận" },
  { key: "recipient_phone", label: "Số điện thoại người nhận" },
  { key: "recipient_address", label: "Địa chỉ người nhận" },
  { key: "recipient_province_id", label: "Mã tỉnh người nhận" },
  { key: "recipient_district_id", label: "Mã huyện người nhận" },
  { key: "recipient_ward_id", label: "Mã xã người nhận" },
  { key: "destination_branch_id", label: "Mã chi nhánh đích" },
  { key: "service_type_id", label: "Mã dịch vụ" },
  { key: "cargo_category_id", label: "Mã loại hàng" },
  { key: "payment_method", label: "Hình thức thanh toán" },
  { key: "cod_amount", label: "Tiền thu hộ COD" },
  { key: "declared_value", label: "Giá trị khai báo" },
  { key: "creation_mode", label: "Chế độ tạo vận đơn" },
  { key: "parcels_json", label: "Danh sách kiện hàng (JSON)" },
  { key: "vas_ids", label: "Danh sách mã DVGT (phân cách bằng dấu phẩy)" },
  {
    key: "surcharge_ids",
    label: "Danh sách mã phụ phí (phân cách bằng dấu phẩy)",
  },
] as const;

export type ShipmentImportColumnKey =
  (typeof SHIPMENT_IMPORT_COLUMNS)[number]["key"];

export const SHIPMENT_IMPORT_COLUMN_KEYS = SHIPMENT_IMPORT_COLUMNS.map(
  (column) => column.key,
);
