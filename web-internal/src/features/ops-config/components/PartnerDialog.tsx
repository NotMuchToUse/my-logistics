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
import { PARTNER_TYPE_OPTIONS } from "../constants/ops-config.constants";
import {
  thirdPartyPartnerSchema,
  type ThirdPartyPartnerFormInput,
  type ThirdPartyPartnerFormOutput,
} from "../schemas/ops-config.schema";
import type { ThirdPartyPartner } from "../types/ops-config.types";
import { applyOpsConfigFieldErrors } from "../utils/ops-config-errors";
import {
  OpsConfigCheckboxField,
  OpsConfigSelectField,
  OpsConfigTextField,
} from "./OpsConfigFormFields";

interface PartnerDialogProps {
  open: boolean;
  record: ThirdPartyPartner | null;
  submitting: boolean;
  serverError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ThirdPartyPartnerFormOutput) => Promise<void>;
}

const DEFAULT_VALUES: ThirdPartyPartnerFormInput = {
  code: "",
  name: "",
  partner_type: "linehaul_carrier",
  contact_person: "",
  contact_phone: "",
  api_endpoint: "",
  is_active: true,
};

export function PartnerDialog({
  open,
  record,
  submitting,
  serverError,
  onOpenChange,
  onSubmit,
}: PartnerDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<
    ThirdPartyPartnerFormInput,
    unknown,
    ThirdPartyPartnerFormOutput
  >({
    resolver: zodResolver(thirdPartyPartnerSchema),
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
            code: record.code,
            name: record.name,
            partner_type: record.partner_type,
            contact_person: record.contact_person ?? "",
            contact_phone: record.contact_phone ?? "",
            api_endpoint: record.api_endpoint ?? "",
            is_active: record.is_active === 1,
          }
        : DEFAULT_VALUES,
    );
  }, [open, record, reset]);

  const submit = async (payload: ThirdPartyPartnerFormOutput) => {
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
              {record ? "Chỉnh sửa đối tác 3PL" : "Thêm đối tác 3PL"}
            </DialogTitle>
            <DialogDescription>
              Chỉ lưu cấu hình endpoint; trình duyệt không gọi URL đối tác.
            </DialogDescription>
          </DialogHeader>

          {submitError ?? serverError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError ?? serverError}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsConfigTextField
              id="partner-code"
              label="Mã đối tác"
              disabled={submitting}
              register={form.register("code")}
              error={errors.code?.message}
            />
            <OpsConfigTextField
              id="partner-name"
              label="Tên đối tác"
              disabled={submitting}
              register={form.register("name")}
              error={errors.name?.message}
            />
            <Controller
              control={form.control}
              name="partner_type"
              render={({ field, fieldState }) => (
                <OpsConfigSelectField
                  id="partner-type"
                  label="Loại đối tác"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  error={fieldState.error?.message}
                  options={PARTNER_TYPE_OPTIONS}
                />
              )}
            />
            <OpsConfigTextField
              id="partner-contact-person"
              label="Người liên hệ (không bắt buộc)"
              disabled={submitting}
              register={form.register("contact_person")}
              error={errors.contact_person?.message}
            />
            <OpsConfigTextField
              id="partner-contact-phone"
              label="Số điện thoại (không bắt buộc)"
              type="tel"
              inputMode="tel"
              disabled={submitting}
              register={form.register("contact_phone")}
              error={errors.contact_phone?.message}
            />
            <OpsConfigTextField
              id="partner-api-endpoint"
              label="API endpoint (không bắt buộc)"
              type="url"
              inputMode="url"
              disabled={submitting}
              register={form.register("api_endpoint")}
              error={errors.api_endpoint?.message}
            />
            <OpsConfigCheckboxField
              id="partner-is-active"
              label="Đang hợp tác"
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
