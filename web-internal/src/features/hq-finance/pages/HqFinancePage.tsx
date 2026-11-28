import { useCallback, useEffect, useState } from "react";
import {
  Check,
  FileImage,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  createCustomerInvoice,
  deleteCustomerInvoice,
  getCustomerInvoices,
  getRemittances,
  settleCustomerInvoice,
  verifyRemittance,
} from "../api/hq-finance.api";
import type {
  CustomerInvoice,
  CustomerInvoiceInput,
  Remittance,
  RemittanceVerificationInput,
} from "../types/hq-finance.types";

const CURRENCY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function HqFinancePage() {
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState<Remittance | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [remittanceRows, invoiceRows] = await Promise.all([
        getRemittances(),
        getCustomerInvoices(),
      ]);
      setRemittances(remittanceRows);
      setInvoices(invoiceRows);
    } catch (error) {
      const message = getErrorMessage(error, "Không thể tải dữ liệu kế toán.");
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleVerify(input: RemittanceVerificationInput) {
    if (!reviewing) return;
    try {
      const updated = await verifyRemittance(reviewing.public_id, input);
      setRemittances((current) =>
        current.map((row) =>
          row.public_id === updated.public_id ? updated : row,
        ),
      );
      setReviewing(null);
      toast.success(
        input.status === "verified"
          ? "Đã xác nhận nhận tiền."
          : "Đã từ chối phiếu nộp tiền.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể cập nhật phiếu nộp tiền."));
    }
  }

  async function handleCreateInvoice(input: CustomerInvoiceInput) {
    setSavingInvoice(true);
    try {
      const created = await createCustomerInvoice(input);
      setInvoices((current) => [created, ...current]);
      setCreateOpen(false);
      toast.success("Đã tạo đối soát công nợ khách hàng.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo đối soát công nợ."));
    } finally {
      setSavingInvoice(false);
    }
  }

  async function handleDeleteInvoice(invoice: CustomerInvoice) {
    if (!window.confirm(`Xóa đối soát của ${invoice.customer_name}?`)) return;
    setBusyInvoiceId(invoice.public_id);
    try {
      await deleteCustomerInvoice(invoice.public_id);
      setInvoices((current) =>
        current.filter((row) => row.public_id !== invoice.public_id),
      );
      toast.success("Đã xóa đối soát công nợ.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xóa đối soát công nợ."));
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function handleSettleInvoice(invoice: CustomerInvoice) {
    setBusyInvoiceId(invoice.public_id);
    try {
      const updated = await settleCustomerInvoice(invoice.public_id);
      setInvoices((current) =>
        current.map((row) =>
          row.public_id === updated.public_id ? updated : row,
        ),
      );
      toast.success("Đã xác nhận tất toán công nợ.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xác nhận tất toán."));
    } finally {
      setBusyInvoiceId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Kế toán Trung tâm
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Duyệt nộp tiền từ mạng lưới và đối soát công nợ khách hàng trả sau
            NGTTS.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setLoadError("");
            setRefreshing(true);
            void loadData();
          }}
          disabled={loading || refreshing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Làm mới
        </Button>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{loadError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoadError("");
              setRefreshing(true);
              void loadData();
            }}
          >
            Thử lại
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="remittances" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="remittances">Duyệt nộp tiền</TabsTrigger>
          <TabsTrigger value="invoices">Công nợ khách hàng NGTTS</TabsTrigger>
        </TabsList>

        <TabsContent value="remittances">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-medium">Phiếu nộp tiền</h2>
                <p className="text-xs text-muted-foreground">
                  Bưu cục / Chi nhánh nộp tiền về Trung tâm
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {remittances.length} phiếu
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Mã phiếu</th>
                    <th scope="col" className="px-4 py-3 font-medium">Bưu cục / Chi nhánh</th>
                    <th scope="col" className="px-4 py-3 font-medium">Số tiền</th>
                    <th scope="col" className="px-4 py-3 font-medium">Ngày nộp</th>
                    <th scope="col" className="px-4 py-3 font-medium">Trạng thái</th>
                    <th scope="col" className="px-4 py-3 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {remittances.map((row) => (
                    <tr key={row.public_id}>
                      <td className="px-4 py-3 font-medium">{row.public_id}</td>
                      <td className="px-4 py-3">
                        <p>{row.branch_name ?? `Chi nhánh #${row.branch_id}`}</p>
                        {row.branch_code ? (
                          <p className="text-xs text-muted-foreground">
                            {row.branch_code}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {formatMoney(row.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(row.submitted_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewing(row)}
                        >
                          <FileImage className="mr-2 h-4 w-4" aria-hidden="true" />
                          {row.status === "submitted" ? "Kiểm tra" : "Xem"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!loading && remittances.length === 0 ? (
                    <EmptyRow colSpan={6} message="Chưa có phiếu nộp tiền." />
                  ) : null}
                  {loading && remittances.length === 0 ? (
                    <EmptyRow colSpan={6} message="Đang tải phiếu nộp tiền..." />
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="invoices">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <h2 className="font-medium">Đối soát công nợ khách hàng</h2>
                <p className="text-xs text-muted-foreground">
                  Tất toán theo kỳ đối soát NGTTS
                </p>
              </div>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Tạo đối soát
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Khách hàng</th>
                    <th scope="col" className="px-4 py-3 font-medium">Kỳ</th>
                    <th scope="col" className="px-4 py-3 font-medium">Cước NGTTS</th>
                    <th scope="col" className="px-4 py-3 font-medium">COD thu hộ</th>
                    <th scope="col" className="px-4 py-3 font-medium">Cấn trừ đền bù</th>
                    <th scope="col" className="px-4 py-3 font-medium">Số dư tất toán</th>
                    <th scope="col" className="px-4 py-3 font-medium">Trạng thái</th>
                    <th scope="col" className="px-4 py-3 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((invoice) => (
                    <tr key={invoice.public_id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{invoice.customer_name}</p>
                        {invoice.customer_id ? (
                          <p className="text-xs text-muted-foreground">
                            {invoice.customer_id}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {invoice.billing_period}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatMoney(invoice.ngtts_freight_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatMoney(invoice.cod_collected_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatMoney(invoice.compensation_offset_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        {formatMoney(invoice.settlement_balance)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {invoice.status !== "settled" ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleSettleInvoice(invoice)}
                              disabled={busyInvoiceId === invoice.public_id}
                            >
                              <Check className="mr-1 h-4 w-4" aria-hidden="true" />
                              Tất toán
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`Xóa đối soát ${invoice.customer_name}`}
                            onClick={() => void handleDeleteInvoice(invoice)}
                            disabled={
                              invoice.status === "settled" ||
                              busyInvoiceId === invoice.public_id
                            }
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && invoices.length === 0 ? (
                    <EmptyRow colSpan={8} message="Chưa có đối soát công nợ." />
                  ) : null}
                  {loading && invoices.length === 0 ? (
                    <EmptyRow colSpan={8} message="Đang tải đối soát công nợ..." />
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <RemittanceReviewDialog
        key={reviewing?.public_id ?? "closed"}
        remittance={reviewing}
        onOpenChange={(open) => {
          if (!open) setReviewing(null);
        }}
        onSubmit={handleVerify}
      />
      {createOpen ? (
        <CustomerInvoiceDialog
          open={createOpen}
          submitting={savingInvoice}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreateInvoice}
        />
      ) : null}
    </section>
  );
}

function RemittanceReviewDialog({
  remittance,
  onOpenChange,
  onSubmit,
}: {
  remittance: Remittance | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: RemittanceVerificationInput) => Promise<void>;
}) {
  const [journalRef, setJournalRef] = useState(remittance?.journal_ref ?? "");
  const [note, setNote] = useState(remittance?.note ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(status: "verified" | "rejected") {
    if (!remittance) return;
    if (status === "verified" && !journalRef.trim()) {
      setError("Vui lòng nhập mã bút toán.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        status,
        journal_ref: journalRef.trim() || null,
        note: note.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const receiptUrl = remittance?.receipt_image_url
    ? getSafeHttpUrl(remittance.receipt_image_url)
    : null;
  const canVerify = remittance?.status === "submitted";

  return (
    <Dialog open={remittance !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {remittance ? (
          <>
            <DialogHeader>
              <DialogTitle>Phiếu nộp tiền {remittance.public_id}</DialogTitle>
              <DialogDescription>
                {remittance.branch_name ?? `Chi nhánh #${remittance.branch_id}`} ·{" "}
                {formatMoney(remittance.amount)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="overflow-hidden rounded-md border bg-muted/30">
                {receiptUrl ? (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Mở ảnh biên lai trong tab mới"
                  >
                    <img
                      src={receiptUrl}
                      alt={`Biên lai phiếu nộp tiền ${remittance.public_id}`}
                      className="max-h-[45vh] w-full object-contain"
                    />
                  </a>
                ) : (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {remittance.receipt_image_url
                      ? "URL ảnh biên lai không hợp lệ."
                      : "Phiếu này chưa có ảnh biên lai."}
                  </p>
                )}
              </div>
              {!canVerify ? (
                <div className="space-y-2 text-sm">
                  <StatusBadge status={remittance.status} />
                  {remittance.journal_ref ? (
                    <p>Mã bút toán: {remittance.journal_ref}</p>
                  ) : null}
                  {remittance.note ? <p>Ghi chú: {remittance.note}</p> : null}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="hq-journal-ref">Mã bút toán</Label>
                    <Input
                      id="hq-journal-ref"
                      value={journalRef}
                      onChange={(event) => setJournalRef(event.target.value)}
                      maxLength={100}
                      placeholder="Nhập mã bút toán"
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hq-remittance-note">Ghi chú</Label>
                    <textarea
                      id="hq-remittance-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      maxLength={1000}
                      disabled={submitting}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Ghi chú xác nhận hoặc lý do từ chối..."
                    />
                  </div>
                  {error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void submit("rejected")}
                      disabled={submitting}
                    >
                      Từ chối
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void submit("verified")}
                      disabled={submitting}
                    >
                      <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                      Xác nhận đã nhận tiền
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CustomerInvoiceDialog({
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CustomerInvoiceInput) => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("");
  const [freightAmount, setFreightAmount] = useState("");
  const [codAmount, setCodAmount] = useState("0");
  const [compensationAmount, setCompensationAmount] = useState("0");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const freight = Number(freightAmount);
    const cod = Number(codAmount);
    const compensation = Number(compensationAmount);
    if (
      !customerName.trim() ||
      !billingPeriod ||
      !Number.isFinite(freight) ||
      freight < 0 ||
      !Number.isFinite(cod) ||
      cod < 0 ||
      !Number.isFinite(compensation) ||
      compensation < 0
    ) {
      setError("Vui lòng nhập đầy đủ thông tin và số tiền không âm.");
      return;
    }
    setError("");
    await onSubmit({
      customer_id: customerId.trim() || null,
      customer_name: customerName.trim(),
      billing_period: billingPeriod,
      ngtts_freight_amount: freight,
      cod_collected_amount: cod,
      compensation_offset_amount: compensation,
      settlement_balance: freight - cod - compensation,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tạo đối soát công nợ NGTTS</DialogTitle>
          <DialogDescription>
            Số dư tất toán được tính bằng cước NGTTS trừ COD thu hộ và khoản
            cấn trừ đền bù.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-customer-id">Mã khách hàng (không bắt buộc)</Label>
              <Input
                id="invoice-customer-id"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-customer-name">Tên khách hàng</Label>
              <Input
                id="invoice-customer-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-period">Kỳ đối soát</Label>
              <Input
                id="invoice-period"
                type="month"
                value={billingPeriod}
                onChange={(event) => setBillingPeriod(event.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <AmountField
              id="invoice-freight"
              label="Cước NGTTS"
              value={freightAmount}
              onChange={setFreightAmount}
              disabled={submitting}
            />
            <AmountField
              id="invoice-cod"
              label="COD thu hộ"
              value={codAmount}
              onChange={setCodAmount}
              disabled={submitting}
            />
            <AmountField
              id="invoice-compensation"
              label="Cấn trừ đền bù"
              value={compensationAmount}
              onChange={setCompensationAmount}
              disabled={submitting}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Số dư tất toán dự kiến:{" "}
            <strong className="text-foreground">
              {formatMoney(
                (Number(freightAmount) || 0) -
                  (Number(codAmount) || 0) -
                  (Number(compensationAmount) || 0),
              )}
            </strong>
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Tạo đối soát"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AmountField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={disabled}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: "Nháp",
    submitted: "Chờ duyệt",
    verified: "Đã nhận tiền",
    rejected: "Đã từ chối",
    open: "Chưa tất toán",
    settled: "Đã tất toán",
  };
  const className =
    status === "verified" || status === "settled"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <Badge variant="outline" className={className}>
      {labels[status] ?? status}
    </Badge>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

function formatMoney(value: number): string {
  return CURRENCY_FORMATTER.format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function getSafeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
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
  return error instanceof Error ? error.message : fallback;
}
