import { useState } from "react";
import { AlertCircle, Banknote, Check, FileCheck2, ImagePlus, Loader2, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { useBranchRemittance } from "../hooks/useBranchRemittance";
import { formatVnd } from "../utils/branch-remittance.utils";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(value: number): string {
  return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function BranchRemittancePage() {
  const activeScope = useBranchScopeStore((store) => store.activeScope);
  const scopeKey = activeScope ? `${activeScope.scope_type}:${activeScope.branch_id ?? "all"}:${activeScope.warehouse_id ?? "none"}` : "none";
  return <BranchRemittanceContent key={scopeKey} />;
}

function BranchRemittanceContent() {
  const state = useBranchRemittance();
  const [confirming, setConfirming] = useState(false);
  const { register, handleSubmit, formState: { errors, isValid } } = state.form;

  if (!state.canRead) {
    return (
      <section className="space-y-3 p-4 sm:p-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Lập bảng kê nộp tiền</h1>
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {state.needsMockBranchScope
            ? "Admin Mock đang ở phạm vi Toàn hệ thống. Hãy chọn Chi nhánh hoặc Bưu cục trong thanh Phạm vi để xem dữ liệu trải nghiệm."
            : "Bạn chưa có quyền xem nghiệp vụ nộp tiền trong phạm vi được cấp."}
        </p>
      </section>
    );
  }

  const confirmSubmit = handleSubmit((values) => {
    setConfirming(false);
    void state.submit(values);
  });

  return (
    <section className="min-w-0 space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Lập bảng kê nộp tiền</h1>
          <p className="text-sm text-muted-foreground">Tổng hợp bảng kê đã khóa và gửi chứng từ nộp tiền về Trung tâm/Chi nhánh cấp trên.</p>
        </div>
        <Badge variant="outline" className="w-fit">{state.branchName ?? "Chưa chọn chi nhánh"}</Badge>
      </header>

      {!state.canMock ? (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          API thật BLOCKED: chưa có endpoint danh sách, request/response ghi phiếu và upload được xác nhận. Không gửi request và không tự chuyển sang Mock.
        </div>
      ) : (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Mock Mode: dữ liệu và thao tác chỉ mô phỏng trong phiên trình duyệt; chưa đồng bộ Backend.</div>
      )}

      {!state.permitted ? (
        <div role="alert" className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Thiếu quyền `finance.remit`; thao tác gửi phiếu bị khóa. Quyền xem danh sách không cấp quyền ghi.</p>
        </div>
      ) : null}

      {state.loadError ? <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{state.loadError}</div> : null}
      {state.submitError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><span>{state.submitError}</span>{state.permitted && state.selectedIds.length && state.receipt ? <Button type="button" variant="outline" size="sm" onClick={state.retrySubmit} disabled={state.submitting || state.uploading}>Thử gửi lại</Button> : null}</div> : null}

      <Card className="min-w-0 p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-medium">Bảng kê thu tiền đủ điều kiện</h2><p className="text-sm text-muted-foreground">{state.isMockAdminAll ? "Hiển thị bảng kê đã khóa, chưa nộp của mọi đơn vị trong dữ liệu Mock." : "Chỉ hiển thị bảng kê đã khóa thuộc chi nhánh đang thao tác."}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {state.isMockAdminAll ? <select aria-label="Lọc chi nhánh/bưu cục" value={state.unitFilter} onChange={(event) => state.setUnitFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">Tất cả đơn vị</option>{state.unitOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select> : null}
            <div className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input value={state.search} onChange={(event) => state.setSearch(event.target.value)} placeholder="Tìm mã bảng kê" className="pl-9 text-base sm:text-sm" aria-label="Tìm mã bảng kê" /></div>
            <Button type="button" variant="outline" size="icon" onClick={() => void state.load()} aria-label="Tải lại danh sách"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        {state.loading ? <div className="h-40 animate-pulse rounded-md bg-muted" aria-label="Đang tải bảng kê" /> : state.visibleCollections.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><FileCheck2 className="h-7 w-7" /><p>{state.collections.length ? "Không tìm thấy bảng kê phù hợp." : "Không có bảng kê đã khóa, chưa nộp trong phạm vi chi nhánh này."}</p></div>
        ) : (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="whitespace-nowrap"><input type="checkbox" aria-label="Chọn tất cả bảng kê đang hiển thị" checked={state.allVisibleSelected} disabled={state.retryPending || state.selectAllBlocked} onChange={(event) => state.toggleAllVisible(event.target.checked)} /></TableHead>
                <TableHead className="whitespace-nowrap">Mã bảng kê</TableHead><TableHead className="whitespace-nowrap">Chi nhánh / Bưu cục</TableHead><TableHead className="whitespace-nowrap text-right">Số vận đơn</TableHead><TableHead className="whitespace-nowrap">Thời gian khóa</TableHead><TableHead className="whitespace-nowrap text-right">Tổng tiền</TableHead><TableHead>Trạng thái</TableHead>
              </TableRow></TableHeader>
              <TableBody>{state.visibleCollections.map((item) => <TableRow key={item.public_id}>
                <TableCell><input type="checkbox" aria-label={`Chọn ${item.collection_code}`} checked={state.selectedIds.includes(item.public_id)} disabled={state.retryPending || (state.selectedSourceBranchId !== null && state.selectedSourceBranchId !== item.branch_id)} onChange={(event) => state.toggleCollection(item, event.target.checked)} /></TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">{item.collection_code}</TableCell><TableCell className="whitespace-nowrap">{state.unitOptions.find((unit) => unit.id === item.branch_id)?.name ?? `Đơn vị #${item.branch_id}`}</TableCell><TableCell className="tabular-nums text-right">{item.shipment_count}</TableCell><TableCell className="whitespace-nowrap">{formatDate(item.locked_at)}</TableCell><TableCell className="whitespace-nowrap text-right tabular-nums">{formatVnd(item.total_amount)}</TableCell><TableCell><Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Đã khóa</Badge></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>
        )}
        {state.selectAllBlocked ? <p className="mt-3 text-xs text-muted-foreground">Lọc theo một đơn vị nguồn để dùng “Chọn tất cả”.</p> : null}
        {state.selectedSourceBranchName ? <p className="mt-3 text-xs text-muted-foreground">Phiếu hiện tại chỉ gồm bảng kê của {state.selectedSourceBranchName}; bảng kê đơn vị khác đang bị khóa chọn.</p> : null}
        {state.selectionError ? <p role="alert" className="mt-3 text-sm text-destructive">{state.selectionError}</p> : null}
      </Card>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-2"><Banknote className="h-4 w-4" /><h2 className="font-medium">Tổng hợp phiếu nộp</h2></div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Bảng kê đã chọn</dt><dd className="font-medium">{state.selectedCollections.length}</dd></div>
            <div><dt className="text-muted-foreground">Tổng tiền</dt><dd className="text-lg font-semibold tabular-nums">{state.totalAmount ? formatVnd(state.totalAmount) : "Vượt giới hạn DECIMAL(15,2)"}</dd></div>
            <div><dt className="text-muted-foreground">Chi nhánh nguồn</dt><dd>{state.selectedSourceBranchName ?? (state.isMockAdminAll ? "Chọn bảng kê cùng một đơn vị" : state.branchName ?? "Chưa chọn")}</dd></div>
            <div><dt className="text-muted-foreground">Đơn vị nhận</dt><dd>{state.recipientName || "Chưa có dữ liệu xác nhận"}</dd></div>
          </dl>
          {state.selectedCollections.map((item) => <p key={item.public_id} className="font-mono text-xs text-muted-foreground">{item.collection_code} · {formatVnd(item.total_amount)}</p>)}
        </Card>

        <Card className="space-y-4 p-4 sm:p-6">
          <div><h2 className="font-medium">Thông tin chuyển khoản</h2><p className="text-sm text-muted-foreground">Các trường bên dưới bắt buộc cho luồng gửi duyệt này.</p></div>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="bank_name">Tên ngân hàng</Label><Input id="bank_name" maxLength={100} disabled={state.retryPending} className="text-base sm:text-sm" {...register("bank_name")} />{errors.bank_name ? <p className="text-sm text-destructive">{errors.bank_name.message}</p> : null}</div>
              <div className="space-y-2"><Label htmlFor="bank_account_no">Số tài khoản thụ hưởng</Label><Input id="bank_account_no" maxLength={50} autoComplete="off" disabled={state.retryPending} className="text-base sm:text-sm" {...register("bank_account_no")} />{errors.bank_account_no ? <p className="text-sm text-destructive">{errors.bank_account_no.message}</p> : null}</div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="bank_reference_no">Mã giao dịch ngân hàng</Label><Input id="bank_reference_no" maxLength={100} disabled={state.retryPending} className="text-base sm:text-sm" {...register("bank_reference_no")} />{errors.bank_reference_no ? <p className="text-sm text-destructive">{errors.bank_reference_no.message}</p> : null}</div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div><h3 className="text-sm font-medium">Ảnh biên lai / ủy nhiệm chi</h3><p className="text-xs text-muted-foreground">JPEG, PNG hoặc WebP · tối đa 5 MB</p></div>
              <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2" aria-label="Chọn ảnh biên lai" disabled={!state.permitted || !state.canMock || state.uploading || state.retryPending} onChange={(event) => void state.uploadFile(event.target.files?.[0])} />
              {state.previewUrl ? <div className="flex flex-wrap items-center gap-3"><img src={state.previewUrl} alt="Xem trước biên lai" className="h-24 w-32 rounded border object-contain" /><span className="min-w-0 flex-1 truncate text-sm">{state.receipt ? `${state.receipt.file_name} · ${formatBytes(state.receipt.size)}` : "Ảnh đã chọn"}</span>{state.uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Đang tải ảnh" /> : state.receipt ? <Check className="h-4 w-4 text-emerald-600" aria-label="Ảnh sẵn sàng" /> : null}<Button type="button" variant="ghost" size="icon" onClick={state.clearReceipt} aria-label="Gỡ ảnh" disabled={state.retryPending}><Trash2 className="h-4 w-4" /></Button></div> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><ImagePlus className="h-4 w-4" />Chưa chọn biên lai</div>}
              {state.uploadError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive"><span>{state.uploadError}</span><Button type="button" variant="outline" size="sm" onClick={state.retryUpload}><Upload className="mr-2 h-4 w-4" />Thử lại</Button></div> : null}
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><Button type="submit" className="w-full sm:w-auto" disabled={!isValid || state.submitting || state.retryPending || state.uploading || !state.receipt || !state.selectedIds.length || !state.permitted || !state.canMock || !state.totalAmount || state.totalAmount === "0.00"}>{state.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Gửi duyệt</Button></div>
          </form>
        </Card>
      </div>

      {confirming ? <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg space-y-4 rounded-lg border bg-background p-5 shadow-lg"><h2 id="confirm-title" className="font-semibold">Xác nhận gửi phiếu nộp</h2><p className="text-sm text-muted-foreground">{state.selectedCollections.length} bảng kê · {state.selectedSourceBranchName ?? "Chưa xác định đơn vị nguồn"} · {state.totalAmount ? formatVnd(state.totalAmount) : "Tổng tiền không hợp lệ"} · {state.recipientName || "Chưa xác định đơn vị nhận"}</p><p className="break-all text-sm">{state.form.getValues("bank_name")} · tài khoản {state.form.getValues("bank_account_no")} · mã GD {state.form.getValues("bank_reference_no")}</p><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setConfirming(false)}>Quay lại</Button><Button type="button" disabled={!state.permitted || !state.canMock || state.submitting} onClick={() => void confirmSubmit()}>Xác nhận gửi</Button></div></div></div> : null}

      {state.submission ? <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-medium">Mock đã ghi nhận phiếu ở trạng thái chờ xác nhận.</p><p>Mã phiếu: <span className="font-mono">{state.submission.remittance_code}</span> · {formatVnd(state.submission.total_amount)} · submitted</p></div> : null}
    </section>
  );
}
