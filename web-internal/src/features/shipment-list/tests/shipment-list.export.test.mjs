import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectShipmentsForExport,
  canExportShipmentList,
  downloadShipmentCsv,
  getShipmentCsvFilename,
  SHIPMENT_EXPORT_MAX_ROWS,
  SHIPMENT_EXPORT_PAGE_SIZE,
  SHIPMENT_EXPORT_PERMISSION,
  ShipmentExportAbortedError,
  ShipmentExportLimitError,
  shipmentsToCsv,
} from "../utils/shipment-list-export.ts";

const defaultFilters = {
  tracking_code: "",
  phone: "",
  origin_branch_id: "",
  destination_branch_id: "",
  service_type_id: "",
  status: "",
  from_date: "",
  to_date: "",
  is_priority: "all",
};

const sorting = { sortBy: "created_at", sortDirection: "DESC" };
const scope = { branchId: 3, warehouseId: null };

test("export authorization stays blocked until the shipment-list permission is confirmed", () => {
  assert.equal(
    canExportShipmentList(true, ["shipment.read", "reports.export"]),
    false,
  );
  assert.equal(canExportShipmentList(true, ["shipment.read"]), false);
  assert.equal(canExportShipmentList(true, ["reports.export"]), false);
  assert.equal(
    canExportShipmentList(false, ["shipment.read", "reports.export"]),
    false,
  );
  assert.equal(SHIPMENT_EXPORT_PERMISSION, null);
});

function row(index, overrides = {}) {
  return {
    public_id: `internal-fixture-${index}`,
    tracking_code: `VS-${String(index).padStart(6, "0")}`,
    status: "draft",
    sender_name: "Nguyễn An",
    sender_phone_masked: "090***0101",
    recipient_name: "Trần Bình",
    recipient_phone_masked: "091***0101",
    origin_branch_name: "Chi nhánh Đà Nẵng",
    destination_branch_name: "Chi nhánh Hà Nội",
    service_type_name: "Chuyển phát nhanh",
    assigned_driver_name: null,
    parcel_count: 1,
    chargeable_weight_gram: 500,
    total_freight_amount: 0,
    cod_amount: "0",
    is_priority: false,
    version: 1,
    created_at: "2026-11-24T10:00:00+07:00",
    ...overrides,
  };
}

function response(data, page, total, perPage = SHIPMENT_EXPORT_PAGE_SIZE) {
  return {
    success: true,
    message: "OK",
    data,
    meta: {
      timestamp: "2026-11-24T10:00:00+07:00",
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    },
  };
}

test("CSV has UTF-8 BOM, Vietnamese headers, numeric money, and no internal IDs", () => {
  const csv = shipmentsToCsv([
    row(1, {
      total_freight_amount: "25000",
      cod_amount: 0,
      public_id: "DO-NOT-EXPORT",
    }),
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Mã vận đơn"'));
  assert.ok(csv.includes('"Tổng cước (VND)"'));
  assert.ok(csv.includes('"COD (VND)"'));
  assert.ok(csv.includes(",25000,0,"));
  assert.ok(!csv.includes("DO-NOT-EXPORT"));
});

test("CSV quotes delimiters and neutralizes formula-like text including control prefixes", () => {
  const csv = shipmentsToCsv([
    row(1, {
      sender_name: '=HYPERLINK("https://example.invalid","x"),\r\nNext line',
      recipient_name: "\t=1+1",
      origin_branch_name: "  @SUM(A1:A2)",
      destination_branch_name: "+CMD",
      service_type_name: "-2+3",
    }),
    row(2, { recipient_name: "\r=HYPERLINK(\"https://example.invalid\")" }),
  ]);

  assert.ok(csv.includes(`"'=HYPERLINK(""https://example.invalid"",""x""),\r\nNext line"`));
  assert.ok(csv.includes(',"\'\t=1+1",'));
  assert.ok(csv.includes(',"\'  @SUM(A1:A2)",'));
  assert.ok(csv.includes(`"'+CMD"`));
  assert.ok(csv.includes(`"'-2+3"`));
  assert.ok(csv.includes(`"'\r=HYPERLINK(""https://example.invalid"")"`));
});

test("CSV filename uses the requested timestamp and a non-PII name", () => {
  assert.equal(
    getShipmentCsvFilename(new Date(2026, 10, 24, 9, 7, 5)),
    "danh-sach-van-don_2026-11-24_090705.csv",
  );
});

test("download clicks a CSV anchor and releases its Object URL", () => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const createDescriptor = Object.getOwnPropertyDescriptor(
    URL,
    "createObjectURL",
  );
  const revokeDescriptor = Object.getOwnPropertyDescriptor(
    URL,
    "revokeObjectURL",
  );
  let clicked = false;
  let removed = false;
  let revoked = false;
  let appended = false;
  let downloadName = "";

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        href: "",
        set download(value) {
          downloadName = value;
        },
        click: () => {
          clicked = true;
        },
        remove: () => {
          removed = true;
        },
      }),
      body: {
        append: () => {
          appended = true;
        },
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (callback) => {
        callback();
        return 1;
      },
    },
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:shipment-export",
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: (value) => {
      revoked = value === "blob:shipment-export";
    },
  });

  try {
    downloadShipmentCsv([row(1)], new Date(2026, 10, 24, 9, 7, 5));
    assert.equal(appended, true);
    assert.equal(clicked, true);
    assert.equal(removed, true);
    assert.equal(revoked, true);
    assert.equal(
      downloadName,
      "danh-sach-van-don_2026-11-24_090705.csv",
    );
  } finally {
    if (documentDescriptor) {
      Object.defineProperty(globalThis, "document", documentDescriptor);
    } else {
      delete globalThis.document;
    }
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    } else {
      delete globalThis.window;
    }
    if (createDescriptor) {
      Object.defineProperty(URL, "createObjectURL", createDescriptor);
    }
    if (revokeDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
    }
  }
});

