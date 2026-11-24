import { useEffect, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { USE_MOCK } from "@/core/api/axiosClient";
import { ContactFields, DraftInput, DraftSelect } from "../components/DraftFields";
import { shipmentDraftSchema, type ShipmentDraft } from "../schemas/shipment-create.schema";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../constants/shipment-create.constants";
import { summarizeParcels } from "../utils/shipment-create.utils";
import {
  calculateMockShipmentQuote,
  canMockCollectAtCounter,
  getMockCargoCategory,
  getMockFreightPaymentStatus,
  getMockRouteFixture,
  getMockServiceTypeName,
  MOCK_PRICE_ADJUSTMENTS,
  type MockFreightPaymentStatus,
  type MockShipmentCreateResult,
} from "../api/shipment-create.mock";
import { createShipment as submitShipment } from "../api/shipment-create.api";
import { useShipmentOptions } from "../hooks/useShipmentOptions";

const emptyContact = { name: "", phone: "", provinceId: 0, districtId: 0, wardId: 0, addressDetail: "" };
const emptyParcel = () => ({ lengthCm: Number.NaN, widthCm: Number.NaN, heightCm: Number.NaN, actualWeightGram: Number.NaN });
const paymentStatusLabels: Record<MockFreightPaymentStatus, string> = {
  unpaid: "Chưa thu cước",
  paid_at_counter: "Đã thu tại quầy",
  collected_by_driver: "Tài xế thu",
  invoiced_postpaid: "Ghi nợ trả sau",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatWeight(value: number) {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} g`;
}

export function ShipmentCreatePage() {
  const branchId = useBranchScopeStore((state) => state.activeBranchId);
  const roles = useAuthStore((state) => state.roles);
  const form = useForm<ShipmentDraft>({
    resolver: zodResolver(shipmentDraftSchema),
    defaultValues: {
      sender: { ...emptyContact },
      receiver: { ...emptyContact },
      parcels: [emptyParcel()],
      serviceTypeId: 0,
      cargoCategoryId: 0,
      selectedVasIds: [],
      codAmount: "0",
      declaredValue: "0",
      paymentMethod: "ngttn",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "parcels" });
  useWatch({ control: form.control });
  const values = form.getValues();
  const summary = summarizeParcels(values.parcels ?? []);
  const vas = useShipmentOptions("value-added-services");
  const quote = USE_MOCK ? calculateMockShipmentQuote(values) : null;
  const route = USE_MOCK ? getMockRouteFixture(values.sender.provinceId, values.receiver.provinceId) : null;
  const cargoCategory = USE_MOCK ? getMockCargoCategory(values.cargoCategoryId) : null;
  const canCollectAtCounter = USE_MOCK && canMockCollectAtCounter(roles);
  const [counterCollected, setCounterCollected] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
  const [createdRecord, setCreatedRecord] = useState<{ snapshot: string; result: MockShipmentCreateResult } | null>(null);
  const [submissionIssue, setSubmissionIssue] = useState<{ snapshot: string; message: string } | null>(null);
  const snapshot = JSON.stringify({ values, branchId });
  const previewIsCurrent = previewSnapshot === snapshot;
  const createdShipment = createdRecord?.snapshot === snapshot ? createdRecord.result : null;
  const submissionError = submissionIssue?.snapshot === snapshot ? submissionIssue.message : null;
  const dirty = form.formState.isDirty;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (!USE_MOCK || !roles.some((role) => role === "receptionist" || role === "coordinator")) return <section className="space-y-4"><h1 className="text-xl font-semibold sm:text-2xl">Tạo vận đơn</h1><p role="status">Chức năng chưa sẵn sàng cho tài khoản này. Vui lòng liên hệ quản trị viên.</p></section>;

  const previewShipment = async () => {
    const valid = await form.trigger();
    if (!valid) {
      setSubmissionIssue({ snapshot, message: "Vui lòng sửa các trường được đánh dấu trước khi xem trước." });
      return;
    }
    if (branchId === null) {
      setSubmissionIssue({ snapshot, message: "Vui lòng chọn chi nhánh trên thanh điều hướng." });
      return;
    }
    if (!quote) {
      setSubmissionIssue({ snapshot, message: "Chưa có fixture bảng giá phù hợp cho tuyến và dịch vụ đã chọn." });
      return;
    }
    setSubmissionIssue(null);
    setPreviewSnapshot(snapshot);
  };

  const onCreateShipment = form.handleSubmit(async (draft) => {
    if (!previewIsCurrent || !quote) {
      setSubmissionIssue({ snapshot, message: "Vui lòng xem trước lại vận đơn sau khi thay đổi thông tin." });
      return;
    }
    setSubmissionIssue(null);
    try {
      const result = await submitShipment(draft, counterCollected);
      setCreatedRecord({ snapshot, result });
    } catch (error) {
      setSubmissionIssue({
        snapshot,
        message: error instanceof Error ? error.message : "Không thể tạo vận đơn Mock.",
      });
    }
  });

  return (
    <FormProvider {...form}>
      <form noValidate className="space-y-6 text-sm" onSubmit={onCreateShipment}>
        <header>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Tạo vận đơn</h1>
          <p className="text-muted-foreground">Nhập thông tin gửi nhận và chi tiết từng kiện hàng.</p>
        </header>
        <div role="status" className="rounded-md border bg-muted p-4">
          MOCK ONLY — Báo giá, tuyến, giảm giá 5%, VAT 8% và phân quyền thu cước là fixture để kiểm thử, chưa được Backend/Leader xác nhận.
          Không gửi request tạo đơn hoặc thu tiền thật; kết quả tạo chỉ tồn tại trong phiên hiện tại.
        </div>
        {branchId === null && <p role="alert" className="text-destructive">Vui lòng chọn chi nhánh trên thanh điều hướng.</p>}
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <ContactFields side="sender" title="Người gửi" onPriceChange={() => setCounterCollected(false)} />
            <ContactFields side="receiver" title="Người nhận" onPriceChange={() => setCounterCollected(false)} />
            <section className="space-y-4 rounded-lg border p-4 sm:p-6">
              <h2 className="font-semibold">Kiện hàng</h2>
              {fields.map((field, index) => (
                <fieldset key={field.id} className="min-w-0 space-y-4 rounded-md border p-4">
                  <legend className="px-2 font-medium">Kiện {index + 1}</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DraftInput name={`parcels.${index}.lengthCm`} label="Dài (cm)" numeric onValueChange={() => setCounterCollected(false)} />
                    <DraftInput name={`parcels.${index}.widthCm`} label="Rộng (cm)" numeric onValueChange={() => setCounterCollected(false)} />
                    <DraftInput name={`parcels.${index}.heightCm`} label="Cao (cm)" numeric onValueChange={() => setCounterCollected(false)} />
                    <DraftInput name={`parcels.${index}.actualWeightGram`} label="Trọng lượng thực (gram)" numeric onValueChange={() => setCounterCollected(false)} />
                  </div>
                  <Button type="button" variant="outline" disabled={fields.length === 1} onClick={() => { remove(index); setCounterCollected(false); }} aria-label={`Xóa kiện ${index + 1}`}>
                    <Trash2 className="mr-2 h-4 w-4" />Xóa kiện
                  </Button>
                </fieldset>
              ))}
              <Button type="button" variant="outline" onClick={() => { append(emptyParcel()); setCounterCollected(false); }}>
                <Plus className="mr-2 h-4 w-4" />Thêm kiện hàng
              </Button>
            </section>
            <section className="space-y-4 rounded-lg border p-4 sm:p-6">
              <h2 className="font-semibold">Dịch vụ và hàng hóa</h2>
              <DraftSelect name="serviceTypeId" label="Dịch vụ chính" resource="service-types" onChange={() => setCounterCollected(false)} />
              <DraftSelect name="cargoCategoryId" label="Loại hàng hóa" resource="cargo-categories" />
              {cargoCategory?.requires_special_handling ? (
                <p role="status" className="rounded-md bg-muted p-3">Loại hàng này cần xử lý đặc biệt (fixture Mock).</p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="draft-vas">Dịch vụ gia tăng</Label>
                <Select
                  value=""
                  disabled={vas.loading || !!vas.error}
                  onValueChange={(id) => {
                    const ids = form.getValues("selectedVasIds");
                    if (!ids.includes(Number(id))) {
                      form.setValue("selectedVasIds", [...ids, Number(id)], { shouldDirty: true, shouldValidate: true });
                      setCounterCollected(false);
                    }
                  }}
                >
                  <SelectTrigger id="draft-vas"><SelectValue placeholder="Thêm dịch vụ gia tăng" /></SelectTrigger>
                  <SelectContent>
                    {vas.rows.filter((row) => !values.selectedVasIds.includes(row.id)).map((row) => (
                      <SelectItem key={row.id} value={String(row.id)}>{row.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {vas.error && <p role="alert">Không tải được DVGT. <Button type="button" variant="outline" onClick={vas.retry}>Thử lại</Button></p>}
                <ul className="space-y-2">
                  {values.selectedVasIds.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-2">
                      {vas.rows.find((row) => row.id === id)?.name ?? "Dịch vụ đã chọn"}
                      <Button type="button" variant="outline" onClick={() => { form.setValue("selectedVasIds", form.getValues("selectedVasIds").filter((value) => value !== id), { shouldDirty: true, shouldValidate: true }); setCounterCollected(false); }}>Bỏ chọn</Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DraftInput name="codAmount" label="Tiền thu hộ COD (đ)" decimal />
                <DraftInput name="declaredValue" label="Giá trị khai báo (đ)" decimal onValueChange={() => setCounterCollected(false)} />
              </div>
            </section>
            <section className="space-y-4 rounded-lg border p-4 sm:p-6">
              <h2 className="font-semibold">Thanh toán</h2>
              <Label htmlFor="payment-method">Hình thức thanh toán cước</Label>
              <Select
                value={values.paymentMethod}
                onValueChange={(value) => {
                  const parsed = shipmentDraftSchema.shape.paymentMethod.safeParse(value);
                  if (parsed.success) {
                    form.setValue("paymentMethod", parsed.data, { shouldDirty: true, shouldValidate: true });
                    setCounterCollected(false);
                  }
                }}
              >
                <SelectTrigger id="payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {values.paymentMethod === "ngttn" && canCollectAtCounter ? (
                <label className="flex items-start gap-2 rounded-md border p-3">
                  <input
                    type="checkbox"
                    checked={counterCollected}
                    disabled={createdShipment !== null}
                    onChange={(event) => setCounterCollected(event.target.checked)}
                    aria-label="Xác nhận đã thu cước tại quầy"
                  />
                  <span>Xác nhận đã thu cước tại quầy (mô phỏng quyền Tiếp tân)</span>
                </label>
              ) : values.paymentMethod === "ngttn" ? (
                <p role="status">Fixture Mock: Điều phối viên không có quyền thu cước tại quầy; quyền chính thức đang chờ Leader xác nhận.</p>
              ) : (
                <p className="text-muted-foreground">Không thu cước tại quầy cho phương thức này; trạng thái chỉ được mô phỏng.</p>
              )}
            </section>
          </div>
          <aside className="h-fit space-y-4 rounded-lg border p-4 sm:p-6" aria-live="polite">
            <h2 className="font-semibold">Tóm tắt và báo giá Mock</h2>
            <dl className="space-y-2">
              <dt>Số kiện</dt><dd className="text-right tabular-nums">{summary.count}</dd>
              <dt>Trọng lượng thực</dt>
              <dd className="text-right tabular-nums">{summary.actualWeightGram === null ? "Chưa hợp lệ" : formatWeight(summary.actualWeightGram)}</dd>
              <dt>Trọng lượng quy đổi</dt>
              <dd className="text-right tabular-nums">{quote ? formatWeight(quote.volumetricWeightGram) : "Chưa có kết quả"}</dd>
              <dt>Trọng lượng tính cước</dt>
              <dd className="text-right tabular-nums">{quote ? formatWeight(quote.chargeableWeightGram) : "Chưa có kết quả"}</dd>
              <dt>Tuyến Mock</dt><dd className="text-right">{quote?.route.label ?? "Chưa xác định"}</dd>
            </dl>
            {quote ? (
              <dl className="space-y-2 border-t pt-3">
                <dt>Cước chính</dt><dd className="text-right tabular-nums">{formatCurrency(quote.baseFreight)}</dd>
                {quote.surcharges.map((row) => (
                  <div key={row.code} className="flex justify-between gap-2"><dt>{row.name}</dt><dd className="text-right tabular-nums">{formatCurrency(row.amount)}</dd></div>
                ))}
                {quote.valueAddedServices.map((row) => (
                  <div key={row.code} className="flex justify-between gap-2"><dt>{row.name}</dt><dd className="text-right tabular-nums">{formatCurrency(row.amount)}</dd></div>
                ))}
                <dt>Chiết khấu Mock ({MOCK_PRICE_ADJUSTMENTS.discountPercent}%)</dt><dd className="text-right tabular-nums">−{formatCurrency(quote.discount)}</dd>
                <dt>VAT Mock ({MOCK_PRICE_ADJUSTMENTS.vatPercent}%)</dt><dd className="text-right tabular-nums">{formatCurrency(quote.vat)}</dd>
                <dt className="border-t pt-2 font-semibold">Tổng cước vận chuyển</dt>
                <dd className="text-right font-semibold tabular-nums">{formatCurrency(quote.totalFreight)}</dd>
              </dl>
            ) : (
              <p role="status" className="text-muted-foreground">
                {!route && values.sender.provinceId > 0 && values.receiver.provinceId > 0
                  ? "Chưa có route fixture cho cặp địa giới này."
                  : "Chọn tuyến, dịch vụ và nhập kiện hợp lệ để xem báo giá."}
              </p>
            )}
            <div className="border-t pt-3">
              <p className="font-medium">COD (không cộng vào cước)</p>
              <p className="text-right tabular-nums">{formatCurrency(Number(values.codAmount) || 0)}</p>
            </div>
          </aside>
        </div>
        {previewIsCurrent && quote && (
          <section className="space-y-2 rounded-lg border p-4 sm:p-6" aria-labelledby="shipment-preview-title">
            <h2 id="shipment-preview-title" className="font-semibold">Xem trước vận đơn (Mock-only)</h2>
            <p>{values.sender.name} → {values.receiver.name}</p>
            <p>{getMockServiceTypeName(values.serviceTypeId)} · {cargoCategory?.name ?? "Chưa rõ loại hàng"} · {quote.route.label}</p>
            <p>{quote.route.zoneType} · {summary.count} kiện · {formatWeight(quote.chargeableWeightGram)}</p>
            <p>Tổng cước: {formatCurrency(quote.totalFreight)} · COD riêng: {formatCurrency(quote.codAmount)}</p>
            <p>Trạng thái thu cước mô phỏng: {paymentStatusLabels[getMockFreightPaymentStatus(values.paymentMethod, counterCollected)]}</p>
          </section>
        )}
        {submissionError && <p role="alert" className="text-destructive">{submissionError}</p>}
        {createdShipment && (
          <p role="status" className="rounded-md border border-green-600 p-4">
            Tạo vận đơn Mock thành công: {createdShipment.mockPublicId}. Trạng thái cước: {paymentStatusLabels[createdShipment.freightPaymentStatus]}. Không có dữ liệu nào được gửi hoặc lưu trên Backend.
          </p>
        )}
        <footer className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => void previewShipment()}>Xem trước vận đơn</Button>
          <Button type="submit" disabled={!previewIsCurrent || !quote || branchId === null || form.formState.isSubmitting || createdShipment !== null}>
            {form.formState.isSubmitting ? "Đang tạo Mock…" : createdShipment ? "Đã tạo vận đơn Mock" : "Tạo vận đơn Mock"}
          </Button>
        </footer>
      </form>
    </FormProvider>
  );
}
