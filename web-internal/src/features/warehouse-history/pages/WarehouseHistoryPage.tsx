import { HISTORY_BRANCHES, HISTORY_WAREHOUSES } from "../warehouse-history.mock-network";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileClock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { getScopeKey, useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { HISTORY_MOCK } from "../api/warehouse-history.api";
import { hasHistoryScope, isHqHistory, INITIAL_FILTERS, RECEIPT_STATUSES, RECEIPT_TYPES, canUnlock, manifestType, type HistoryContext } from "../warehouse-history.model";
import { useWarehouseHistory } from "../hooks/useWarehouseHistory";
import { ReceiptItems, ReceiptStatus, ReceiptSummary } from "../components/ReceiptViews";
import { ManifestPreview } from "../components/ManifestPreview";
import { UnlockReceiptDialog } from "../components/UnlockReceiptDialog";

export function WarehouseHistoryPage() {
  const auth = useAuthStore();
  const scope = useBranchScopeStore();
  const valid = scope.activeScope && scope.activeScope.branch_id === scope.activeBranchId && scope.activeScope.warehouse_id === scope.activeWarehouseId && scope.scopes.some((s) => getScopeKey(s) === getScopeKey(scope.activeScope!));
  const context: HistoryContext = { authenticated: auth.isAuthenticated && !!auth.token && !!auth.user, can_read: auth.hasPermission("warehouse.read"), roles: auth.roles, branch_id: valid ? scope.activeBranchId : null, warehouse_id: scope.activeWarehouseId, demo_scope: !!valid && ["hq_all", "branch", "post_office", "warehouse"].includes(scope.activeScope!.scope_type), unlock_capability: false, scope_type: valid ? scope.activeScope!.scope_type : undefined };
  return <WarehouseHistoryScreen key={JSON.stringify([auth.token, auth.user?.public_id, context, scope.activeScope])} context={context} />;
}

// Isolated tests may supply a capability; runtime never grants unconfirmed unlock permission.
export function WarehouseHistoryScreen({ context }: { context: HistoryContext }) {
  const { publicId } = useParams();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [preview, setPreview] = useState(false);
  const [unlock, setUnlock] = useState(false);
  const result = useWarehouseHistory(context, filters, publicId);
  const receipt = result.receipt;
  const pagination = result.list?.meta.pagination;
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((f) => ({ ...f, [key]: value, ...(key === "branch_id" ? { warehouse_id: "" } : {}), page: 1 }));
  if (!context.authenticated || !context.can_read || !hasHistoryScope(context)) return <p role="alert">Bạn chưa có phiên đăng nhập, quyền xem kho hoặc phạm vi chi nhánh hợp lệ.</p>;
  return <section className="min-w-0 space-y-4 text-sm">
    <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl"><FileClock aria-hidden className="h-6 w-6 shrink-0" />Lịch sử nhập/xuất kho</h1>
    <p className="rounded-md border p-3 text-muted-foreground">{HISTORY_MOCK ? "DỮ LIỆU MOCK — phiếu mô phỏng theo mạng lưới kho của ứng dụng. Đơn vị chưa có kho mẫu sẽ không có phiếu." : "API thật — tìm chính xác mã phiếu hoặc lọc trạng thái; kho theo phạm vi đang chọn."} Mở khóa và in chứng từ chính thức chưa sẵn sàng.</p>
    {publicId ? <Link className="inline-block underline" to="/warehouse-history">Quay lại danh sách</Link> : <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
      {HISTORY_MOCK && isHqHistory(context) && <label>Chi nhánh<select className="mt-1 h-10 w-full rounded-md border bg-background px-2" value={filters.branch_id ?? ""} onChange={(e) => setFilter("branch_id", e.target.value)}><option value="">Tất cả chi nhánh</option>{HISTORY_BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <label>Mã phiếu<Input value={filters.receipt_code} onChange={(e) => setFilter("receipt_code", e.target.value)} placeholder={HISTORY_MOCK ? "Tìm mã phiếu mẫu" : "Nhập chính xác mã phiếu"} /></label>
      <label>Loại phiếu<select className="mt-1 h-10 w-full rounded-md border bg-background px-2" disabled={!HISTORY_MOCK} value={filters.receipt_type} onChange={(e) => setFilter("receipt_type", e.target.value)}><option value="">Tất cả</option>{Object.entries(RECEIPT_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Trạng thái<select className="mt-1 h-10 w-full rounded-md border bg-background px-2" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}><option value="">Tất cả</option>{Object.entries(RECEIPT_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Kho<select className="mt-1 h-10 w-full rounded-md border bg-background px-2" disabled={!HISTORY_MOCK || context.warehouse_id !== null} value={context.warehouse_id ?? filters.warehouse_id} onChange={(e) => setFilter("warehouse_id", e.target.value)}><option value="">Kho trong phạm vi</option>{HISTORY_WAREHOUSES.filter((w) => isHqHistory(context) ? (!filters.branch_id || w.branch_id === Number(filters.branch_id)) : w.branch_id === context.branch_id).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label>Từ ngày<Input type="date" disabled={!HISTORY_MOCK} value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} /></label>
      <label>Đến ngày<Input type="date" disabled={!HISTORY_MOCK} value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} /></label>
      <Button variant="outline" onClick={() => setFilters(INITIAL_FILTERS)}>Xóa bộ lọc</Button>
    </div>}
    {result.loading && <p role="status" className="animate-pulse rounded-md bg-muted p-6">Đang tải dữ liệu…</p>}
    {result.error && <div role="alert" className="space-y-2 rounded-md border p-4"><p>{result.error}</p><Button variant="outline" onClick={result.refetch}>Tải lại</Button></div>}
    {receipt && <><div className="flex flex-wrap items-center gap-3"><h2 className="break-all font-mono font-medium">{receipt.receipt_code}</h2><ReceiptStatus receipt={receipt} />{manifestType(receipt) && <Button variant="outline" onClick={() => setPreview(true)}><Printer className="mr-2 h-4 w-4" />Xem trước bảng kê</Button>}{canUnlock(receipt, context) && <Button onClick={() => setUnlock(true)}>Mở khóa phiếu</Button>}</div><ReceiptSummary receipt={receipt} /><ReceiptItems receipt={receipt} /></>}
    {result.list && <><div className="overflow-x-auto rounded-lg border"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-muted"><tr>{["Mã phiếu", "Loại phiếu", "Chi nhánh", "Kho", "Kho đích", "Vận đơn", "Túi", "Gram", "Trạng thái", "Tạo lúc", "Chốt lúc", "Thao tác"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{result.list.data.map((r) => <tr key={r.public_id} className="border-t"><td className="p-3 font-mono text-xs font-medium">{r.receipt_code}</td><td className="p-3">{RECEIPT_TYPES[r.receipt_type]}</td><td className="p-3">{r.branch_name ?? "Chưa có dữ liệu"}</td><td className="p-3">{r.warehouse_name ?? "Chưa có dữ liệu"}</td><td className="p-3">{r.demo?.target_warehouse_name ?? "—"}</td>{[r.total_shipments, r.total_bags, r.total_weight_gram].map((n, i) => <td key={i} className="p-3 text-right tabular-nums">{n.toLocaleString("vi-VN")}</td>)}<td className="p-3"><ReceiptStatus receipt={r} /></td><td className="p-3">{r.created_at ?? "—"}</td><td className="p-3">{r.confirmed_at ?? "—"}</td><td className="p-3"><Link className="underline" to={`/warehouse-history/${r.public_id}`}>Xem chi tiết</Link></td></tr>)}</tbody></table>{!result.list.data.length && <p className="p-6 text-center">Không có phiếu phù hợp.</p>}</div><div className="flex flex-wrap items-center justify-end gap-3"><span>{pagination?.total} phiếu · Trang {filters.page}/{Math.max(1, pagination?.total_pages ?? 1)}</span><Button variant="outline" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Trước</Button><Button variant="outline" disabled={filters.page >= (pagination?.total_pages ?? 0)} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Sau</Button></div></>}
    {preview && receipt && <ManifestPreview receipt={receipt} mock={HISTORY_MOCK} onClose={() => setPreview(false)} />}
    {unlock && receipt && <UnlockReceiptDialog key={receipt.version} receipt={receipt} context={context} onClose={() => setUnlock(false)} onRefresh={result.refetch} />}
  </section>;
}
