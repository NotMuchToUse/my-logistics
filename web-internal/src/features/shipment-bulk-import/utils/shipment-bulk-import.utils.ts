import {
  SHIPMENT_IMPORT_COLUMN_KEYS,
  SHIPMENT_IMPORT_COLUMNS,
  SHIPMENT_IMPORT_TEMPLATE_FILENAME,
} from "../constants/shipment-bulk-import.constants";
import {
  getShipmentImportColumnKey,
  shipmentBulkImportRowSchema,
  type ShipmentImportPreviewRow,
} from "../schemas/shipment-bulk-import.schema";

const EMPTY_CELL = "";

function cellValue(value: unknown): string {
  if (value === undefined || value === null) return EMPTY_CELL;
  return String(value).trim();
}

export async function readShipmentImportFile(
  file: File,
): Promise<ShipmentImportPreviewRow[]> {
  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    throw new Error("Chỉ hỗ trợ tệp .xlsx hoặc .csv.");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Tệp không có trang tính để đọc.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: EMPTY_CELL,
    raw: false,
    blankrows: true,
  });
  const headerRow = matrix[0];
  if (!headerRow) {
    throw new Error("Tệp không có dòng tiêu đề.");
  }

  const headers = headerRow.map((value) =>
    cellValue(value).replace(/^\uFEFF/, "").toLowerCase(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => header !== EMPTY_CELL && headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    throw new Error(`Tiêu đề bị trùng: ${[...new Set(duplicateHeaders)].join(", ")}.`);
  }

  const missingHeaders = SHIPMENT_IMPORT_COLUMN_KEYS.filter(
    (key) => !headers.includes(key),
  );
  if (missingHeaders.length > 0) {
    throw new Error(`Thiếu cột bắt buộc: ${missingHeaders.join(", ")}.`);
  }

  const columnIndexes = new Map(
    headers.map((header, index) => [header, index]),
  );
  const inputRows = matrix.slice(1).flatMap((values, index) => {
    const cells = Object.fromEntries(
      SHIPMENT_IMPORT_COLUMNS.map(({ key }) => [
        key,
        cellValue(values[columnIndexes.get(key) ?? -1]),
      ]),
    ) as ShipmentImportPreviewRow["cells"];
    if (Object.values(cells).every((value) => value === EMPTY_CELL)) return [];

    const parsed = shipmentBulkImportRowSchema.safeParse(cells);

    const clientErrors = parsed.success
      ? []
      : parsed.error.issues.map((issue) => {
          const field = issue.path.map(String).join(".");
          return {
            field,
            columnKey: getShipmentImportColumnKey(field),
            message: issue.message,
          };
        });

    return [
      {
        rowNumber: index + 2,
        cells,
        payload: parsed.success ? parsed.data : null,
        clientErrors,
        apiErrors: [],
      },
    ];
  });

  if (inputRows.length === 0) {
    throw new Error("Tệp chưa có dòng dữ liệu vận đơn.");
  }

  return inputRows;
}

export async function downloadShipmentImportTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const templateWorkbook = XLSX.utils.book_new();
  const importSheet = XLSX.utils.aoa_to_sheet([
    SHIPMENT_IMPORT_COLUMNS.map(({ key }) => key),
  ]);
  importSheet["!cols"] = SHIPMENT_IMPORT_COLUMNS.map(({ key }) => ({
    wch: Math.max(key.length + 2, 20),
  }));
  XLSX.utils.book_append_sheet(templateWorkbook, importSheet, "Import");

  const guideSheet = XLSX.utils.aoa_to_sheet([
    ["Hướng dẫn nhập vận đơn"],
    ["Mỗi dòng dữ liệu tương ứng một vận đơn; không đổi tên các cột ở sheet Import."],
    ["payment_method: ngttn, ngtts hoặc nntn."],
    ["creation_mode: counter_dropoff hoặc driver_pickup."],
    [
      "parcels_json: mảng JSON; ví dụ: [{\"actual_weight_gram\":1000,\"length_cm\":\"20\",\"width_cm\":\"15\",\"height_cm\":\"10\",\"description\":\"Hàng hóa\"}]",
    ],
    ["vas_ids và surcharge_ids: danh sách mã số, phân cách bằng dấu phẩy; có thể để trống."],
    ["Các mã tỉnh/huyện/xã, chi nhánh, dịch vụ và loại hàng phải là ID hợp lệ."],
    ["Số tiền và kích thước dùng dấu chấm cho phần thập phân."],
  ]);
  guideSheet["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(templateWorkbook, guideSheet, "Hướng dẫn");
  XLSX.writeFile(
    templateWorkbook,
    SHIPMENT_IMPORT_TEMPLATE_FILENAME,
    { compression: true },
  );
}
