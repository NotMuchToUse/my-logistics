import { buildShipmentListQuery } from "../hooks/shipment-list.hook-logic.ts";
import type {
  ShipmentListRequestScope,
  ShipmentListApiQuery,
} from "../api/shipment-list.service";
import type {
  ShipmentFilterValues,
  ShipmentListItem,
  ShipmentListResponse,
  ShipmentSortField,
  SortDirection,
} from "../types/shipment-list.types";
import {
  SHIPMENT_LIST_PERMISSIONS,
  SHIPMENT_STATUS_LABELS,
} from "../constants/shipment-list.constants.ts";

export const SHIPMENT_EXPORT_PAGE_SIZE = 100;
export const SHIPMENT_EXPORT_MAX_ROWS = 5000;
export const SHIPMENT_EXPORT_PERMISSION: string | null = null;

export function canExportShipmentList(
  isAuthenticated: boolean,
  permissions: readonly string[],
): boolean {
  return (
    isAuthenticated &&
    permissions.includes(SHIPMENT_LIST_PERMISSIONS.read) &&
    SHIPMENT_EXPORT_PERMISSION !== null &&
    permissions.includes(SHIPMENT_EXPORT_PERMISSION)
  );
}

export type ShipmentExportFetchPage = (
  query: ShipmentListApiQuery,
  signal: AbortSignal,
  scope: ShipmentListRequestScope,
) => Promise<ShipmentListResponse>;

export interface CollectShipmentExportOptions {
  filters: ShipmentFilterValues;
  sorting: { sortBy: ShipmentSortField; sortDirection: SortDirection };
  branchFiltersSupported: boolean;
  scope: ShipmentListRequestScope;
  signal: AbortSignal;
  isContextCurrent: () => boolean;
  fetchPage: ShipmentExportFetchPage;
}

export class ShipmentExportAbortedError extends Error {
  constructor(message = "Quá trình xuất đã bị dừng.") {
    super(message);
    this.name = "ShipmentExportAbortedError";
  }
}

export class ShipmentExportLimitError extends Error {
  constructor() {
    super(`Chỉ có thể xuất tối đa ${SHIPMENT_EXPORT_MAX_ROWS} vận đơn mỗi lần.`);
    this.name = "ShipmentExportLimitError";
  }
}

function assertExportCanContinue(
  signal: AbortSignal,
  isContextCurrent: () => boolean,
): void {
  if (signal.aborted || !isContextCurrent()) {
    throw new ShipmentExportAbortedError(
      "Đã dừng xuất vì quyền truy cập, bộ lọc hoặc Branch Scope đã thay đổi.",
    );
  }
}

export async function collectShipmentsForExport({
  filters,
  sorting,
  branchFiltersSupported,
  scope,
  signal,
  isContextCurrent,
  fetchPage,
}: CollectShipmentExportOptions): Promise<ShipmentListItem[]> {
  const rows: ShipmentListItem[] = [];
  const seenPublicIds = new Set<string>();
  let expectedTotal: number | undefined;
  let expectedTotalPages: number | undefined;

  for (let page = 1; ; page += 1) {
    assertExportCanContinue(signal, isContextCurrent);
    const query = buildShipmentListQuery(
      filters,
      page,
      SHIPMENT_EXPORT_PAGE_SIZE,
      sorting,
      branchFiltersSupported,
    );
    const response = await fetchPage(query, signal, scope);
    assertExportCanContinue(signal, isContextCurrent);

    const pagination = response.meta.pagination;
    if (
      pagination.page !== page ||
      pagination.per_page > SHIPMENT_EXPORT_PAGE_SIZE ||
      response.data.length > pagination.per_page
    ) {
      throw new Error("Metadata phân trang không hợp lệ khi xuất vận đơn.");
    }

    if (expectedTotal === undefined) {
      expectedTotal = pagination.total;
      expectedTotalPages = pagination.total_pages;
      if (expectedTotal > SHIPMENT_EXPORT_MAX_ROWS) {
        throw new ShipmentExportLimitError();
      }
    } else if (
      pagination.total !== expectedTotal ||
      pagination.total_pages !== expectedTotalPages
    ) {
      throw new Error(
        "Số lượng vận đơn thay đổi trong lúc xuất; không tạo file thiếu hoặc trùng dữ liệu.",
      );
    }

    for (const row of response.data) {
      if (seenPublicIds.has(row.public_id)) {
        throw new Error("Dữ liệu phân trang bị trùng vận đơn khi xuất.");
      }
      seenPublicIds.add(row.public_id);
      rows.push(row);
    }

    if (page >= (expectedTotalPages ?? 0)) break;
    if (page >= Math.ceil(SHIPMENT_EXPORT_MAX_ROWS / SHIPMENT_EXPORT_PAGE_SIZE)) {
      throw new ShipmentExportLimitError();
    }
  }

  if (rows.length !== expectedTotal) {
    throw new Error("Dữ liệu trả về chưa đủ để hoàn tất file CSV.");
  }

  assertExportCanContinue(signal, isContextCurrent);
  return rows;
}

function safeText(value: unknown): string {
  if (typeof value !== "string") return "";
  if (/^[\t\r]/.test(value) || /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function csvTextCell(value: unknown): string {
  const escaped = safeText(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

function csvNumberCell(value: unknown): string {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^\d+(?:\.\d{1,2})?$/.test(value))
  ) {
    throw new TypeError("Giá trị tiền không hợp lệ khi xuất CSV.");
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TypeError("Giá trị tiền không hợp lệ khi xuất CSV.");
  }
  return String(value);
}

const CSV_HEADERS = [
  "Mã vận đơn",
  "Người gửi",
  "SĐT người gửi (đã che)",
  "Người nhận",
  "SĐT người nhận (đã che)",
  "Bưu cục gửi",
  "Bưu cục nhận",
  "Dịch vụ",
  "Tổng cước (VND)",
  "COD (VND)",
  "Trạng thái",
  "Ưu tiên",
  "Ngày tạo",
] as const;

function rowToCsvCells(row: ShipmentListItem): string[] {
  const statusLabel =
    SHIPMENT_STATUS_LABELS[row.status] ?? "Không xác định";

  return [
    csvTextCell(row.tracking_code),
    csvTextCell(row.sender_name),
    csvTextCell(row.sender_phone_masked),
    csvTextCell(row.recipient_name),
    csvTextCell(row.recipient_phone_masked),
    csvTextCell(row.origin_branch_name),
    csvTextCell(row.destination_branch_name),
    csvTextCell(row.service_type_name),
    csvNumberCell(row.total_freight_amount),
    csvNumberCell(row.cod_amount),
    csvTextCell(statusLabel),
    csvTextCell(row.is_priority === true ? "Có" : "Không"),
    csvTextCell(row.created_at),
  ];
}

export function shipmentsToCsv(rows: readonly ShipmentListItem[]): string {
  const header = CSV_HEADERS.map(csvTextCell).join(",");
  const data = rows.map(rowToCsvCells).map((cells) => cells.join(","));
  return `\uFEFF${[header, ...data].join("\r\n")}\r\n`;
}

export function getShipmentCsvFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `danh-sach-van-don_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
}

export function downloadShipmentCsv(
  rows: readonly ShipmentListItem[],
  now = new Date(),
): void {
  const blob = new Blob([shipmentsToCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | null = null;

  try {
    anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = getShipmentCsvFilename(now);
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
