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
import {
  INT_UNSIGNED_MAX,
  TRANSPORT_MODE_OPTIONS,
} from "../constants/ops-config.constants";
import {
  branchRoutingRuleSchema,
  type BranchRoutingRuleFormInput,
  type BranchRoutingRuleFormOutput,
} from "../schemas/ops-config.schema";
import type {
  BranchRoutingRule,
  OpsConfigLookups,
} from "../types/ops-config.types";
import { applyOpsConfigFieldErrors } from "../utils/ops-config-errors";
import {
  OpsConfigCheckboxField,
  OpsConfigSelectField,
  OpsConfigTextField,
} from "./OpsConfigFormFields";

interface RoutingRuleDialogProps {
  open: boolean;
  record: BranchRoutingRule | null;
  lookups: OpsConfigLookups;
  lookupLoading: boolean;
  submitting: boolean;
  serverError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: BranchRoutingRuleFormOutput) => Promise<void>;
}

const DEFAULT_VALUES: BranchRoutingRuleFormInput = {
  origin_warehouse_id: "",
  destination_branch_id: "",
  next_hop_warehouse_id: "",
  transport_mode: "truck",
  estimated_transit_hours: "12",
  is_active: true,
};

function isActive(value: number | boolean) {
  return value === 1 || value === true;
}

export function RoutingRuleDialog({
  open,
  record,
  lookups,
  lookupLoading,
  submitting,
  serverError,
  onOpenChange,
  onSubmit,
}: RoutingRuleDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<
    BranchRoutingRuleFormInput,
    unknown,
    BranchRoutingRuleFormOutput
  >({
    resolver: zodResolver(branchRoutingRuleSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(
      record
        ? {
            origin_warehouse_id: String(record.origin_warehouse_id),
            destination_branch_id: String(record.destination_branch_id),
            next_hop_warehouse_id: String(record.next_hop_warehouse_id),
            transport_mode: record.transport_mode,
            estimated_transit_hours: String(record.estimated_transit_hours),
            is_active: record.is_active === 1,
          }
        : DEFAULT_VALUES,
    );
  }, [open, record, reset]);

  const branchOptions: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }> = lookups.branches.map((item) => ({
    value: String(item.id),
    label: `${item.code} — ${item.name}${isActive(item.is_active) ? "" : " (ngừng hoạt động)"}`,
  }));
  const warehouseOptions: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }> = lookups.warehouses.map((item) => ({
    value: String(item.id),
    label: `${item.code} — ${item.name}${isActive(item.is_active) ? "" : " (ngừng hoạt động)"}`,
  }));
  if (
    record &&
    !warehouseOptions.some(
      (option) => option.value === String(record.origin_warehouse_id),
    )
  ) {
    warehouseOptions.push({
      value: String(record.origin_warehouse_id),
      label: `Không có trong lookup (#${record.origin_warehouse_id})`,
      disabled: true,
    });
  }
  if (
    record &&
    !warehouseOptions.some(
      (option) => option.value === String(record.next_hop_warehouse_id),
    )
  ) {
    warehouseOptions.push({
      value: String(record.next_hop_warehouse_id),
      label: `Không có trong lookup (#${record.next_hop_warehouse_id})`,
      disabled: true,
    });
  }
  if (
    record &&
    !branchOptions.some(
      (option) => option.value === String(record.destination_branch_id),
    )
  ) {
    branchOptions.push({
      value: String(record.destination_branch_id),
      label: `Không có trong lookup (#${record.destination_branch_id})`,
      disabled: true,
    });
  }
  const errors = form.formState.errors;
  const submit = async (payload: BranchRoutingRuleFormOutput) => {
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
              {record ? "Chỉnh sửa quy tắc định tuyến" : "Thêm quy tắc định tuyến"}
            </DialogTitle>
            <DialogDescription>
              Tuyến mô tả kho xuất phát, chi nhánh đích và kho trung chuyển kế
              tiếp; kho kế tiếp không bắt buộc thuộc chi nhánh đích.
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
              name="origin_warehouse_id"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="routing-origin-warehouse"
                  label="Kho xuất phát"
                  value={String(field.value)}
                  onChange={field.onChange}
                  disabled={lookupLoading || submitting}
                  error={fieldState.error?.message}
                  options={warehouseOptions.map((option) => ({
                    ...option,
                    disabled:
                      !isActive(
                        lookups.warehouses.find(
                          (item) => String(item.id) === option.value,
                        )?.is_active ?? 0,
                      ) &&
                      option.value !== String(field.value),
                  }))}
                />
              )}
            />
            <Controller
              control={form.control}
              name="destination_branch_id"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="routing-destination-branch"
                  label="Chi nhánh/Bưu cục đích"
                  value={String(field.value)}
                  onChange={field.onChange}
                  disabled={lookupLoading || submitting}
                  error={fieldState.error?.message}
                  options={branchOptions.map((option) => ({
                    ...option,
                    disabled:
                      !isActive(
                        lookups.branches.find(
                          (item) => String(item.id) === option.value,
                        )?.is_active ?? 0,
                      ) &&
                      option.value !== String(field.value),
                  }))}
                />
              )}
            />
            <Controller
              control={form.control}
              name="next_hop_warehouse_id"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="routing-next-hop-warehouse"
                  label="Kho trung chuyển kế tiếp"
                  value={String(field.value)}
                  onChange={field.onChange}
                  disabled={lookupLoading || submitting}
                  error={fieldState.error?.message}
                  options={warehouseOptions.map((option) => ({
                    ...option,
                    disabled:
                      (!isActive(
                        lookups.warehouses.find(
                          (item) => String(item.id) === option.value,
                        )?.is_active ?? 0,
                      ) &&
                        option.value !== String(field.value)) ||
                      option.value === form.watch("origin_warehouse_id"),
                  }))}
                />
              )}
            />
            <Controller
              control={form.control}
              name="transport_mode"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="routing-transport-mode"
                  label="Phương thức vận chuyển"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  error={fieldState.error?.message}
                  options={TRANSPORT_MODE_OPTIONS}
                />
              )}
            />
            <OpsConfigTextField
              id="routing-transit-hours"
              label="Thời gian trung chuyển dự kiến (giờ)"
              type="number"
              min={1}
              max={INT_UNSIGNED_MAX}
              step={1}
              inputMode="numeric"
              disabled={submitting}
              register={form.register("estimated_transit_hours")}
              error={errors.estimated_transit_hours?.message}
            />
            <OpsConfigCheckboxField
              id="routing-is-active"
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
