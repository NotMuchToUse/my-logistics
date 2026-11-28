import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { warehouseAuditApi } from "../api/warehouse-audit.api";
import {
  AUDIT_RESULT_LABELS,
  WAREHOUSE_OPTIONS,
} from "../constants/warehouse-audit.constants";
import type {
  WarehouseAuditResult,
  WarehouseReturnProposal,
  WarehouseStockAudit,
  WarehouseStockItem,
} from "../types/warehouse-audit.types";
import {
  getAuditStatistics,
  getShipmentStatusLabel,
  getStorageDeadlineBucket,
  scanStockItem,
  STORAGE_DEADLINE_BUCKET_LABELS,
  warehouseAuditToCsv,
} from "../utils/warehouse-audit.utils";

const AUDIT_RESULT_VARIANTS: Record<
  WarehouseAuditResult,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  matched: "default",
  missing: "destructive",
  misrouted: "secondary",
  overdue_storage: "destructive",
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }
  return error instanceof Error ? error.message : "Đã xảy ra lỗi khi xử lý kiểm kê.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function downloadCsv(audit: WarehouseStockAudit): void {
  const blob = new Blob([warehouseAuditToCsv(audit)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${audit.audit_code.toLowerCase()}-kiem-ke.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail?: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function DeadlineBucketRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {count} <span className="text-muted-foreground">({percentage}%)</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function AuditItemRow({
  item,
  selected,
  canSelect,
  onSelect,
}: {
  item: WarehouseStockItem;
  selected: boolean;
  canSelect: boolean;
  onSelect: (shipmentId: number, checked: boolean) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        {canSelect ? (
          <input
            type="checkbox"
            aria-label={`Chọn ${item.tracking_code} để đề xuất hoàn`}
            checked={selected}
            onChange={(event) => onSelect(item.shipment_id, event.target.checked)}
          />
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap font-medium">{item.tracking_code}</TableCell>
      <TableCell>{getShipmentStatusLabel(item.shipment_status)}</TableCell>
      <TableCell>
        <Badge variant={AUDIT_RESULT_VARIANTS[item.audit_result]}>
          {AUDIT_RESULT_LABELS[item.audit_result]}
        </Badge>
      </TableCell>
      <TableCell>{formatDate(item.storage_deadline)}</TableCell>
      <TableCell>{item.expected_warehouse_name}</TableCell>
      <TableCell>
        {item.scanned_warehouse_id === null
          ? "—"
          : WAREHOUSE_OPTIONS.find((warehouse) => warehouse.id === item.scanned_warehouse_id)?.name
            ?? `Kho #${item.scanned_warehouse_id}`}
      </TableCell>
      <TableCell>{formatDate(item.scanned_at)}</TableCell>
    </TableRow>
  );
}

export function WarehouseAuditPage() {
  const [audits, setAudits] = useState<WarehouseStockAudit[]>([]);
  const [audit, setAudit] = useState<WarehouseStockAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [scanWarehouseId, setScanWarehouseId] = useState("1");
  const [newAuditWarehouseId, setNewAuditWarehouseId] = useState("1");
  const [selectedShipments, setSelectedShipments] = useState<number[]>([]);
  const [returnReason, setReturnReason] = useState("");

  useEffect(() => {
    let active = true;
    void warehouseAuditApi
      .list()
      .then((rows) => {
        if (!active) return;
        setAudits(rows);
        setAudit(rows.find((row) => row.status === "open") ?? rows[0] ?? null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const statistics = useMemo(
    () => (audit ? getAuditStatistics(audit) : null),
    [audit],
  );
  const overdueItems = useMemo(
    () =>
      audit?.items.filter(
        (item) => getStorageDeadlineBucket(item.storage_deadline) === "overdue",
      ) ?? [],
    [audit],
  );
  const selectableOverdueItems = useMemo(
    () =>
      audit?.status === "open"
        ? overdueItems.filter(
            (item) => !audit.return_proposals.some((proposal) => proposal.shipment_id === item.shipment_id),
          )
        : [],
    [audit, overdueItems],
  );
  const selectedOverdueIds = useMemo(
    () => new Set(selectableOverdueItems.map((item) => item.shipment_id)),
    [selectableOverdueItems],
  );
  const selectedCount = selectedShipments.filter((id) => selectedOverdueIds.has(id)).length;

  async function selectAudit(id: number): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setAudit(await warehouseAuditApi.detail(id));
      setSelectedShipments([]);
      setReturnReason("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function createAudit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const created = await warehouseAuditApi.create({
        warehouse_id: Number(newAuditWarehouseId),
      });
      setAudit(created);
      setAudits((current) => [created, ...current]);
      setSelectedShipments([]);
      setReturnReason("");
      toast.success(`Đã mở phiên kiểm kê ${created.audit_code}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      toast.error(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function persistUpdate(
    update: Parameters<typeof warehouseAuditApi.update>[1],
  ): Promise<WarehouseStockAudit | null> {
    if (!audit) return null;
    setBusy(true);
    setError(null);
    try {
      const updated = await warehouseAuditApi.update(audit.id, update);
      setAudit(updated);
      setAudits((current) => current.map((row) => row.id === updated.id ? updated : row));
      return updated;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      toast.error(getErrorMessage(requestError));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleScan(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!audit) return;
    setBusy(true);
    setError(null);
    try {
      const scannedAudit = scanStockItem(audit, barcode, Number(scanWarehouseId));
      const updated = await warehouseAuditApi.update(
        audit.id,
        { items: scannedAudit.items },
      );
      setAudit(updated);
      setAudits((current) => current.map((row) => row.id === updated.id ? updated : row));
      const scanned = updated.items.find(
        (item) => item.tracking_code.toUpperCase() === barcode.trim().toUpperCase(),
      );
      if (scanned) toast.success(`${scanned.tracking_code}: ${AUDIT_RESULT_LABELS[scanned.audit_result]}.`);
      setBarcode("");
    } catch (scanError) {
      setError(getErrorMessage(scanError));
      toast.error(getErrorMessage(scanError));
    } finally {
      setBusy(false);
    }
  }

  async function finishAudit(): Promise<void> {
    if (!audit || !window.confirm("Kết thúc phiên kiểm kê? Các vận đơn chưa quét sẽ được ghi nhận là thiếu.")) {
      return;
    }
    const now = new Date().toISOString();
    await persistUpdate({
      status: "completed",
      completed_at: now,
      items: audit.items.map((item) =>
        item.audit_result === "pending"
          ? { ...item, audit_result: "missing" as const }
          : item,
      ),
    });
  }

  async function deleteAudit(): Promise<void> {
    if (!audit || !window.confirm(`Xóa phiên kiểm kê ${audit.audit_code}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await warehouseAuditApi.remove(audit.id);
      const remaining = audits.filter((row) => row.id !== audit.id);
      setAudits(remaining);
      setAudit(remaining.find((row) => row.status === "open") ?? remaining[0] ?? null);
      toast.success("Đã xóa phiên kiểm kê.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      toast.error(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function submitReturnProposal(): Promise<void> {
    if (!audit) return;
    const reason = returnReason.trim();
    if (!selectedCount || !reason) {
      toast.error("Chọn ít nhất một đơn quá hạn và nhập lý do đề xuất hoàn.");
      return;
    }
    const proposals: WarehouseReturnProposal[] = [
      ...audit.return_proposals,
      ...overdueItems
        .filter((item) => selectedShipments.includes(item.shipment_id))
        .filter((item) => !audit.return_proposals.some((proposal) => proposal.shipment_id === item.shipment_id))
        .map((item) => ({
          shipment_id: item.shipment_id,
          tracking_code: item.tracking_code,
          reason,
          proposed_at: new Date().toISOString(),
          status: "pending_review" as const,
        })),
    ];
    const updated = await persistUpdate({ return_proposals: proposals });
    if (updated) {
      setSelectedShipments([]);
      setReturnReason("");
      toast.success("Đã gửi đề xuất duyệt hoàn.");
    }
  }

  function toggleShipment(shipmentId: number, checked: boolean): void {
    setSelectedShipments((current) =>
      checked
        ? [...new Set([...current, shipmentId])]
        : current.filter((id) => id !== shipmentId),
    );
  }

  function selectAllOverdue(checked: boolean): void {
    setSelectedShipments((current) => {
      const withoutOverdue = current.filter((id) => !selectedOverdueIds.has(id));
      return checked
        ? [...withoutOverdue, ...selectableOverdueItems.map((item) => item.shipment_id)]
        : withoutOverdue;
    });
  }

  if (loading) {
    return <section className="space-y-4"><h1 className="text-2xl font-semibold">Kiểm kê kho</h1><p role="status">Đang tải dữ liệu kiểm kê…</p></section>;
  }

  return (
    <main className="min-w-0 space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kiểm kê hàng tồn kho</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đối chiếu vận đơn trong kho, theo dõi hạn lưu và đề xuất hoàn.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-52 space-y-1">
            <Label htmlFor="audit-select">Phiên kiểm kê</Label>
            <Select
              value={audit ? String(audit.id) : ""}
              onValueChange={(value) => void selectAudit(Number(value))}
              disabled={busy || audits.length === 0}
            >
              <SelectTrigger id="audit-select"><SelectValue placeholder="Chọn phiên" /></SelectTrigger>
              <SelectContent>
                {audits.map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {row.audit_code} · {row.status === "open" ? "Đang mở" : "Đã kết thúc"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48 space-y-1">
            <Label htmlFor="new-audit-warehouse">Kho kiểm kê mới</Label>
            <Select value={newAuditWarehouseId} onValueChange={setNewAuditWarehouseId}>
              <SelectTrigger id="new-audit-warehouse"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WAREHOUSE_OPTIONS.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => void createAudit()} disabled={busy}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Mở phiên
          </Button>
          <Button type="button" variant="outline" onClick={() => audit && downloadCsv(audit)} disabled={!audit}>
            <Download className="h-4 w-4" aria-hidden="true" /> Xuất CSV
          </Button>
          {audit && (
            <Button type="button" variant="destructive" onClick={() => void deleteAudit()} disabled={busy}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Xóa phiên
            </Button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {!audit ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Chưa có phiên kiểm kê. Hãy mở phiên mới để bắt đầu.</CardContent></Card>
      ) : (
        <>
          <section className="flex flex-col justify-between gap-2 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{audit.audit_code} · {audit.warehouse_name}</h2>
                <p className="text-sm text-muted-foreground">
                  Mở lúc {formatDate(audit.opened_at)}
                  {audit.completed_at ? ` · Kết thúc lúc ${formatDate(audit.completed_at)}` : ""}
                </p>
              </div>
            </div>
            {audit.status === "open" ? (
              <Button type="button" variant="outline" onClick={() => void finishAudit()} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Kết thúc kiểm kê
              </Button>
            ) : <Badge variant="secondary">Đã kết thúc</Badge>}
          </section>

          <section aria-label="Thống kê kết quả kiểm kê" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(AUDIT_RESULT_LABELS) as WarehouseAuditResult[]).map((result) => (
              <MetricCard key={result} title={AUDIT_RESULT_LABELS[result]} value={statistics?.auditResults[result] ?? 0} />
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Hạn lưu kho</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(Object.entries(STORAGE_DEADLINE_BUCKET_LABELS) as [keyof typeof STORAGE_DEADLINE_BUCKET_LABELS, string][]).map(([bucket, label]) => (
                  <DeadlineBucketRow
                    key={bucket}
                    label={label}
                    count={statistics?.deadlines[bucket] ?? 0}
                    total={audit.items.length}
                  />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Tồn kho theo trạng thái vận đơn</CardTitle></CardHeader>
              <CardContent>
                {statistics && Object.keys(statistics.shipmentStatuses).length > 0 ? (
                  <div className="divide-y">
                    {Object.entries(statistics.shipmentStatuses).map(([status, count]) => (
                      <div key={status} className="flex justify-between py-2 text-sm">
                        <span>{getShipmentStatusLabel(status)}</span><span className="font-semibold tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Chưa có vận đơn trong phiên.</p>}
              </CardContent>
            </Card>
          </section>

          {audit.status === "open" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Barcode className="h-4 w-4" aria-hidden="true" /> Quét barcode đối chiếu</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem_auto]" onSubmit={(event) => void handleScan(event)}>
                  <div className="space-y-1">
                    <Label htmlFor="audit-barcode">Mã vận đơn</Label>
                    <Input
                      id="audit-barcode"
                      autoComplete="off"
                      placeholder="Quét hoặc nhập mã vận đơn"
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="scan-warehouse">Vị trí đang quét</Label>
                    <Select value={scanWarehouseId} onValueChange={setScanWarehouseId}>
                      <SelectTrigger id="scan-warehouse"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WAREHOUSE_OPTIONS.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end"><Button type="submit" disabled={busy || !barcode.trim()}>Đối chiếu</Button></div>
                </form>
                <p className="mt-2 text-xs text-muted-foreground">
                  Quá hạn được ưu tiên phân loại là “Quá hạn lưu”; vị trí quét khác kho dự kiến sẽ ghi nhận “Sai kho”.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <CardTitle className="text-base">Danh sách vận đơn ({audit.items.length})</CardTitle>
                {selectableOverdueItems.length > 0 && (
                  <label className="flex items-center gap-2 text-sm font-normal">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả đơn quá hạn"
                      checked={selectedCount === selectableOverdueItems.length}
                      onChange={(event) => selectAllOverdue(event.target.checked)}
                    />
                    Chọn tất cả đơn quá hạn ({selectableOverdueItems.length})
                  </label>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {audit.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Phiên chưa có vận đơn.</p>
              ) : (
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><span className="sr-only">Chọn</span></TableHead>
                      <TableHead>Mã vận đơn</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Kết quả</TableHead>
                      <TableHead>Hạn lưu</TableHead>
                      <TableHead>Kho dự kiến</TableHead>
                      <TableHead>Kho quét</TableHead>
                      <TableHead>Thời điểm quét</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.items.map((item) => {
                      const canSelect = audit.status === "open"
                        && getStorageDeadlineBucket(item.storage_deadline) === "overdue"
                        && !audit.return_proposals.some((proposal) => proposal.shipment_id === item.shipment_id);
                      return (
                        <AuditItemRow
                          key={item.shipment_id}
                          item={item}
                          selected={selectedShipments.includes(item.shipment_id)}
                          canSelect={canSelect}
                          onSelect={toggleShipment}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {audit.status === "open" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" /> Đề xuất duyệt hoàn đơn quá hạn</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Đã chọn {selectedCount} đơn quá hạn. Đề xuất sẽ được lưu cùng phiên kiểm kê để chuyển quy trình duyệt hoàn.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="return-reason">Lý do đề xuất</Label>
                  <textarea
                    id="return-reason"
                    rows={3}
                    maxLength={1000}
                    placeholder="Nhập lý do đề nghị hoàn các đơn đã chọn"
                    value={returnReason}
                    onChange={(event) => setReturnReason(event.target.value)}
                    className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => void submitReturnProposal()}
                  disabled={busy || selectedCount === 0 || !returnReason.trim()}
                >
                  Gửi đề xuất duyệt hoàn
                </Button>
                {audit.return_proposals.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="text-sm font-semibold">Đề xuất đã gửi ({audit.return_proposals.length})</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {audit.return_proposals.map((proposal) => (
                        <li key={proposal.shipment_id}>
                          {proposal.tracking_code} · {proposal.reason} · {formatDate(proposal.proposed_at)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
