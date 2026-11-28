import { Controller } from "react-hook-form";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DialogContentProps } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShipmentInheritedInfo } from "@/features/shipment-exceptions/components/ShipmentInheritedInfo";
import type { useShipmentExceptions } from "@/features/shipment-exceptions/hooks/useShipmentExceptions";

type ShipmentExceptionsHookState = ReturnType<typeof useShipmentExceptions>;

export type ForwardShipmentDialogProps = Pick<
  ShipmentExceptionsHookState,
  | "selectedShipment"
  | "selectedShipmentPublicId"
  | "inheritedInfo"
  | "inheritedInfoStatus"
  | "capabilities"
  | "catalogAvailable"
  | "catalogUnavailableReason"
> &
  Pick<
    ShipmentExceptionsHookState["forwardDialog"],
    | "isOpen"
    | "onClose"
    | "unavailableReason"
    | "canCreate"
    | "form"
    | "formState"
    | "validate"
  > & {
    onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
  };

const FORWARD_PREVIEW_BLOCKED_REASON =
  "Chưa thể xác nhận chuyển tiếp. Danh mục địa giới, chi nhánh đích và điều kiện kết nối Backend chưa được xác nhận đầy đủ.";

function hasValidPublicId(value: string): boolean {
  return value.trim().length > 0 && value.trim() === value;
}

export function ForwardShipmentDialog({
  isOpen,
  selectedShipment,
  selectedShipmentPublicId,
  inheritedInfo,
  inheritedInfoStatus,
  capabilities,
  catalogAvailable,
  catalogUnavailableReason,
  onClose,
  onCloseAutoFocus,
  unavailableReason,
  form,
  formState,
  validate,
}: ForwardShipmentDialogProps) {
  const hasConsistentSelection =
    selectedShipment !== null &&
    selectedShipmentPublicId !== null &&
    hasValidPublicId(selectedShipment.public_id) &&
    selectedShipment.public_id === selectedShipmentPublicId &&
    (selectedShipment.status === "delivery_failed" ||
      selectedShipment.status === "pending_return");
  const canShowPreview =
    isOpen &&
    hasConsistentSelection &&
    capabilities.canOpenForwardModal;

  if (!canShowPreview || selectedShipment === null) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const reason =
    unavailableReason.trim() || FORWARD_PREVIEW_BLOCKED_REASON;
  const catalogReason =
    catalogUnavailableReason.trim() ||
    "Danh mục địa giới và chi nhánh đích chưa khả dụng.";
  const { errors } = formState;

  return (
    <Dialog open={canShowPreview} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby="forward-shipment-description"
        className="w-[95vw] max-w-3xl"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>Tạo vận đơn chuyển tiếp</DialogTitle>
          <DialogDescription id="forward-shipment-description">
            Nhập thông tin người nhận mới trong giao diện xem trước.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ShipmentInheritedInfo
            selectedShipment={selectedShipment}
            inheritedInfo={inheritedInfo}
            inheritedInfoStatus={inheritedInfoStatus}
          />

          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            noValidate
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="space-y-2">
              <Label htmlFor="forward-recipient-name">
                Họ và tên người nhận
              </Label>
              <Input
                id="forward-recipient-name"
                autoComplete="off"
                placeholder="Nhập họ và tên người nhận"
                aria-invalid={Boolean(errors.recipient_name)}
                aria-describedby={
                  errors.recipient_name
                    ? "forward-recipient-name-error"
                    : undefined
                }
                {...form.register("recipient_name")}
              />
              {errors.recipient_name && (
                <p
                  className="text-sm text-destructive"
                  id="forward-recipient-name-error"
                  role="alert"
                >
                  {errors.recipient_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="forward-recipient-phone">
                Số điện thoại
              </Label>
              <Input
                id="forward-recipient-phone"
                type="tel"
                autoComplete="off"
                placeholder="Nhập số điện thoại người nhận mới"
                aria-invalid={Boolean(errors.recipient_phone)}
                aria-describedby={
                  errors.recipient_phone
                    ? "forward-recipient-phone-error"
                    : undefined
                }
                {...form.register("recipient_phone")}
              />
              {errors.recipient_phone && (
                <p
                  className="text-sm text-destructive"
                  id="forward-recipient-phone-error"
                  role="alert"
                >
                  {errors.recipient_phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="forward-recipient-address">
                Địa chỉ chi tiết
              </Label>
              <Input
                id="forward-recipient-address"
                autoComplete="off"
                placeholder="Nhập số nhà, tên đường..."
                aria-invalid={Boolean(errors.recipient_address)}
                aria-describedby={
                  errors.recipient_address
                    ? "forward-recipient-address-error"
                    : undefined
                }
                {...form.register("recipient_address")}
              />
              {errors.recipient_address && (
                <p
                  className="text-sm text-destructive"
                  id="forward-recipient-address-error"
                  role="alert"
                >
                  {errors.recipient_address.message}
                </p>
              )}
            </div>

            <Controller
              control={form.control}
              name="recipient_province_id"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="forward-recipient-province">
                    Tỉnh / Thành phố
                  </Label>
                  <Select
                    disabled={!catalogAvailable}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="forward-recipient-province"
                      aria-invalid={Boolean(errors.recipient_province_id)}
                    >
                      <SelectValue placeholder="Chưa có danh mục tỉnh/thành" />
                    </SelectTrigger>
                  </Select>
                  {errors.recipient_province_id && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.recipient_province_id.message}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="recipient_district_id"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="forward-recipient-district">
                    Quận / Huyện
                  </Label>
                  <Select
                    disabled={!catalogAvailable}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="forward-recipient-district"
                      aria-invalid={Boolean(errors.recipient_district_id)}
                    >
                      <SelectValue placeholder="Chưa có danh mục quận/huyện" />
                    </SelectTrigger>
                  </Select>
                  {errors.recipient_district_id && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.recipient_district_id.message}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="recipient_ward_id"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="forward-recipient-ward">
                    Phường / Xã
                  </Label>
                  <Select
                    disabled={!catalogAvailable}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="forward-recipient-ward"
                      aria-invalid={Boolean(errors.recipient_ward_id)}
                    >
                      <SelectValue placeholder="Chưa có danh mục phường/xã" />
                    </SelectTrigger>
                  </Select>
                  {errors.recipient_ward_id && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.recipient_ward_id.message}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="destination_branch_id"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="forward-destination-branch">
                    Chi nhánh đích
                  </Label>
                  <Select
                    disabled={!catalogAvailable}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="forward-destination-branch"
                      aria-invalid={Boolean(errors.destination_branch_id)}
                    >
                      <SelectValue placeholder="Chưa có danh mục chi nhánh" />
                    </SelectTrigger>
                  </Select>
                  {errors.destination_branch_id && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.destination_branch_id.message}
                    </p>
                  )}
                </div>
              )}
            />
          </form>

          {!catalogAvailable && (
            <div
              className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground"
              role="status"
            >
              {catalogReason}
            </div>
          )}

          <div
            className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            <Info
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <p>{reason}</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void validate();
            }}
          >
            Kiểm tra thông tin
          </Button>
          <Button
            type="button"
            disabled
            aria-describedby="forward-shipment-unavailable"
            title={reason}
          >
            Xác nhận chuyển tiếp
          </Button>
          <span className="sr-only" id="forward-shipment-unavailable">
            Nút xác nhận luôn bị vô hiệu hóa vì chưa có điều kiện tạo vận đơn
            chuyển tiếp.
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
