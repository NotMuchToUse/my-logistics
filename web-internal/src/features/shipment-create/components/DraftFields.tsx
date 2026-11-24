import { Controller, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShipmentOptions } from "../hooks/useShipmentOptions";
import type { CatalogResource } from "../api/shipment-create.api";
import type { ShipmentDraft } from "../schemas/shipment-create.schema";

export function DraftInput({ name, label, numeric = false, decimal = false }: { name: FieldPath<ShipmentDraft>; label: string; numeric?: boolean; decimal?: boolean }) {
  const { register, getFieldState, formState } = useFormContext<ShipmentDraft>();
  const error = getFieldState(name, formState).error;
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} className="text-base sm:text-sm" type={numeric ? "number" : "text"} step={numeric ? "any" : undefined} inputMode={numeric || decimal ? "decimal" : name.endsWith("phone") ? "tel" : undefined} {...register(name, numeric ? { valueAsNumber: true } : {})} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} />{error && <p id={`${name}-error`} role="alert" className="text-sm text-destructive">{error.message}</p>}</div>;
}

export function DraftSelect({ name, label, resource, parentId = null, onChange }: { name: FieldPath<ShipmentDraft>; label: string; resource: CatalogResource; parentId?: number | null; onChange?: () => void }) {
  const { control } = useFormContext<ShipmentDraft>();
  const options = useShipmentOptions(resource, parentId);
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Controller name={name} control={control} render={({ field, fieldState }) => <><Select value={typeof field.value === "number" && field.value > 0 ? String(field.value) : ""} onValueChange={(value) => { field.onChange(Number(value)); onChange?.(); }} disabled={options.loading || options.error || options.rows.length === 0}><SelectTrigger id={name} ref={field.ref} onBlur={field.onBlur} aria-invalid={!!fieldState.error}><SelectValue placeholder="Chọn một giá trị" /></SelectTrigger><SelectContent>{options.rows.map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.name}</SelectItem>)}</SelectContent></Select>{fieldState.error && <p role="alert" className="text-sm text-destructive">{fieldState.error.message}</p>}</>} />{options.loading && <Skeleton className="h-4 w-full" />}{options.error && <div role="alert" className="text-sm">Không tải được danh mục. <Button type="button" variant="outline" onClick={options.retry}>Thử lại</Button></div>}</div>;
}

export function ContactFields({ side, title }: { side: "sender" | "receiver"; title: string }) {
  const { control, setValue } = useFormContext<ShipmentDraft>();
  const provinceId = useWatch({ control, name: `${side}.provinceId` });
  const districtId = useWatch({ control, name: `${side}.districtId` });
  return <section className="space-y-4 rounded-lg border p-4 sm:p-6"><h2 className="font-semibold">{title}</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><DraftInput name={`${side}.name`} label="Họ và tên" /><DraftInput name={`${side}.phone`} label="Số điện thoại" /><DraftSelect name={`${side}.provinceId`} label="Tỉnh/Thành phố" resource="provinces" onChange={() => { setValue(`${side}.districtId`, 0); setValue(`${side}.wardId`, 0); }} /><DraftSelect name={`${side}.districtId`} label="Quận/Huyện" resource="districts" parentId={provinceId} onChange={() => setValue(`${side}.wardId`, 0)} /><DraftSelect name={`${side}.wardId`} label="Phường/Xã" resource="wards" parentId={districtId} /><DraftInput name={`${side}.addressDetail`} label="Địa chỉ chi tiết" /></div></section>;
}