test("export fetches every page with applied filters, sorting, and current Branch Scope", async () => {
  const calls = [];
  const rows = Array.from({ length: 205 }, (_, index) => row(index));
  const result = await collectShipmentsForExport({
    filters: {
      ...defaultFilters,
      tracking_code: " VS- ",
      is_priority: "0",
      origin_branch_id: "3",
    },
    sorting: { sortBy: "tracking_code", sortDirection: "ASC" },
    branchFiltersSupported: true,
    scope,
    signal: new AbortController().signal,
    isContextCurrent: () => true,
    fetchPage: async (query, _signal, requestScope) => {
      calls.push({ query, requestScope });
      const start = (query.page - 1) * SHIPMENT_EXPORT_PAGE_SIZE;
      return response(
        rows.slice(start, start + SHIPMENT_EXPORT_PAGE_SIZE),
        query.page,
        rows.length,
      );
    },
  });

  assert.equal(result.length, 205);
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map(({ query }) => [query.page, query.per_page]),
    [[1, 100], [2, 100], [3, 100]],
  );
  assert.equal(calls[0].query.tracking_code, "VS-");
  assert.equal(calls[0].query.is_priority, false);
  assert.equal(calls[0].query.sort_by, "tracking_code");
  assert.equal(calls[0].query.sort_direction, "ASC");
  assert.equal(calls[0].query.origin_branch_id, 3);
  assert.deepEqual(calls[0].requestScope, scope);
});

test("export aborts on context change and never sends MOCK ONLY filters to API mode", async () => {
  let calls = 0;
  await assert.rejects(
    collectShipmentsForExport({
      filters: defaultFilters,
      sorting,
      branchFiltersSupported: true,
      scope,
      signal: new AbortController().signal,
      isContextCurrent: () => calls === 0,
      fetchPage: async () => {
        calls += 1;
        return response([row(1)], 1, 1);
      },
    }),
    ShipmentExportAbortedError,
  );
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(
    collectShipmentsForExport({
      filters: { ...defaultFilters, origin_branch_id: "3" },
      sorting,
      branchFiltersSupported: false,
      scope,
      signal: new AbortController().signal,
      isContextCurrent: () => true,
      fetchPage: async () => {
        calls += 1;
        return response([], 1, 0);
      },
    }),
  );
  assert.equal(calls, 0);
});

test("export rejects over-limit, duplicate, and changing pagination results", async () => {
  await assert.rejects(
    collectShipmentsForExport({
      filters: defaultFilters,
      sorting,
      branchFiltersSupported: true,
      scope,
      signal: new AbortController().signal,
      isContextCurrent: () => true,
      fetchPage: async () => response([], 1, SHIPMENT_EXPORT_MAX_ROWS + 1),
    }),
    ShipmentExportLimitError,
  );

  await assert.rejects(
    collectShipmentsForExport({
      filters: defaultFilters,
      sorting,
      branchFiltersSupported: true,
      scope,
      signal: new AbortController().signal,
      isContextCurrent: () => true,
      fetchPage: async () => response([row(1), row(1)], 1, 2, 100),
    }),
    /trùng vận đơn/,
  );

  let page = 0;
  await assert.rejects(
    collectShipmentsForExport({
      filters: defaultFilters,
      sorting,
      branchFiltersSupported: true,
      scope,
      signal: new AbortController().signal,
      isContextCurrent: () => true,
      fetchPage: async () => {
        page += 1;
        return response([row(page)], page, page === 1 ? 101 : 100);
      },
    }),
    /thay đổi trong lúc xuất/,
  );
});
