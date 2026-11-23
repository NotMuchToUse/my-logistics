export interface CsvColumn<Row> {
  key: Extract<keyof Row, string>;
  header: string;
}

function escapeCsvValue(value: unknown): string {
  const rawValue = value === null || value === undefined ? "" : String(value);
  const safeValue = /^[=+\-@\t\r]/.test(rawValue)
    ? `'${rawValue}`
    : rawValue;

  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function exportCsv<Row extends object>(
  rows: readonly Row[],
  columns: readonly CsvColumn<Row>[],
  fileName: string,
): void {
  const headerRow = columns
    .map((column) => escapeCsvValue(column.header))
    .join(",");
  const dataRows = rows.map((row) =>
    columns
      .map((column) => escapeCsvValue(row[column.key]))
      .join(","),
  );
  const csvContent = `\uFEFF${[headerRow, ...dataRows].join("\r\n")}`;
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
