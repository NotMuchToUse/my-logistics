import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readSource = (relativePath) =>
  fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");

const filtersSource = readSource("../components/ShipmentListFilters.tsx");
const tableSource = readSource("../components/ShipmentDataTable.tsx");
const actionsSource = readSource("../components/ShipmentRowActions.tsx");
const cancelSource = readSource("../components/CancelShipmentDialog.tsx");
const exportSource = readSource("../components/ShipmentExportButton.tsx");
const pageSource = readSource("../pages/ShipmentListPage.tsx");
const routerSource = fs.readFileSync(
  new URL("../../../core/router/AppRouter.tsx", import.meta.url),
  "utf8",
);

test("filters use shared hook state, explicit apply/reset, and disable MOCK ONLY branches in API mode", () => {
  assert.match(filtersSource, /list\.updateDraftFilter/);
  assert.match(filtersSource, /list\.applyFilters\(\)/);
  assert.match(filtersSource, /list\.resetFilters/);
  assert.match(filtersSource, /!list\.capabilities\.branchFilters/);
  assert.match(filtersSource, /MOCK ONLY/);
  for (const label of [
    "Mã vận đơn",
    "SĐT người gửi/nhận",
    "Bưu cục gửi",
    "Bưu cục nhận",
    "Dịch vụ",
    "Trạng thái",
    "Từ ngày",
    "Đến ngày",
    "Ưu tiên",
  ]) {
    assert.ok(filtersSource.includes(label));
  }
});

test("table uses public_id selection, supported server sorting, separate money columns, and explicit states", () => {
  assert.match(tableSource, /key=\{item\.public_id\}/);
  assert.match(tableSource, /list\.setSorting/);
  assert.match(tableSource, /Skeleton/);
  assert.match(tableSource, /Không tìm thấy vận đơn/);
  assert.match(tableSource, /Thử lại/);
  assert.match(tableSource, /total_freight_amount/);
  assert.match(tableSource, /cod_amount/);
  assert.match(tableSource, /StatusBadge/);
  assert.match(tableSource, /ShipmentPriorityBadge/);
});

test("row actions use the action hook, cancel confirmation, and keep forwarding disabled", () => {
  assert.match(actionsSource, /actions\.updatePriority/);
  assert.match(actionsSource, /actions\.cancel/);
  assert.match(actionsSource, /<CancelShipmentDialog/);
  assert.match(actionsSource, /disabled\s*\n\s*title="Chưa có interface chuyển tiếp/);
  assert.doesNotMatch(actionsSource, /axiosClient|fetch\(/);
  assert.match(cancelSource, /handleSubmit/);
  assert.match(cancelSource, /zodResolver/);
  assert.match(cancelSource, /onConfirm\(shipment/);
});

test("export uses the filtered list service, bounded pagination, and CSV utility only", () => {
  assert.match(exportSource, /collectShipmentsForExport/);
  assert.match(exportSource, /fetchPage: fetchShipmentsApi/);
  assert.match(exportSource, /downloadShipmentCsv/);
  assert.match(exportSource, /!list\.canRead/);
  assert.match(exportSource, /canExportShipmentList/);
  assert.match(exportSource, /Quyền xuất danh sách KHA-26 chưa được xác nhận/);
  assert.match(exportSource, /startSessionKey/);
  assert.match(exportSource, /currentScopeKey === scopeKey/);
  assert.doesNotMatch(exportSource, /axiosClient|\.xlsx|xlsx/);
});

test("page composes the feature components behind read permission on the existing protected route", () => {
  assert.match(pageSource, /<PermissionGuard/);
  assert.match(pageSource, /SHIPMENT_LIST_PERMISSIONS\.read/);
  assert.match(pageSource, /<ShipmentListFilters/);
  assert.match(pageSource, /<ShipmentDataTable/);
  assert.match(pageSource, /<ShipmentExportButton/);
  assert.match(routerSource, /path="shipment-list" element={<ShipmentListPage \/>}/);
  assert.match(routerSource, /<ProtectedRoute>/);
  assert.match(routerSource, /<InternalLayout \/>/);
  assert.doesNotMatch(pageSource, /axiosClient|fetch\(/);
});
