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
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "../constants/ops-config.constants";
import {
  vehicleSchema,
  type VehicleFormInput,
  type VehicleFormOutput,
} from "../schemas/ops-config.schema";
import type { OpsConfigLookups, Vehicle } from "../types/ops-config.types";
import { applyOpsConfigFieldErrors } from "../utils/ops-config-errors";
import { OpsConfigSelectField, OpsConfigTextField } from "./OpsConfigFormFields";

interface VehicleDialogProps {
  open: boolean;
  record: Vehicle | null;
  lookups: OpsConfigLookups;
  lookupLoading: boolean;
  submitting: boolean;
  serverError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: VehicleFormOutput) => Promise<void>;
}

const DEFAULT_VALUES: VehicleFormInput = {
  branch_id: "",
  partner_id: "",
  plate_number: "",
  vehicle_type: "van",
  max_payload_kg: "1000.00",
  default_driver_id: "",
  status: "available",
};

function isActive(value: number | boolean) {
  return value === 1 || value === true;
}

export function VehicleDialog({
  open,
  record,
  lookups,
  lookupLoading,
  submitting,
  serverError,
  onOpenChange,
  onSubmit,
}: VehicleDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<VehicleFormInput, unknown, VehicleFormOutput>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { reset } = form;
  const errors = form.formState.errors;

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(
      record
        ? {
            branch_id: String(record.branch_id),
            partner_id:
              record.partner_id === null ? "" : String(record.partner_id),
            plate_number: record.plate_number,
            vehicle_type: record.vehicle_type,
            max_payload_kg: record.max_payload_kg,
            default_driver_id:
              record.default_driver_id === null
                ? ""
                : String(record.default_driver_id),
            status: record.status,
          }
        : DEFAULT_VALUES,
    );
  }, [open, record, reset]);

  const submit = async (payload: VehicleFormOutput) => {
    setSubmitError(null);
    try {
      await onSubmit(payload);
    } catch (error) {
      setSubmitError(applyOpsConfigFieldErrors(form, error));
    }
  };

  const branchOptions = lookups.branches.map((item) => ({
    value: String(item.id),
    label: `${item.code} — ${item.name}${isActive(item.is_active) ? "" : " (ngừng hoạt động)"}`,
    disabled:
      !isActive(item.is_active) &&
      String(item.id) !== String(record?.branch_id ?? ""),
  }));
  const partnerOptions = lookups.partners.map((item) => ({
    value: String(item.id),
    label: `${item.code} — ${item.name}${isActive(item.is_active) ? "" : " (ngừng hoạt động)"}`,
    disabled:
      !isActive(item.is_active) &&
      String(item.id) !== String(record?.partner_id ?? ""),
  }));
  if (
    record &&
    !branchOptions.some(
      (option) => option.value === String(record.branch_id),
    )
  ) {
    branchOptions.push({
      value: String(record.branch_id),
      label: `Không có trong lookup (#${record.branch_id})`,
      disabled: true,
    });
  }
  if (
    record?.partner_id !== null &&
    record?.partner_id !== undefined &&
    !partnerOptions.some(
      (option) => option.value === String(record.partner_id),
    )
  ) {
    partnerOptions.push({
      value: String(record.partner_id),
      label: `Không có trong lookup (#${record.partner_id})`,
      disabled: true,
    });
  }
  const driverOptions = lookups.drivers
    .filter((driver) =>
      driver.roles.some((role) =>
        ["pickup_delivery_driver", "linehaul_driver"].includes(role),
      ),
    )
    .map((driver) => ({
      value: String(driver.id),
      label: `${driver.full_name}${driver.status === "active" && isActive(driver.is_active) ? "" : " (không hoạt động)"}`,
      disabled:
        (driver.status !== "active" || !isActive(driver.is_active)) &&
        String(driver.id) !== String(record?.default_driver_id ?? ""),
    }));

  if (
    record?.default_driver_id !== null &&
    record?.default_driver_id !== undefined &&
    !driverOptions.some(
      (option) => option.value === String(record.default_driver_id),
    )
  ) {
    driverOptions.push({
      value: String(record.default_driver_id),
      label: `Tài xế ${record.default_driver_id} (không có trong lookup)`,
      disabled: true,
    });
  }

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
              {record ? "Chỉnh sửa phương tiện" : "Thêm phương tiện"}
            </DialogTitle>
            <DialogDescription>
              Dữ liệu driver, branch và partner chỉ lấy từ lookup hiện có.
              Chuyển trạng thái trong Mock Mode không xác lập state machine
              chính thức.
            </DialogDescription>
          </DialogHeader>

          {submitError ?? serverError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError ?? serverError}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsConfigTextField
              id="vehicle-plate-number"
              label="Biển số / Mã hiệu"
              disabled={submitting}
              register={form.register("plate_number")}
              error={errors.plate_number?.message}
            />
            <Controller
              control={form.control}
              name="vehicle_type"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="vehicle-type"
                  label="Loại phương tiện"
                  value={field.value === null ? "" : String(field.value)}
                  onChange={field.onChange}
                  disabled={submitting}
                  error={fieldState.error?.message}
                  options={VEHICLE_TYPE_OPTIONS}
                />
              )}
            />
            <Controller
              control={form.control}
              name="branch_id"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="vehicle-branch"
                  label="Chi nhánh quản lý"
                  value={field.value === null ? "" : String(field.value)}
                  onChange={field.onChange}
                  disabled={lookupLoading || submitting}
                  error={fieldState.error?.message}
                  options={branchOptions}
                />
              )}
            />
            <Controller
              control={form.control}
              name="partner_id"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="vehicle-partner"
                  label="Đối tác vận chuyển"
                  value={field.value === null ? "" : String(field.value)}
                  onChange={field.onChange}
                  disabled={lookupLoading || submitting}
                  error={fieldState.error?.message}
                  placeholder="Phương tiện công ty"
                  options={partnerOptions}
                />
              )}
            />
            <OpsConfigTextField
              id="vehicle-max-payload"
              label="Tải trọng tối đa (kg)"
              type="number"
              min={0.01}
              max={99_999_999.99}
              step={0.01}
              inputMode="decimal"
              disabled={submitting}
              register={form.register("max_payload_kg")}
              error={errors.max_payload_kg?.message}
            />
            <Controller
              control={form.control}
              name="default_driver_id"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="vehicle-default-driver"
                  label="Tài xế mặc định (không bắt buộc)"
                  value={field.value === null ? "" : String(field.value)}
                  onChange={field.onChange}
                  disabled={lookupLoading || submitting}
                  error={fieldState.error?.message}
                  placeholder="Chưa gán tài xế"
                  options={driverOptions}
                />
              )}
            />
            <Controller
              control={form.control}
              name="status"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="vehicle-status"
                  label="Trạng thái"
                  value={field.value === null ? "" : String(field.value)}
                  onChange={field.onChange}
                  disabled={submitting}
                  error={fieldState.error?.message}
                  options={VEHICLE_STATUS_OPTIONS}
                />
              )}
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
