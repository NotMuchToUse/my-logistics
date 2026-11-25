import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INT_UNSIGNED_MAX, ROUTE_SCOPE_OPTIONS } from "../constants/ops-config.constants";
import {
  slaDeadlineSchema,
  type SlaDeadlineFormInput,
  type SlaDeadlineFormOutput,
} from "../schemas/ops-config.schema";
import type { OpsConfigLookups, SlaDeadline } from "../types/ops-config.types";
import { applyOpsConfigFieldErrors } from "../utils/ops-config-errors";
import {
  OpsConfigCheckboxField,
  OpsConfigSelectField,
  OpsConfigTextField,
} from "./OpsConfigFormFields";

interface SlaDeadlineDialogProps {
  open: boolean;
  record: SlaDeadline | null;
  lookups: OpsConfigLookups;
  lookupLoading: boolean;
  submitting: boolean;
  serverError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SlaDeadlineFormOutput) => Promise<void>;
}

const DEFAULT_VALUES: SlaDeadlineFormInput = {
  service_type_id: "",
  route_scope: "intra_province",
  pickup_sla_minutes: "180",
  warehouse_inbound_sla_minutes: "240",
  linehaul_sla_hours: "24",
  delivery_sla_hours: "36",
  max_storage_days_before_return: "5",
  is_active: true,
};

export function SlaDeadlineDialog({
  open,
  record,
  lookups,
  lookupLoading,
  submitting,
  serverError,
  onOpenChange,
  onSubmit,
}: SlaDeadlineDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<
    SlaDeadlineFormInput,
    unknown,
    SlaDeadlineFormOutput
  >({
    resolver: zodResolver(slaDeadlineSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(
      record
        ? {
            service_type_id: String(record.service_type_id),
            route_scope: record.route_scope,
            pickup_sla_minutes: String(record.pickup_sla_minutes),
            warehouse_inbound_sla_minutes: String(
              record.warehouse_inbound_sla_minutes,
            ),
            linehaul_sla_hours: String(record.linehaul_sla_hours),
            delivery_sla_hours: String(record.delivery_sla_hours),
            max_storage_days_before_return: String(
              record.max_storage_days_before_return,
            ),
            is_active: record.is_active === 1,
          }
        : DEFAULT_VALUES,
    );
  }, [open, record, reset]);

  const fieldError = (name: keyof SlaDeadlineFormInput) =>
    form.formState.errors[name]?.message;
  const submit = async (payload: SlaDeadlineFormOutput) => {
    setSubmitError(null);
    try {
      await onSubmit(payload);
    } catch (error) {
      setSubmitError(applyOpsConfigFieldErrors(form, error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(submit)(event);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {record ? "Chỉnh sửa SLA Deadline" : "Thêm SLA Deadline"}
            </DialogTitle>
            <DialogDescription>
              Thời hạn mặc định được khởi tạo theo schema; API thật hiện chưa
              được xác nhận.
            </DialogDescription>
          </DialogHeader>

          {submitError ?? serverError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError ?? serverError}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="service_type_id"
              render={({ field, fieldState }) => (
                (() => {
                  const options = lookups.service_types.map((item) => ({
                    value: String(item.id),
                    label: `${item.code} — ${item.name}${item.is_active === 1 || item.is_active === true ? "" : " (ngừng hoạt động)"}`,
                    disabled:
                      item.is_active !== 1 &&
                      item.is_active !== true &&
                      String(item.id) !== String(field.value),
                  }));
                  if (
                    field.value &&
                    !options.some(
                      (option) => option.value === String(field.value),
                    )
                  ) {
                    options.push({
                      value: String(field.value),
                      label: `Không có trong lookup (#${field.value})`,
                      disabled: true,
                    });
                  }
                  return (
                    <OpsConfigSelectField
                      id="sla-service-type"
                      label="Dịch vụ chính"
                      value={String(field.value)}
                      onChange={field.onChange}
                      disabled={lookupLoading || submitting}
                      error={fieldState.error?.message}
                      options={options}
                    />
                  );
                })()
              )}
            />
            <Controller
              control={form.control}
              name="route_scope"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="sla-route-scope"
                  label="Phạm vi tuyến"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  disabled={submitting}
                  options={ROUTE_SCOPE_OPTIONS}
                />
              )}
            />
            <OpsConfigTextField
              id="sla-pickup-minutes"
              label="SLA lấy hàng (phút)"
              type="number"
              min={1}
              max={INT_UNSIGNED_MAX}
              step={1}
              inputMode="numeric"
              disabled={submitting}
              register={form.register("pickup_sla_minutes")}
              error={fieldError("pickup_sla_minutes")}
            />
            <OpsConfigTextField
              id="sla-warehouse-inbound-minutes"
              label="SLA nhập kho (phút)"
              type="number"
              min={1}
              max={INT_UNSIGNED_MAX}
              step={1}
              inputMode="numeric"
              disabled={submitting}
              register={form.register("warehouse_inbound_sla_minutes")}
              error={fieldError("warehouse_inbound_sla_minutes")}
            />
            <OpsConfigTextField
              id="sla-linehaul-hours"
              label="SLA trung chuyển (giờ)"
              type="number"
              min={1}
              max={INT_UNSIGNED_MAX}
              step={1}
              inputMode="numeric"
              disabled={submitting}
              register={form.register("linehaul_sla_hours")}
              error={fieldError("linehaul_sla_hours")}
            />
            <OpsConfigTextField
              id="sla-delivery-hours"
              label="SLA giao hàng (giờ)"
              type="number"
              min={1}
              max={INT_UNSIGNED_MAX}
              step={1}
              inputMode="numeric"
              disabled={submitting}
              register={form.register("delivery_sla_hours")}
              error={fieldError("delivery_sla_hours")}
            />
            <OpsConfigTextField
              id="sla-max-storage-days"
              label="Hạn lưu kho trước chuyển hoàn (ngày)"
              type="number"
              min={1}
              max={INT_UNSIGNED_MAX}
              step={1}
              inputMode="numeric"
              disabled={submitting}
              register={form.register("max_storage_days_before_return")}
              error={fieldError("max_storage_days_before_return")}
            />
            <OpsConfigCheckboxField
              id="sla-is-active"
              label="Đang áp dụng"
              register={form.register("is_active")}
              disabled={submitting}
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting || form.formState.isSubmitting}
            >
              {submitting || form.formState.isSubmitting
                ? "Đang lưu..."
                : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
