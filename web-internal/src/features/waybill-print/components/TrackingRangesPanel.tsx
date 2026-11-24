import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRACKING_RANGE_STATUS_LABELS } from "../constants/waybillPrint.constants";
import { useTrackingRanges } from "../hooks/useTrackingRanges";
import type { TrackingRangeInput, TrackingRangeRecord, WaybillSession } from "../types/waybillPrint.types";
import { TrackingRangeFormDialog } from "./TrackingRangeFormDialog";

export function TrackingRangesPanel({ session }: { session: WaybillSession }) {
  const ranges = useTrackingRanges(session, true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<TrackingRangeRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<TrackingRangeRecord | null>(null);

  const branchNames = useMemo(
    () => new Map(session.branchOptions.map((branch) => [branch.id, branch.name])),
    [session.branchOptions],
  );
  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return ranges.rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      const branchName = row.branch_id === null ? "dùng chung toàn hệ thống" : branchNames.get(row.branch_id) ?? row.branch_id;
      const haystack = `${row.prefix} ${row.start_number} ${row.end_number} ${branchName}`.toLocaleLowerCase("vi");
      return haystack.includes(query);
    });
  }, [branchNames, ranges.rows, search, statusFilter]);

  const pending = ranges.pendingMutation;
  const pendingSaveForDialog = pending?.kind === "save"
    && pending.id === (editing?.id ?? null);

  function openEdit(row: TrackingRangeRecord) {
    setEditing(row);
    setFormOpen(true);
  }

  async function save(input: TrackingRangeInput, id: string | null) {
    return ranges.save(input, id);
  }

  async function retrySave() {
    return ranges.retryMutation();
  }

  async function confirmDeactivate() {
    if (!deactivating) return;
    const result = await ranges.deactivate(deactivating.id);
    if (result) setDeactivating(null);
  }

  async function retryDeactivate() {
    const result = await ranges.retryMutation();
    if (result) setDeactivating(null);
  }

  async function retryPendingFromBanner() {
    const result = await ranges.retryMutation();
    if (!result) return;
    if (pending?.kind === "save") setFormOpen(false);
    if (pending?.kind === "deactivate") setDeactivating(null);
  }

  return (
    <section className="space-y-4" aria-labelledby="tracking-ranges-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="tracking-ranges-title" className="text-xl font-semibold">Quản lý dải mã vận đơn</h2>
          <p className="text-sm text-muted-foreground">Chỉ quản lý dải mã trong phạm vi chi nhánh được cấp.</p>
        </div>
        <Button type="button" disabled aria-describedby="range-create-blocker">
          <Plus className="h-4 w-4" aria-hidden="true" /> Tạo dải mã
        </Button>
      </div>
      <p id="range-create-blocker" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-muted-foreground" role="note">
        Tạm khóa tạo mới: Backend chưa xác nhận giá trị khởi tạo <code>current_number</code>. Màn hình không tự suy diễn giá trị này.
      </p>

      {ranges.error && (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{ranges.error.message}</span>
          {ranges.pending
            ? <Button variant="outline" size="sm" onClick={() => void retryPendingFromBanner()} disabled={ranges.mutating}>Thử lại đúng yêu cầu trước</Button>
            : <Button variant="outline" size="sm" onClick={() => void ranges.reload()} disabled={ranges.loading}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Tải lại</Button>}
        </div>
      )}
      {pending && !ranges.error && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="status">
          <span>Kết quả thao tác trước chưa rõ. Hãy thử lại cùng yêu cầu, không tạo yêu cầu mới.</span>
          <Button variant="outline" size="sm" onClick={() => void ranges.retryMutation()} disabled={ranges.mutating}>Thử lại yêu cầu trước</Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input aria-label="Tìm dải mã" placeholder="Tìm tiền tố, khoảng số hoặc chi nhánh" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="sr-only" htmlFor="range-status-filter">Lọc theo trạng thái</label>
        <select id="range-status-filter" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(TRACKING_RANGE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {ranges.loading ? (
        <div className="space-y-2" role="status" aria-label="Đang tải dải mã">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      ) : visibleRows.length === 0 ? (
        <EmptyState
          title={ranges.rows.length ? "Không tìm thấy dải mã" : "Chưa có dải mã"}
          description={ranges.rows.length
            ? "Thử đổi từ khóa hoặc bộ lọc trạng thái."
            : "Chưa có dữ liệu dải mã trong phạm vi này. Tính năng tạo mới đang chờ Backend xác nhận current_number."}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tiền tố / khoảng số</TableHead>
              <TableHead>Chi nhánh</TableHead>
              <TableHead>Đã cấp tới</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead><span className="sr-only">Thao tác</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => {
              const canEdit = row.status === "active" && BigInt(row.current_number) < BigInt(row.start_number);
              const canDeactivate = row.status !== "inactive";
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <strong>{row.prefix}</strong>
                    <p className="font-mono text-xs text-muted-foreground">{row.start_number} – {row.end_number}</p>
                  </TableCell>
                  <TableCell>{row.branch_id === null ? "Dùng chung toàn hệ thống" : branchNames.get(row.branch_id) ?? `Chi nhánh ${row.branch_id}`}</TableCell>
                  <TableCell className="font-mono">{row.current_number}</TableCell>
                  <TableCell><Badge variant={row.status === "active" ? "default" : "secondary"}>{TRACKING_RANGE_STATUS_LABELS[row.status]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={!canEdit || ranges.pending || ranges.mutating} onClick={() => openEdit(row)}>Sửa</Button>
                      <Button type="button" size="sm" variant="destructive" disabled={!canDeactivate || ranges.pending || ranges.mutating} onClick={() => setDeactivating(row)}>Vô hiệu hóa</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <TrackingRangeFormDialog
        open={formOpen}
        record={editing}
        session={session}
        busy={ranges.mutating}
        error={ranges.error}
        pendingSave={pendingSaveForDialog}
        onOpenChange={setFormOpen}
        onSave={save}
        onRetry={retrySave}
      />

      <Dialog open={deactivating !== null} onOpenChange={(open) => { if (!open && !ranges.pending) setDeactivating(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vô hiệu hóa dải mã?</DialogTitle>
            <DialogDescription>
              Thao tác này ngừng cấp mã mới từ dải {deactivating?.prefix}{deactivating?.start_number}–{deactivating?.end_number}.
              Không xóa lịch sử đã cấp và không thể tự khôi phục từ màn hình này.
            </DialogDescription>
          </DialogHeader>
          {ranges.error && pending?.kind === "deactivate" && <p className="text-sm text-destructive" role="alert">{ranges.error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeactivating(null)} disabled={ranges.mutating || Boolean(pending)}>Hủy</Button>
            {pending?.kind === "deactivate"
              ? <Button type="button" onClick={() => void retryDeactivate()} disabled={ranges.mutating}>Thử lại đúng yêu cầu trước</Button>
              : <Button type="button" variant="destructive" onClick={() => void confirmDeactivate()} disabled={ranges.mutating}>Xác nhận vô hiệu hóa</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
