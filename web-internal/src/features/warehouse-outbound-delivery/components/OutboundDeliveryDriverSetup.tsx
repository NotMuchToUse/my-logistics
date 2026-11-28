import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Phone,
  Truck,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { OUTBOUND_DELIVERY_STATUS_META } from "../constants/warehouse-outbound-delivery.constants";
import {
  createOutboundDeliverySchema,
  type CreateOutboundDeliveryFormValues,
} from "../schemas/warehouse-outbound-delivery.schema";
import type {
  DeliveryDriverOption,
  OutboundDeliveryReceipt,
} from "../types/warehouse-outbound-delivery.types";

interface OutboundDeliveryDriverSetupProps {
  warehouse: {
    id: number;
    code: string;
    name: string;
    branch_id: number;
    branch_name: string;
  };
  drivers: DeliveryDriverOption[];
  selectedDriverId: number | null;
  onSelectDriver: (driverId: number) => void;
  activeDraft: OutboundDeliveryReceipt | null;
  isCreatingDraft: boolean;
  onCreateDraft: (driverId: number, note?: string) => Promise<boolean>;
}

export function OutboundDeliveryDriverSetup({
  warehouse,
  drivers,
  selectedDriverId,
  onSelectDriver,
  activeDraft,
  isCreatingDraft,
  onCreateDraft,
}: OutboundDeliveryDriverSetupProps) {
  const activeDrivers = drivers.filter((driver) => driver.is_active);
  const assignedDriver =
    drivers.find(
      (driver) =>
        driver.id === (activeDraft?.driver_id ?? selectedDriverId),
    ) ?? null;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateOutboundDeliveryFormValues>({
    defaultValues: {
      warehouse_id: warehouse.id,
      driver_id: selectedDriverId ?? 0,
      note: "",
    },
  });

  useEffect(() => {
    setValue("warehouse_id", warehouse.id);
  }, [warehouse.id, setValue]);

  useEffect(() => {
    if (selectedDriverId !== null) {
      setValue("driver_id", selectedDriverId);
      clearErrors("driver_id");
    }
  }, [selectedDriverId, setValue, clearErrors]);

  async function onSubmit(values: CreateOutboundDeliveryFormValues) {
    const parsed = createOutboundDeliverySchema.safeParse({
      warehouse_id: warehouse.id,
      driver_id: selectedDriverId ?? values.driver_id,
      note: values.note,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "driver_id" || field === "note") {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    await onCreateDraft(parsed.data.driver_id, parsed.data.note);
  }

  if (activeDraft) {
    const statusMeta = OUTBOUND_DELIVERY_STATUS_META[activeDraft.status];

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
                Phiếu xuất giao: {activeDraft.receipt_code}
              </CardTitle>
              <CardDescription>
                Bưu cục xuất: {activeDraft.warehouse_name} ({activeDraft.warehouse_code}) ·{" "}
                {activeDraft.branch_name}
              </CardDescription>
            </div>
            <Badge variant="outline" className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tài xế phụ trách giao hàng
              </p>
              <p className="flex items-center gap-1.5 font-semibold">
                <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                {activeDraft.driver_name} ({activeDraft.driver_code})
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {activeDraft.driver_phone_masked}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Phương tiện & Tải tuyến hiện tại
              </p>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Truck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {assignedDriver?.vehicle_plate ?? "Xe máy / Chưa gắn biển số"}
              </p>
              <p className="text-xs text-muted-foreground">
                Đang giữ giao: {assignedDriver?.active_delivery_count ?? 0} đơn
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ghi chú chuyến giao
              </p>
              <p className="text-sm text-foreground">
                {activeDraft.note?.trim() ? activeDraft.note : "Không có ghi chú"}
              </p>
              <p className="text-xs text-muted-foreground">
                Phiên bản phiếu: v{activeDraft.version}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          Bước 1: Chọn tài xế giao hàng thuộc bưu cục
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <Warehouse className="h-4 w-4" aria-hidden="true" />
          Kho xuất hiện tại: <strong className="font-medium text-foreground">{warehouse.name}</strong> ({warehouse.code})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-12">
          <div className="space-y-2 md:col-span-5">
            <Label htmlFor="outbound-driver-select">
              Tài xế giao hàng <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedDriverId !== null ? String(selectedDriverId) : ""}
              onValueChange={(value) => onSelectDriver(Number(value))}
              disabled={isCreatingDraft || activeDrivers.length === 0}
            >
              <SelectTrigger id="outbound-driver-select">
                <SelectValue placeholder="Chọn tài xế thuộc bưu cục..." />
              </SelectTrigger>
              <SelectContent>
                {activeDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={String(driver.id)}>
                    {driver.full_name} ({driver.employee_code}) — {driver.active_delivery_count} đơn đang giao
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.driver_id && (
              <p className="text-xs text-destructive">{errors.driver_id.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="outbound-draft-note">Ghi chú tuyến giao (tùy chọn)</Label>
            <Input
              id="outbound-draft-note"
              placeholder="Ví dụ: Tuyến giao sáng khu vực Hải Châu..."
              disabled={isCreatingDraft}
              {...register("note")}
            />
            {errors.note && (
              <p className="text-xs text-destructive">{errors.note.message}</p>
            )}
          </div>

          <div className="flex items-end md:col-span-3">
            <Button
              type="submit"
              className="w-full"
              disabled={isCreatingDraft || activeDrivers.length === 0}
            >
              {isCreatingDraft ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Đang tạo phiếu...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Khởi tạo phiếu xuất
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
