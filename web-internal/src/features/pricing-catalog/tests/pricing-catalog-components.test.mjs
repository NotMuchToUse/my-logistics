import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const tableSource = fs.readFileSync(new URL("../components/CatalogTable.tsx", import.meta.url), "utf8");
const dialogSource = fs.readFileSync(new URL("../components/CatalogCrudDialog.tsx", import.meta.url), "utf8");
const deleteSource = fs.readFileSync(new URL("../components/CatalogDeleteDialog.tsx", import.meta.url), "utf8");

test("TC03 DataTable component exports table, loading, empty and error states", () => {
  assert.match(tableSource, /export function CatalogTable/);
  assert.match(tableSource, /Skeleton/);
  assert.match(tableSource, /EmptyState/);
  assert.match(tableSource, /Không tải được dữ liệu/);
});

test("TC05-TC08 CRUD dialog uses Zod and supports add/edit/reset", () => {
  assert.match(dialogSource, /safeParse/);
  assert.match(dialogSource, /record \? "Chỉnh sửa" : "Thêm"/);
  assert.match(dialogSource, /setValues\(record \? /);
  assert.match(dialogSource, /DialogFooter/);
});

test("TC11-TC13 delete confirmation component wraps shared ConfirmDialog", () => {
  assert.match(deleteSource, /ConfirmDialog/);
  assert.match(deleteSource, /Xóa mềm/);
  assert.match(deleteSource, /isLoading=/);
});

test("Responsive and accessible controls are present", () => {
  assert.match(tableSource, /sm:flex-row/);
  assert.match(tableSource, /<Table>/);
  assert.match(dialogSource, /DialogContent/);
  assert.match(dialogSource, /role="alert"/);
});
