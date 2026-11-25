import { useState, type ChangeEvent } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SHIPMENT_IMPORT_COLUMNS,
  SHIPMENT_IMPORT_TEMPLATE_FILENAME,
  type ShipmentImportColumnKey,
} from "../constants/shipment-bulk-import.constants";
import {
  getShipmentImportColumnKey,
  type ShipmentImportCellError,
  type ShipmentImportPreviewRow,
} from "../schemas/shipment-bulk-import.schema";
import {
  downloadShipmentImportTemplate,
  readShipmentImportFile,
} from "../utils/shipment-bulk-import.utils";
import {
  submitShipmentBulkImport,
  type ShipmentBulkImportResponse,
} from "../api/shipment-bulk-import.api";

type BulkImportResult = ShipmentBulkImportResponse["data"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown): string {
  if (isRecord(error) && isRecord(error.error)) {
    const message = error.error.message;
    if (typeof message === "string") return message;
  }
  return error instanceof Error
    ? error.message
    : "Không thể hoàn tất thao tác nhập vận đơn.";
}

function getApiRowErrors(
  error: unknown,
): Map<number, ShipmentImportCellError[]> {
  const errorsByRow = new Map<number, ShipmentImportCellError[]>();
  if (!isRecord(error) || !isRecord(error.error)) return errorsByRow;
  const details = error.error.details;
  if (!isRecord(details)) return errorsByRow;

  for (const [key, values] of Object.entries(details)) {
    const match = /^(?:shipments|rows)\.(\d+)(?:\.(.+))?$/.exec(key);
    if (!match || !Array.isArray(values)) continue;
    const rowNumber = Number(match[1]) + 2;
    const field = match[2] ?? "";
    const rowErrors = errorsByRow.get(rowNumber) ?? [];
    for (const value of values) {
      if (typeof value !== "string") continue;
      rowErrors.push({
        field,
        columnKey: field ? getShipmentImportColumnKey(field) : null,
        message: value,
      });
    }
    errorsByRow.set(rowNumber, rowErrors);
  }

  return errorsByRow;
}

function cellErrors(
  row: ShipmentImportPreviewRow,
  columnKey: ShipmentImportColumnKey,
) {
  return [...row.clientErrors, ...row.apiErrors].filter(
    (issue) => issue.columnKey === columnKey,
  );
}

function rowHasErrors(row: ShipmentImportPreviewRow) {
  return row.clientErrors.length > 0 || row.apiErrors.length > 0;
}

