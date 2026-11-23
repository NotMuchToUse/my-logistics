import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  pricingTariffSchema,
  serviceTypeSchema,
  surchargeSchema,
  valueAddedServiceSchema,
  weightConversionRuleSchema,
} from "../schemas/pricing-catalog.schema";
import { FEE_TYPES, ZONE_TYPES } from "../constants/pricing-catalog.constants";

export type CatalogKind =
  | "service_types"
  | "value_added_services"
  | "surcharges"
  | "pricing_tariffs"
  | "weight_conversion_rules";

interface CatalogCrudDialogProps {
  kind: CatalogKind;
  open: boolean;
  record: Record<string, unknown> | null;
  submitting: boolean;
  serverError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

const TITLES: Record<CatalogKind, string> = {
  service_types: "dịch vụ chính",
  value_added_services: "dịch vụ gia tăng",
  surcharges: "phụ phí",
  pricing_tariffs: "bảng giá",
  weight_conversion_rules: "quy tắc quy đổi trọng lượng",
};

function defaultValues(kind: CatalogKind): Record<string, unknown> {
  switch (kind) {
    case "service_types":
      return { code: "", name: "", description: "", estimated_days_min: 1, estimated_days_max: 1, is_active: true };
    case "value_added_services":
      return { code: "", name: "", fee_type: "fixed", fee_value: 0, min_fee: 0, max_fee: 0, is_active: true };
    case "surcharges":
      return { code: "", name: "", fee_type: "fixed", fee_value: 0, is_auto_applied: false, is_active: true };
    case "pricing_tariffs":
      return { service_type_id: 1, zone_type: "intra_province", min_weight_gram: 0, max_weight_gram: 1000, base_price: 0, step_weight_gram: 500, step_price: 0, effective_from: "2026-01-01", effective_to: null, is_active: true };
    case "weight_conversion_rules":
      return { service_type_id: 1, divisor: 5000, min_chargeable_gram: 1000, effective_from: "2026-01-01", effective_to: null, is_active: true };
  }
}

function schemaFor(kind: CatalogKind): z.ZodType {
  switch (kind) {
    case "service_types": return serviceTypeSchema;
    case "value_added_services": return valueAddedServiceSchema;
    case "surcharges": return surchargeSchema;
    case "pricing_tariffs": return pricingTariffSchema;
    case "weight_conversion_rules": return weightConversionRuleSchema;
  }
}

export function CatalogCrudDialog({
  kind,
  open,
  record,
  submitting,
  serverError,
  onOpenChange,
  onSubmit,
}: CatalogCrudDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>(defaultValues(kind));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(record ? { ...record, id: undefined } : defaultValues(kind));
    setErrors({});
  }, [open, kind, record]);

  const setValue = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const normalizedValues = {
      ...values,
      effective_to:
        values.effective_to === ""
          ? null
          : values.effective_to,
    };
    const parsed = schemaFor(kind).safeParse(normalizedValues);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data as Record<string, unknown>);
  };

  const fieldError = (key: string) =>
    errors[key] ? <p role="alert" className="text-sm text-destructive">{errors[key]}</p> : null;

  const textField = (key: string, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`${kind}-${key}`}>{label}</Label>
      <Input
        id={`${kind}-${key}`}
        type={type}
        value={String(values[key] ?? "")}
        onChange={(event) => setValue(key, type === "number" ? event.target.value : event.target.value)}
        disabled={submitting}
      />
      {fieldError(key)}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{record ? "Chỉnh sửa" : "Thêm"} {TITLES[kind]}</DialogTitle>
          <DialogDescription>
            Nhập thông tin {TITLES[kind]} theo dữ liệu danh mục.
          </DialogDescription>
        </DialogHeader>
        {serverError ? <p role="alert" className="text-sm text-destructive">{serverError}</p> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(kind === "service_types" || kind === "value_added_services" || kind === "surcharges") ? (
            <>
              {textField("code", "Mã danh mục")}
              {textField("name", "Tên danh mục")}
            </>
          ) : null}

          {kind === "service_types" ? (
            <>
              {textField("description", "Mô tả")}
              {textField("estimated_days_min", "Số ngày tối thiểu", "number")}
              {textField("estimated_days_max", "Số ngày tối đa", "number")}
            </>
          ) : null}

          {kind === "value_added_services" ? (
            <>
              <div className="space-y-2">
                <Label>Loại tính phí</Label>
                <Select value={String(values.fee_type)} onValueChange={(value) => setValue("fee_type", value)} disabled={submitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
                {fieldError("fee_type")}
              </div>
              {textField("fee_value", "Giá trị phí", "number")}
              {textField("min_fee", "Phí tối thiểu", "number")}
              {textField("max_fee", "Phí tối đa", "number")}
            </>
          ) : null}

          {kind === "surcharges" ? (
            <>
              <div className="space-y-2">
                <Label>Loại tính phí</Label>
                <Select value={String(values.fee_type)} onValueChange={(value) => setValue("fee_type", value)} disabled={submitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
                {fieldError("fee_type")}
              </div>
              {textField("fee_value", "Giá trị phụ phí", "number")}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={values.is_auto_applied === true || values.is_auto_applied === 1} onChange={(event) => setValue("is_auto_applied", event.target.checked)} disabled={submitting} />
                Tự động áp dụng
              </label>
            </>
          ) : null}

          {kind === "pricing_tariffs" ? (
            <>
              {textField("service_type_id", "Mã dịch vụ", "number")}
              <div className="space-y-2">
                <Label>Vùng áp dụng</Label>
                <Select value={String(values.zone_type)} onValueChange={(value) => setValue("zone_type", value)} disabled={submitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ZONE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
                {fieldError("zone_type")}
              </div>
              {textField("min_weight_gram", "Trọng lượng tối thiểu (gram)", "number")}
              {textField("max_weight_gram", "Trọng lượng tối đa (gram)", "number")}
              {textField("base_price", "Giá cơ bản", "number")}
              {textField("step_weight_gram", "Mức bước trọng lượng", "number")}
              {textField("step_price", "Giá mỗi bước", "number")}
              {textField("effective_from", "Ngày bắt đầu")}
              {textField("effective_to", "Ngày kết thúc")}
            </>
          ) : null}

          {kind === "weight_conversion_rules" ? (
            <>
              {textField("service_type_id", "Mã dịch vụ", "number")}
              {textField("divisor", "Divisor", "number")}
              {textField("min_chargeable_gram", "Trọng lượng tính cước tối thiểu", "number")}
              {textField("effective_from", "Ngày bắt đầu")}
              {textField("effective_to", "Ngày kết thúc")}
            </>
          ) : null}

          {(kind !== "pricing_tariffs" && kind !== "weight_conversion_rules") ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={values.is_active === true || values.is_active === 1} onChange={(event) => setValue("is_active", event.target.checked)} disabled={submitting} />
              Đang hoạt động
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={values.is_active === true || values.is_active === 1} onChange={(event) => setValue("is_active", event.target.checked)} disabled={submitting} />
              Đang hoạt động
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Hủy</Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
