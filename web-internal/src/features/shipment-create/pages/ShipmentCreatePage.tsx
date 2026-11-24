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
import { useShipmentOptions } from "../hooks/useShipmentOptions";

const emptyContact = { name: "", phone: "", provinceId: 0, districtId: 0, wardId: 0, addressDetail: "" };
const emptyParcel = () => ({ lengthCm: Number.NaN, widthCm: Number.NaN, heightCm: Number.NaN, actualWeightGram: Number.NaN });

export function ShipmentCreatePage() {
  const branchId = useBranchScopeStore((state) => state.activeBranchId);
  const roles = useAuthStore((state) => state.roles);
  const form = useForm<ShipmentDraft>({ resolver: zodResolver(shipmentDraftSchema), defaultValues: { sender: { ...emptyContact }, receiver: { ...emptyContact }, parcels: [emptyParcel()], serviceTypeId: 0, selectedVasIds: [], codAmount: "0", declaredValue: "0", paymentMethod: "ngttn" } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "parcels" });
  const values = useWatch({ control: form.control });
  const summary = summarizeParcels(values.parcels ?? []);
  const vas = useShipmentOptions("value-added-services");
  const [validation, setValidation] = useState<{ snapshot: string; valid: boolean } | null>(null);
  const snapshot = JSON.stringify({ values, branchId });
  const dirty = form.formState.isDirty;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Production permission must be confirmed before exposing the business flow.
  if (!USE_MOCK || !roles.some((role) => role === "receptionist" || role === "coordinator")) return <section className="space-y-4"><h1 className="text-xl font-semibold sm:text-2xl">Tạo vận đơn</h1><p role="status">Chức năng chưa sẵn sàng cho tài khoản này. Vui lòng liên hệ quản trị viên.</p></section>;

  return <FormProvider {...form}><form noValidate className="space-y-6 text-sm" onSubmit={(event) => { event.preventDefault(); void form.trigger().then((valid) => setValidation({ snapshot, valid })); }}>
    <header><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Tạo vận đơn</h1><p className="text-muted-foreground">Nhập thông tin gửi nhận và chi tiết từng kiện hàng.</p></header>
    <div role="status" className="rounded-md border bg-muted p-4">Bản thử nghiệm nhập liệu với địa giới minh họa. Chưa tính cước, thu tiền hoặc tạo vận đơn. Dữ liệu chưa được lưu.</div>
    {branchId === null && <p role="alert" className="text-destructive">Vui lòng chọn chi nhánh trên thanh điều hướng.</p>}
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="min-w-0 space-y-6">
      <ContactFields side="sender" title="Người gửi" /><ContactFields side="receiver" title="Người nhận" />
      <section className="space-y-4 rounded-lg border p-4 sm:p-6"><h2 className="font-semibold">Kiện hàng</h2>{fields.map((field, index) => <fieldset key={field.id} className="min-w-0 space-y-4 rounded-md border p-4"><legend className="px-2 font-medium">Kiện {index + 1}</legend><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><DraftInput name={`parcels.${index}.lengthCm`} label="Dài (cm)" numeric /><DraftInput name={`parcels.${index}.widthCm`} label="Rộng (cm)" numeric /><DraftInput name={`parcels.${index}.heightCm`} label="Cao (cm)" numeric /><DraftInput name={`parcels.${index}.actualWeightGram`} label="Trọng lượng thực (gram)" numeric /></div><Button type="button" variant="outline" disabled={fields.length === 1} onClick={() => remove(index)} aria-label={`Xóa kiện ${index + 1}`}><Trash2 className="mr-2 h-4 w-4" />Xóa kiện</Button></fieldset>)}<Button type="button" variant="outline" onClick={() => append(emptyParcel())}><Plus className="mr-2 h-4 w-4" />Thêm kiện hàng</Button></section>
      <section className="space-y-4 rounded-lg border p-4 sm:p-6"><h2 className="font-semibold">Dịch vụ và hàng hóa</h2><DraftSelect name="serviceTypeId" label="Dịch vụ chính" resource="service-types" /><p className="text-muted-foreground">Danh mục loại hàng hóa chưa sẵn sàng.</p><Label htmlFor="draft-vas">Dịch vụ gia tăng</Label><Select value="" disabled={vas.loading || vas.error} onValueChange={(id) => { const ids = form.getValues("selectedVasIds"); if (!ids.includes(Number(id))) form.setValue("selectedVasIds", [...ids, Number(id)], { shouldDirty: true, shouldValidate: true }); }}><SelectTrigger id="draft-vas"><SelectValue placeholder="Thêm dịch vụ gia tăng" /></SelectTrigger><SelectContent>{vas.rows.filter((row) => !values.selectedVasIds?.includes(row.id)).map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.name}</SelectItem>)}</SelectContent></Select>{vas.error && <p role="alert">Không tải được DVGT. <Button type="button" variant="outline" onClick={vas.retry}>Thử lại</Button></p>}<ul className="space-y-2">{(values.selectedVasIds ?? []).map((id) => <li key={id} className="flex items-center justify-between gap-2">{vas.rows.find((row) => row.id === id)?.name ?? "Dịch vụ đã chọn"}<Button type="button" variant="outline" onClick={() => form.setValue("selectedVasIds", form.getValues("selectedVasIds").filter((value) => value !== id), { shouldDirty: true })}>Bỏ chọn</Button></li>)}</ul><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><DraftInput name="codAmount" label="Tiền thu hộ COD (đ)" decimal /><DraftInput name="declaredValue" label="Giá trị khai báo (đ)" decimal /></div></section>
      <section className="space-y-4 rounded-lg border p-4 sm:p-6"><h2 className="font-semibold">Thanh toán</h2><Label htmlFor="payment-method">Hình thức thanh toán cước</Label><Select value={values.paymentMethod} onValueChange={(value) => { const parsed = shipmentDraftSchema.shape.paymentMethod.safeParse(value); if (parsed.success) form.setValue("paymentMethod", parsed.data, { shouldDirty: true }); }}><SelectTrigger id="payment-method"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((method) => <SelectItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</SelectItem>)}</SelectContent></Select><p className="text-muted-foreground">Chưa hỗ trợ xác nhận đã thu cước hoặc kiểm tra điều kiện trả sau.</p></section>
    </div><aside className="h-fit space-y-4 rounded-lg border p-4 sm:p-6" aria-live="polite"><h2 className="font-semibold">Tóm tắt</h2><dl className="space-y-3"><dt>Số kiện</dt><dd className="tabular-nums text-right">{summary.count}</dd><dt>Trọng lượng thực</dt><dd className="tabular-nums text-right">{summary.actualWeightGram === null ? "Chưa hợp lệ" : `${summary.actualWeightGram.toLocaleString("vi-VN")} g`}</dd><dt>Trọng lượng quy đổi / tính cước</dt><dd>Chưa có kết quả</dd><dt>Tổng cước vận chuyển</dt><dd>Chưa có kết quả tính cước</dd><dt>COD (riêng với cước)</dt><dd className="break-all tabular-nums text-right">{values.codAmount || "Chưa nhập"} đ</dd></dl></aside></div>
    {validation?.snapshot === snapshot && <p role="status">{validation.valid ? "Thông tin nhập đã qua kiểm tra cơ bản. Chưa gửi hoặc tạo vận đơn." : "Vui lòng sửa các trường được đánh dấu."}</p>}
    <footer className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end"><Button type="submit" variant="outline">Kiểm tra thông tin nhập</Button><Button type="button" disabled>Tạo vận đơn — chưa sẵn sàng</Button></footer>
  </form></FormProvider>;
}
