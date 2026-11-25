import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Calculator,
  LoaderCircle,
  MapPin,
  Package,
  RotateCcw,
  Truck,
} from "lucide-react";
import { useMemo } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type DefaultValues,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { createRateCalculatorSchema } from "../schemas/rate-calculator.schema";
import type { useRateCalculator } from "../hooks/useRateCalculator";
import type { RateCalculatorFormValues } from "../types/rate-calculator.types";
import { z } from "zod";

type RateCalculatorFormInput = z.input<
  ReturnType<typeof createRateCalculatorSchema>
>;

interface RateCalculatorFormProps {
  calculator: ReturnType<typeof useRateCalculator>;
}

const defaultValues: DefaultValues<RateCalculatorFormInput> = {
  originProvinceId: "",
  originDistrictId: "",
  destinationProvinceId: "",
  destinationDistrictId: "",
  actualWeightGram: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  serviceTypeId: "",
  valueAddedServiceIds: [],
};

function getSelectValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function getSelectedId(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  const selectedId = Number(value);
  return Number.isSafeInteger(selectedId) && selectedId > 0
    ? selectedId
    : null;
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

export function RateCalculatorForm({
  calculator,
}: RateCalculatorFormProps) {
  const schema = useMemo(
    () =>
      createRateCalculatorSchema(calculator.provinces, [
        ...calculator.originDistricts,
        ...calculator.destinationDistricts,
      ]),
    [
      calculator.destinationDistricts,
      calculator.originDistricts,
      calculator.provinces,
    ],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitted, isSubmitting },
  } = useForm<RateCalculatorFormInput, unknown, RateCalculatorFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const originProvinceValue = useWatch({
    control,
    name: "originProvinceId",
  });
  const destinationProvinceValue = useWatch({
    control,
    name: "destinationProvinceId",
  });
  const originProvinceId = getSelectedId(originProvinceValue);
  const destinationProvinceId = getSelectedId(destinationProvinceValue);
  const selectedServiceId = getSelectedId(
    useWatch({ control, name: "serviceTypeId" }),
  );
  const selectedService = calculator.serviceTypes.find(
    (service) => service.id === selectedServiceId,
  );

  function resetForm(): void {
    calculator.resetCalculator(() => reset(defaultValues));
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit(calculator.submitRateCalculation)}
    >
      {calculator.isLoadingCatalogs && (
        <div
          className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
          Đang tải danh mục vận chuyển...
        </div>
      )}

      {calculator.error && (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{calculator.error}</p>
        </div>
      )}

      {calculator.isCatalogEmpty && !calculator.error && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="Chưa có danh mục vận chuyển"
              description="Hiện chưa có đủ dữ liệu Tỉnh/Thành phố hoặc dịch vụ để tính cước."
              icon={MapPin}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void calculator.loadCatalogs()}
                  disabled={calculator.isLoading}
                >
                  Tải lại danh mục
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <CardTitle className="text-lg sm:text-xl">
              Địa chỉ gửi và nhận
            </CardTitle>
          </div>
          <CardDescription>
            Chọn Tỉnh/Thành phố trước để tải danh sách Quận/Huyện tương ứng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="originProvinceId"
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <Label htmlFor="originProvinceId">Tỉnh/Thành phố gửi</Label>
                  <Select
                    value={getSelectValue(field.value)}
                    onValueChange={(value) => {
                      field.onChange(value);
                      void calculator.handleOriginProvinceChange(
                        getSelectedId(value),
                        () =>
                          setValue("originDistrictId", "", {
                            shouldDirty: true,
                            shouldValidate: isSubmitted,
                          }),
                      );
                    }}
                    disabled={
                      calculator.isLoadingCatalogs ||
                      calculator.provinces.length === 0
                    }
                  >
                    <SelectTrigger
                      id="originProvinceId"
                      ref={field.ref}
                      name={field.name}
                      aria-invalid={Boolean(fieldState.error)}
                      aria-describedby={
                        fieldState.error ? "originProvinceId-error" : undefined
                      }
                      onBlur={field.onBlur}
                    >
                      <SelectValue placeholder="Chọn Tỉnh/Thành phố gửi" />
                    </SelectTrigger>
                    <SelectContent>
                      {calculator.provinces.map((province) => (
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
                    id="originProvinceId-error"
                    message={fieldState.error?.message}
                  />
                </div>
              )}
            />

            <Controller
              control={control}
              name="originDistrictId"
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <Label htmlFor="originDistrictId">Quận/Huyện gửi</Label>
                  <Select
                    value={getSelectValue(field.value)}
                    onValueChange={(value) => {
                      field.onChange(value);
                      calculator.invalidateResult();
                    }}
                    disabled={
                      originProvinceId === null ||
                      calculator.isLoadingOriginDistricts
                    }
                  >
                    <SelectTrigger
                      id="originDistrictId"
                      ref={field.ref}
                      name={field.name}
                      aria-invalid={Boolean(fieldState.error)}
                      aria-describedby={
                        fieldState.error ? "originDistrictId-error" : undefined
                      }
                      onBlur={field.onBlur}
                    >
                      <SelectValue
                        placeholder={
                          originProvinceId === null
                            ? "Chọn Tỉnh/Thành phố trước"
                            : "Chọn Quận/Huyện gửi"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {calculator.originDistricts.map((district) => (
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
                    id="originDistrictId-error"
                    message={fieldState.error?.message}
                  />
                </div>
              )}
            />

            <Controller
              control={control}
              name="destinationProvinceId"
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <Label htmlFor="destinationProvinceId">
                    Tỉnh/Thành phố nhận
                  </Label>
                  <Select
                    value={getSelectValue(field.value)}
                    onValueChange={(value) => {
                      field.onChange(value);
                      void calculator.handleDestinationProvinceChange(
                        getSelectedId(value),
                        () =>
                          setValue("destinationDistrictId", "", {
                            shouldDirty: true,
                            shouldValidate: isSubmitted,
                          }),
                      );
                    }}
                    disabled={
                      calculator.isLoadingCatalogs ||
                      calculator.provinces.length === 0
                    }
                  >
                    <SelectTrigger
                      id="destinationProvinceId"
                      ref={field.ref}
                      name={field.name}
                      aria-invalid={Boolean(fieldState.error)}
                      aria-describedby={
                        fieldState.error
                          ? "destinationProvinceId-error"
                          : undefined
                      }
                      onBlur={field.onBlur}
                    >
                      <SelectValue placeholder="Chọn Tỉnh/Thành phố nhận" />
                    </SelectTrigger>
                    <SelectContent>
                      {calculator.provinces.map((province) => (
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
                    id="destinationProvinceId-error"
                    message={fieldState.error?.message}
                  />
                </div>
              )}
            />

            <Controller
              control={control}
              name="destinationDistrictId"
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <Label htmlFor="destinationDistrictId">
                    Quận/Huyện nhận
                  </Label>
                  <Select
                    value={getSelectValue(field.value)}
                    onValueChange={(value) => {
                      field.onChange(value);
                      calculator.invalidateResult();
                    }}
                    disabled={
                      destinationProvinceId === null ||
                      calculator.isLoadingDestinationDistricts
                    }
                  >
                    <SelectTrigger
                      id="destinationDistrictId"
                      ref={field.ref}
                      name={field.name}
                      aria-invalid={Boolean(fieldState.error)}
                      aria-describedby={
                        fieldState.error
                          ? "destinationDistrictId-error"
                          : undefined
                      }
                      onBlur={field.onBlur}
                    >
                      <SelectValue
                        placeholder={
                          destinationProvinceId === null
                            ? "Chọn Tỉnh/Thành phố trước"
                            : "Chọn Quận/Huyện nhận"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {calculator.destinationDistricts.map((district) => (
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
                    id="destinationDistrictId-error"
                    message={fieldState.error?.message}
                  />
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <CardTitle className="text-lg sm:text-xl">
              Thông tin kiện hàng
            </CardTitle>
          </div>
          <CardDescription>
            Nhập trọng lượng và kích thước thực tế của kiện hàng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="actualWeightGram">Trọng lượng thực tế</Label>
              <div className="relative">
                <Input
                  id="actualWeightGram"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  placeholder="Ví dụ: 1500"
                  className="pr-16"
                  aria-invalid={Boolean(errors.actualWeightGram)}
                  aria-describedby={
                    errors.actualWeightGram
                      ? "actualWeightGram-error"
                      : undefined
                  }
                  {...register("actualWeightGram", {
                    onChange: calculator.invalidateResult,
                  })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  gram
                </span>
              </div>
              <FieldErrorMessage
                id="actualWeightGram-error"
                message={errors.actualWeightGram?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lengthCm">Chiều dài</Label>
              <div className="relative">
                <Input
                  id="lengthCm"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="Ví dụ: 30"
                  className="pr-12"
                  aria-invalid={Boolean(errors.lengthCm)}
                  aria-describedby={
                    errors.lengthCm ? "lengthCm-error" : undefined
                  }
                  {...register("lengthCm", {
                    onChange: calculator.invalidateResult,
                  })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  cm
                </span>
              </div>
              <FieldErrorMessage
                id="lengthCm-error"
                message={errors.lengthCm?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="widthCm">Chiều rộng</Label>
              <div className="relative">
                <Input
                  id="widthCm"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="Ví dụ: 20"
                  className="pr-12"
                  aria-invalid={Boolean(errors.widthCm)}
                  aria-describedby={
                    errors.widthCm ? "widthCm-error" : undefined
                  }
                  {...register("widthCm", {
                    onChange: calculator.invalidateResult,
                  })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  cm
                </span>
              </div>
              <FieldErrorMessage
                id="widthCm-error"
                message={errors.widthCm?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heightCm">Chiều cao</Label>
              <div className="relative">
                <Input
                  id="heightCm"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="Ví dụ: 15"
                  className="pr-12"
                  aria-invalid={Boolean(errors.heightCm)}
                  aria-describedby={
                    errors.heightCm ? "heightCm-error" : undefined
                  }
                  {...register("heightCm", {
                    onChange: calculator.invalidateResult,
                  })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  cm
                </span>
              </div>
              <FieldErrorMessage
                id="heightCm-error"
                message={errors.heightCm?.message}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <CardTitle className="text-lg sm:text-xl">
              Dịch vụ vận chuyển
            </CardTitle>
          </div>
          <CardDescription>
            Chọn một dịch vụ chính và các dịch vụ giá trị gia tăng nếu cần.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Controller
            control={control}
            name="serviceTypeId"
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <Label htmlFor="serviceTypeId">Dịch vụ chính</Label>
                <Select
                  value={getSelectValue(field.value)}
                  onValueChange={(value) => {
                    field.onChange(value);
                    calculator.invalidateResult();
                  }}
                  disabled={
                    calculator.isLoadingCatalogs ||
                    calculator.serviceTypes.length === 0
                  }
                >
                  <SelectTrigger
                    id="serviceTypeId"
                    ref={field.ref}
                    name={field.name}
                    aria-invalid={Boolean(fieldState.error)}
                    aria-describedby={
                      fieldState.error ? "serviceTypeId-error" : undefined
                    }
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Chọn dịch vụ vận chuyển" />
                  </SelectTrigger>
                  <SelectContent>
                    {calculator.serviceTypes.map((service) => (
                      <SelectItem
                        key={service.id}
                        value={String(service.id)}
                      >
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorMessage
                  id="serviceTypeId-error"
                  message={fieldState.error?.message}
                />
                {selectedService?.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedService.description}
                    {selectedService.estimated_days_min > 0 && (
                      <>
                        {" "}
                        · Dự kiến{" "}
                        {selectedService.estimated_days_min ===
                        selectedService.estimated_days_max
                          ? `${selectedService.estimated_days_min} ngày`
                          : `${selectedService.estimated_days_min}–${selectedService.estimated_days_max} ngày`}
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
          />

          <Controller
            control={control}
            name="valueAddedServiceIds"
            render={({ field, fieldState }) => (
              <fieldset
                className="space-y-3"
                aria-describedby={
                  fieldState.error ? "valueAddedServiceIds-error" : undefined
                }
              >
                <legend className="text-sm font-medium">
                  Dịch vụ giá trị gia tăng
                  <span className="ml-1 font-normal text-muted-foreground">
                    (không bắt buộc)
                  </span>
                </legend>
                {calculator.valueAddedServices.length === 0 ? (
                  <EmptyState
                    title="Chưa có dịch vụ giá trị gia tăng"
                    description="Hiện không có dịch vụ giá trị gia tăng khả dụng."
                    icon={Package}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {calculator.valueAddedServices.map((service) => {
                      const selectedIds = Array.isArray(field.value)
                        ? field.value
                            .map(getSelectedId)
                            .filter((id): id is number => id !== null)
                        : [];
                      const isChecked = selectedIds.includes(service.id);

                      return (
                        <label
                          key={service.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50"
                        >
                          <input
                            type="checkbox"
                            value={service.id}
                            checked={isChecked}
                            aria-invalid={Boolean(fieldState.error)}
                            className="mt-0.5 h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onChange={(event) => {
                              const nextIds = event.target.checked
                                ? [...selectedIds, service.id]
                                : selectedIds.filter(
                                    (id) => id !== service.id,
                                  );
                              field.onChange(nextIds);
                              calculator.invalidateResult();
                            }}
                          />
                          <span className="text-sm font-medium">
                            {service.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <FieldErrorMessage
                  id="valueAddedServiceIds-error"
                  message={fieldState.error?.message}
                />
              </fieldset>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Thao tác</CardTitle>
          <CardDescription>
            Kiểm tra thông tin trước khi gửi yêu cầu ước tính.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground"
            role="note"
          >
            Kết quả hiện dùng dữ liệu minh họa cố định, không được tính từ
            thông số bạn nhập và chưa phải báo giá thực tế từ Backend.
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={resetForm}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Nhập lại
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={
                calculator.isLoading ||
                calculator.isCatalogEmpty ||
                isSubmitting
              }
            >
              {calculator.isLoading || isSubmitting ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Calculator className="h-4 w-4" aria-hidden="true" />
              )}
              {calculator.isLoadingCatalogs
                ? "Đang tải danh mục..."
                : calculator.isCalculating || isSubmitting
                  ? "Đang tính cước..."
                  : "Tính cước vận chuyển"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
