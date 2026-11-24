import { useId } from "react";
import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useAddressBook } from "../hooks/useAddressBook";

type AddressFormHookState = Pick<
  ReturnType<typeof useAddressBook>,
  | "form"
  | "formMode"
  | "editingAddress"
  | "phoneMasked"
  | "provinces"
  | "districts"
  | "wards"
  | "isLoadingCatalogs"
  | "isLoadingDistricts"
  | "isLoadingWards"
  | "isSavingAddress"
  | "isBackendUnavailable"
  | "isCatalogEmpty"
  | "isEditingGeographyUnavailable"
  | "catalogError"
  | "geographyError"
  | "operationError"
  | "capabilities"
  | "reloadCatalogs"
  | "closeForm"
  | "handleProvinceChange"
  | "handleDistrictChange"
  | "handleWardChange"
  | "submitForm"
>;

export interface AddressFormProps {
  addressBook: AddressFormHookState;
}

function FieldErrorMessage({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function AddressForm({ addressBook }: AddressFormProps) {
  const formId = useId();
  const {
    form,
    formMode,
    editingAddress,
    phoneMasked,
    provinces,
    districts,
    wards,
    isLoadingCatalogs,
    isLoadingDistricts,
    isLoadingWards,
    isSavingAddress,
    isBackendUnavailable,
    isCatalogEmpty,
    isEditingGeographyUnavailable,
    catalogError,
    geographyError,
    operationError,
    capabilities,
    reloadCatalogs,
    closeForm,
    handleProvinceChange,
    handleDistrictChange,
    handleWardChange,
    submitForm,
  } = addressBook;
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const selectedProvinceId = useWatch({
    control,
    name: "province_id",
  });
  const selectedDistrictId = useWatch({
    control,
    name: "district_id",
  });
  const isCreateMode = formMode.mode === "create";
  const canSubmitByMode = isCreateMode
    ? capabilities.canCreateAddress
    : capabilities.canEditAddress;
  const isFormUnavailable =
    !canSubmitByMode || isBackendUnavailable || isLoadingCatalogs;
  const isAddressTypeLocked =
    !isCreateMode &&
    (!editingAddress ||
      !capabilities.canChangeAddressType(editingAddress));
  const actionUnavailableMessage = isBackendUnavailable
    ? "Backend quản lý sổ địa chỉ chưa được kết nối."
    : catalogError ??
      operationError ??
      "Thao tác địa chỉ hiện chưa khả dụng.";
  const addressTypeLockMessage = isAddressTypeLocked
    ? editingAddress?.is_default && !isBackendUnavailable
      ? capabilities.defaultAddressNotice
      : actionUnavailableMessage
    : null;
  const provinceHint = isLoadingCatalogs
    ? "Đang tải danh mục Tỉnh/Thành phố..."
    : provinces.length === 0
      ? "Danh mục Tỉnh/Thành phố hiện chưa khả dụng."
      : "Chọn Tỉnh/Thành phố để tải Quận/Huyện tương ứng.";
  const districtHint = !selectedProvinceId
    ? "Vui lòng chọn Tỉnh/Thành phố trước."
    : isLoadingDistricts
      ? "Đang tải danh sách Quận/Huyện..."
      : districts.length === 0
        ? "Không có Quận/Huyện khả dụng cho Tỉnh/Thành phố đã chọn."
        : "Chọn Quận/Huyện thuộc Tỉnh/Thành phố đã chọn.";
  const wardHint = !selectedDistrictId
    ? "Vui lòng chọn Quận/Huyện trước."
    : isLoadingWards
      ? "Đang tải danh sách Phường/Xã..."
      : wards.length === 0
        ? "Không có Phường/Xã khả dụng cho Quận/Huyện đã chọn."
        : "Chọn Phường/Xã thuộc Quận/Huyện đã chọn.";

  function getDescribedBy(
    errorId: string,
    helperId: string,
    hasError: boolean,
  ): string {
    return hasError ? `${errorId} ${helperId}` : helperId;
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={submitForm}
    >
      {isLoadingCatalogs && (
        <div
          className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
          Đang tải danh mục địa giới...
        </div>
      )}

      {isBackendUnavailable && (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p>Backend quản lý sổ địa chỉ chưa được kết nối.</p>
        </div>
      )}

      {catalogError && !isBackendUnavailable && (
        <div
          className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <p>{catalogError}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingCatalogs}
            onClick={() => {
              void reloadCatalogs();
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tải lại danh mục
          </Button>
        </div>
      )}

      {isCatalogEmpty && !catalogError && !isBackendUnavailable && (
        <div
          className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p>Danh mục địa giới hiện chưa có đủ dữ liệu để chọn.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingCatalogs}
            onClick={() => {
              void reloadCatalogs();
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tải lại danh mục
          </Button>
        </div>
      )}

      {geographyError && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {geographyError}
        </div>
      )}

      {operationError && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {operationError}
        </div>
      )}

      {isEditingGeographyUnavailable && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          Địa giới đã lưu không còn khả dụng. Vui lòng chọn lại Tỉnh/Thành phố,
          Quận/Huyện và Phường/Xã trước khi lưu.
        </div>
      )}

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-base font-semibold">
          Thông tin người liên hệ
        </legend>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${formId}-label`}>Nhãn địa chỉ</Label>
            <Input
              id={`${formId}-label`}
              autoComplete="off"
              placeholder="Ví dụ: Nhà riêng, Văn phòng"
              aria-invalid={Boolean(errors.label)}
              aria-describedby={
                errors.label ? `${formId}-label-error` : undefined
              }
              disabled={isFormUnavailable}
              {...register("label")}
            />
            <FieldErrorMessage
              id={`${formId}-label-error`}
              message={errors.label?.message}
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${formId}-contact-name`}>
              Họ và tên
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id={`${formId}-contact-name`}
              autoComplete="name"
              aria-required="true"
              aria-invalid={Boolean(errors.contact_name)}
              aria-describedby={
                errors.contact_name
                  ? `${formId}-contact-name-error`
                  : undefined
              }
              disabled={isFormUnavailable}
              {...register("contact_name")}
            />
            <FieldErrorMessage
              id={`${formId}-contact-name-error`}
              message={errors.contact_name?.message}
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${formId}-phone`}>
              Số điện thoại
              {isCreateMode && (
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              )}
            </Label>
            <Input
              id={`${formId}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-required={isCreateMode}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={
                errors.phone
                  ? `${formId}-phone-error ${formId}-phone-help`
                  : `${formId}-phone-help`
              }
              disabled={isFormUnavailable}
              {...register("phone")}
            />
            {isCreateMode ? (
              <p
                id={`${formId}-phone-help`}
                className="text-sm text-muted-foreground"
              >
                Nhập số điện thoại liên hệ.
              </p>
            ) : (
              <div
                id={`${formId}-phone-help`}
                className="space-y-1 text-sm text-muted-foreground"
              >
                {phoneMasked && (
                  <p>
                    Số điện thoại hiện tại:{" "}
                    <span className="font-medium">{phoneMasked}</span>
                  </p>
                )}
                <p>Để trống nếu bạn không muốn thay đổi số điện thoại.</p>
              </div>
            )}
            <FieldErrorMessage
              id={`${formId}-phone-error`}
              message={errors.phone?.message}
            />
          </div>

          <Controller
            control={control}
            name="address_type"
            render={({ field, fieldState }) => (
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${formId}-address-type`}>
                  Loại địa chỉ
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isFormUnavailable || isAddressTypeLocked}
                >
                  <SelectTrigger
                    id={`${formId}-address-type`}
                    ref={field.ref}
                    name={field.name}
                    aria-required="true"
                    aria-invalid={Boolean(fieldState.error)}
                    aria-describedby={
                      [
                        fieldState.error
                          ? `${formId}-address-type-error`
                          : null,
                        addressTypeLockMessage
                          ? `${formId}-address-type-help`
                          : null,
                      ]
                        .filter((id): id is string => id !== null)
                        .join(" ") || undefined
                    }
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Chọn loại địa chỉ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sender">Địa chỉ gửi hàng</SelectItem>
                    <SelectItem value="receiver">Địa chỉ nhận hàng</SelectItem>
                    <SelectItem value="both">
                      Địa chỉ gửi và nhận hàng
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldErrorMessage
                  id={`${formId}-address-type-error`}
                  message={fieldState.error?.message}
                />
                {addressTypeLockMessage && (
                  <p
                    id={`${formId}-address-type-help`}
                    className="text-sm text-muted-foreground"
                  >
                    {addressTypeLockMessage}
                  </p>
                )}
              </div>
            )}
          />
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-base font-semibold">Thông tin địa chỉ</legend>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="province_id"
            render={({ field, fieldState }) => (
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${formId}-province`}>
                  Tỉnh/Thành phố
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    void handleProvinceChange(value);
                  }}
                  disabled={
                    isFormUnavailable ||
                    provinces.length === 0 ||
                    isLoadingCatalogs
                  }
                >
                  <SelectTrigger
                    id={`${formId}-province`}
                    ref={field.ref}
                    name={field.name}
                    aria-required="true"
                    aria-invalid={Boolean(fieldState.error)}
                    aria-describedby={getDescribedBy(
                      `${formId}-province-error`,
                      `${formId}-province-help`,
                      Boolean(fieldState.error),
                    )}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Chọn Tỉnh/Thành phố" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((province) => (
                      <SelectItem
                        key={province.id}
                        value={String(province.id)}
                      >
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorMessage
                  id={`${formId}-province-error`}
                  message={fieldState.error?.message}
                />
                <p
                  id={`${formId}-province-help`}
                  className="text-sm text-muted-foreground"
                >
                  {provinceHint}
                </p>
              </div>
            )}
          />

          <Controller
            control={control}
            name="district_id"
            render={({ field, fieldState }) => (
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${formId}-district`}>
                  Quận/Huyện
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    void handleDistrictChange(value);
                  }}
                  disabled={
                    isFormUnavailable ||
                    !selectedProvinceId ||
                    isLoadingDistricts ||
                    districts.length === 0
                  }
                >
                  <SelectTrigger
                    id={`${formId}-district`}
                    ref={field.ref}
                    name={field.name}
                    aria-required="true"
                    aria-invalid={Boolean(fieldState.error)}
                    aria-describedby={getDescribedBy(
                      `${formId}-district-error`,
                      `${formId}-district-help`,
                      Boolean(fieldState.error),
                    )}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Chọn Quận/Huyện" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((district) => (
                      <SelectItem
                        key={district.id}
                        value={String(district.id)}
                      >
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorMessage
                  id={`${formId}-district-error`}
                  message={fieldState.error?.message}
                />
                <p
                  id={`${formId}-district-help`}
                  className="text-sm text-muted-foreground"
                >
                  {districtHint}
                </p>
              </div>
            )}
          />

          <Controller
            control={control}
            name="ward_id"
            render={({ field, fieldState }) => (
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${formId}-ward`}>
                  Phường/Xã
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Select
                  value={field.value}
                  onValueChange={(value) => handleWardChange(value)}
                  disabled={
                    isFormUnavailable ||
                    !selectedDistrictId ||
                    isLoadingWards ||
                    wards.length === 0
                  }
                >
                  <SelectTrigger
                    id={`${formId}-ward`}
                    ref={field.ref}
                    name={field.name}
                    aria-required="true"
                    aria-invalid={Boolean(fieldState.error)}
                    aria-describedby={getDescribedBy(
                      `${formId}-ward-error`,
                      `${formId}-ward-help`,
                      Boolean(fieldState.error),
                    )}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Chọn Phường/Xã" />
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((ward) => (
                      <SelectItem key={ward.id} value={String(ward.id)}>
                        {ward.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorMessage
                  id={`${formId}-ward-error`}
                  message={fieldState.error?.message}
                />
                <p
                  id={`${formId}-ward-help`}
                  className="text-sm text-muted-foreground"
                >
                  {wardHint}
                </p>
              </div>
            )}
          />

          <div className="min-w-0 space-y-2 sm:col-span-2">
            <Label htmlFor={`${formId}-address-line`}>
              Địa chỉ chi tiết
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <textarea
              id={`${formId}-address-line`}
              rows={3}
              className="flex min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              placeholder="Số nhà, tên đường, tòa nhà..."
              aria-required="true"
              aria-invalid={Boolean(errors.address_line)}
              aria-describedby={
                errors.address_line
                  ? `${formId}-address-line-error`
                  : undefined
              }
              disabled={isFormUnavailable}
              {...register("address_line")}
            />
            <FieldErrorMessage
              id={`${formId}-address-line-error`}
              message={errors.address_line?.message}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-3">
        <legend className="text-base font-semibold">Địa chỉ mặc định</legend>

        <Controller
          control={control}
          name="is_default"
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <input
                  id={`${formId}-is-default`}
                  ref={field.ref}
                  name={field.name}
                  type="checkbox"
                  checked={field.value}
                  readOnly
                  disabled
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(fieldState.error)}
                  aria-describedby={
                    fieldState.error
                      ? `${formId}-is-default-error ${formId}-default-help`
                      : `${formId}-default-help`
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                />
                <Label
                  htmlFor={`${formId}-is-default`}
                  className="leading-relaxed"
                >
                  Đặt địa chỉ này làm mặc định
                </Label>
              </div>
              <p
                id={`${formId}-default-help`}
                className="text-sm text-muted-foreground"
              >
                {capabilities.defaultAddressNotice}
              </p>
              <FieldErrorMessage
                id={`${formId}-is-default-error`}
                message={fieldState.error?.message}
              />
            </div>
          )}
        />
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isSavingAddress}
          onClick={closeForm}
        >
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={isSavingAddress || isFormUnavailable}
        >
          {isSavingAddress && (
            <LoaderCircle
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          )}
          {isSavingAddress
            ? "Đang lưu..."
            : isCreateMode
              ? "Thêm địa chỉ"
              : "Lưu địa chỉ"}
        </Button>
      </div>
    </form>
  );
}