export function ShipmentBulkImportPage() {
  const [rows, setRows] = useState<ShipmentImportPreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setRows([]);
    setResult(null);
    setRequestError(null);
    setFileError(null);
    setFileName(file.name);
    setIsReading(true);
    try {
      setRows(await readShipmentImportFile(file));
    } catch (error) {
      setFileError(errorMessage(error));
    } finally {
      setIsReading(false);
      input.value = "";
    }
  };

  const handleSubmit = async () => {
    if (rows.length === 0 || rows.some((row) => row.clientErrors.length > 0)) {
      return;
    }
    const shipments = rows.flatMap((row) =>
      row.payload === null ? [] : [row.payload],
    );
    if (shipments.length !== rows.length) return;

    setIsSubmitting(true);
    setRequestError(null);
    try {
      const response = await submitShipmentBulkImport(shipments);
      setResult(response.data);
      setRows((currentRows) =>
        currentRows.map((row) => {
          const rowResult = response.data.results.find(
            (item) => item.row_number === row.rowNumber,
          );
          if (!rowResult) return row;

          const apiErrors = (rowResult.errors ?? []).map((issue) => ({
            field: issue.field,
            columnKey: getShipmentImportColumnKey(issue.field),
            message: issue.message,
          }));
          if (rowResult.status === "failed" && apiErrors.length === 0) {
            apiErrors.push({
              field: "",
              columnKey: null,
              message: "API từ chối tạo vận đơn ở dòng này.",
            });
          }
          return {
            ...row,
            apiErrors,
            apiStatus: rowResult.status,
            publicId: rowResult.public_id,
          };
        }),
      );
    } catch (error) {
      const apiRowErrors = getApiRowErrors(error);
      if (apiRowErrors.size > 0) {
        setRows((currentRows) =>
          currentRows.map((row) => ({
            ...row,
            apiErrors: apiRowErrors.get(row.rowNumber) ?? [],
            apiStatus: apiRowErrors.has(row.rowNumber) ? "failed" : undefined,
          })),
        );
      }
      setRequestError(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    rows.length > 0 &&
    result === null &&
    rows.every((row) => row.payload !== null && row.clientErrors.length === 0);

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Nhập vận đơn hàng loạt
        </h1>
        <p className="text-sm text-muted-foreground">
          Tải mẫu chuẩn, nhập thông tin vận đơn rồi kiểm tra từng dòng trước khi gửi.
          Hỗ trợ tệp Excel (.xlsx) và CSV.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="font-semibold">Tệp dữ liệu</h2>
            <p className="text-sm text-muted-foreground">
              Giữ nguyên tên cột chuẩn trong sheet đầu tiên.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={downloadShipmentImportTemplate}
          >
            <Download className="h-4 w-4" />
            Tải mẫu {SHIPMENT_IMPORT_TEMPLATE_FILENAME}
          </Button>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center hover:bg-muted/50">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
          <span className="font-medium">Chọn tệp Excel hoặc CSV</span>
          <span className="text-sm text-muted-foreground">
            {fileName || "Định dạng .xlsx, .csv"}
          </span>
          <input
            type="file"
            accept=".xlsx,.csv"
            className="sr-only"
            aria-label="Chọn tệp Excel hoặc CSV"
            onChange={(event) => void handleFileChange(event)}
            disabled={isReading || isSubmitting}
          />
        </label>

        {isReading && <p role="status">Đang đọc và kiểm tra tệp…</p>}
        {fileError && (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        )}
        {requestError && (
          <p role="alert" className="text-sm text-destructive">
            {requestError}
          </p>
        )}

        {rows.length > 0 && (
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm" role="status">
              {rows.length} dòng dữ liệu · {rows.filter(rowHasErrors).length} dòng
              có lỗi
            </p>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isSubmitting}
            >
              <Upload className="h-4 w-4" />
              {isSubmitting
                ? "Đang gửi vận đơn…"
                : `Tạo ${rows.length} vận đơn`}
            </Button>
          </div>
        )}
      </section>

      {result && (
        <section
          className="space-y-3 rounded-lg border p-4 sm:p-6"
          aria-live="polite"
        >
          <h2 className="font-semibold">Kết quả nhập vận đơn</h2>
          <p>
            Tạo thành công: <strong>{result.created_count}</strong> · Lỗi:{" "}
            <strong>{result.failed_count}</strong>
          </p>
          {result.results.some((item) => item.status === "failed") && (
            <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
              {result.results
                .filter((item) => item.status === "failed")
                .map((item) => (
                  <li key={item.row_number}>
                    Dòng {item.row_number}
                    {item.errors?.length
                      ? `: ${item.errors
                          .map((issue) => `${issue.field}: ${issue.message}`)
                          .join("; ")}`
                      : ": API từ chối tạo vận đơn."}
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Xem trước dữ liệu</h2>
          <p className="text-sm text-muted-foreground">
            Các ô màu đỏ có lỗi; rê chuột hoặc đọc nội dung trong ô để xem chi tiết.
          </p>
          <Table aria-label="Bảng xem trước vận đơn nhập từ tệp">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background">
                  Dòng
                </TableHead>
                {SHIPMENT_IMPORT_COLUMNS.map((column) => (
                  <TableHead key={column.key} title={column.key}>
                    {column.label}
                    <span className="block font-mono text-xs font-normal">
                      {column.key}
                    </span>
                  </TableHead>
                ))}
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hasErrors = rowHasErrors(row);
                return (
                  <TableRow
                    key={row.rowNumber}
                    className={hasErrors ? "bg-red-50 hover:bg-red-100" : ""}
                    data-row-number={row.rowNumber}
                  >
                    <TableHead
                      className={`sticky left-0 z-10 font-mono ${
                        hasErrors ? "bg-red-50 text-red-900" : "bg-background"
                      }`}
                    >
                      {row.rowNumber}
                    </TableHead>
                    {SHIPMENT_IMPORT_COLUMNS.map((column) => {
                      const issues = cellErrors(row, column.key);
                      return (
                        <TableCell
                          key={column.key}
                          data-field={column.key}
                          aria-invalid={issues.length > 0}
                          title={issues.map((issue) => issue.message).join("\n")}
                          className={
                            issues.length > 0
                              ? "min-w-40 border border-red-500 bg-red-100 align-top text-red-950"
                              : "min-w-40 align-top"
                          }
                        >
                          <span className="whitespace-pre-wrap">
                            {row.cells[column.key] || "—"}
                          </span>
                          {issues.length > 0 && (
                            <ul className="mt-1 space-y-1 text-xs text-red-800">
                              {issues.map((issue, index) => (
                                <li key={`${issue.field}-${index}`}>
                                  {issue.message}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell
                      className={
                        hasErrors ? "font-medium text-destructive" : ""
                      }
                    >
                      {row.apiStatus === "created"
                        ? `Đã tạo${row.publicId ? ` · ${row.publicId}` : ""}`
                        : row.apiStatus === "failed"
                          ? "API báo lỗi"
                          : hasErrors
                            ? "Có lỗi"
                            : "Hợp lệ"}
                      {row.apiErrors
                        .filter((issue) => issue.columnKey === null)
                        .map((issue, index) => (
                          <p
                            key={`${issue.field}-${index}`}
                            className="mt-1 text-xs"
                          >
                            {issue.message}
                          </p>
                        ))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}
    </section>
  );
}
