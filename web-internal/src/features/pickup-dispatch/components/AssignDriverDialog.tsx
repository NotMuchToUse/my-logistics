import { useEffect, useState } from "react";
import { Loader2, Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  assignPickupDriver,
  getBranchDrivers,
} from "../api/pickup-dispatch.api";
import type {
  DriverOption,
  PickupRequestItem,
} from "../types/pickup-dispatch.types";

interface AssignDriverDialogProps {
  request: PickupRequestItem | null;
  onOpenChange: (open: boolean) => void;
  onAssigned: (updated: PickupRequestItem) => void;
}

export function AssignDriverDialog({
  request,
  onOpenChange,
  onAssigned,
}: AssignDriverDialogProps) {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [assignMode, setAssignMode] = useState<"auto" | "manual">("auto");
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!request) {
      return;
    }

    setLoadingDrivers(true);
    setAssignMode(request.assigned_driver_id ? "manual" : "auto");
    setSelectedDriverId(request.assigned_driver_id ?? null);

    void getBranchDrivers(request.branch_id)
      .then((list) => {
        setDrivers(list);
        if (!request.assigned_driver_id && list.length > 0) {
          const leastBusy = [...list].sort(
            (a, b) => a.active_pickup_count - b.active_pickup_count,
          )[0];
          setSelectedDriverId(leastBusy?.id ?? null);
        }
      })
      .finally(() => setLoadingDrivers(false));
  }, [request]);

  async function handleConfirm() {
    if (!request) {
      return;
    }

    if (assignMode === "manual" && !selectedDriverId) {
      toast.error("Vui lòng chọn một tài xế thuộc chi nhánh.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await assignPickupDriver(
        request.public_id,
        assignMode === "auto"
          ? { auto_assign: true, version: request.version }
          : { driver_id: selectedDriverId, version: request.version },
      );

      toast.success(
        `Đã phân công đơn ${updated.request_code} cho tài xế ${updated.assigned_driver_name ?? "được chọn"}.`,
      );
      onAssigned(updated);
      onOpenChange(false);
    } catch (error) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        typeof (error as { error?: { message?: string } }).error?.message ===
          "string"
          ? (error as { error: { message: string } }).error.message
          : "Không thể phân công tài xế.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Phân công tài xế lấy hàng
          </DialogTitle>
          <DialogDescription>
            {request
              ? `Mã yêu cầu ${request.request_code} • ${request.sender_name} (${request.pickup_address})`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chế độ phân công */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setAssignMode("auto")}
              className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                assignMode === "auto"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Gán tự động
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Ưu tiên tài xế trong bưu cục đang ít đơn lấy nhất
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAssignMode("manual")}
              className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                assignMode === "manual"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <UserCheck className="h-4 w-4 text-primary" />
                Chọn thủ công
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Chỉ định đích danh tài xế thuộc bưu cục
              </span>
            </button>
          </div>

          {/* Danh sách tài xế thuộc chi nhánh */}
          <div className="space-y-2">
            <Label>
              Danh sách tài xế bưu cục ({drivers.length} nhân sự khả dụng)
            </Label>

            {loadingDrivers ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tải danh sách tài xế...
              </div>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {drivers.map((driver) => {
                  const isSelected = selectedDriverId === driver.id;
                  return (
                    <button
                      key={driver.id}
                      type="button"
                      disabled={assignMode === "auto"}
                      onClick={() => setSelectedDriverId(driver.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition ${
                        assignMode === "auto"
                          ? "cursor-default opacity-75"
                          : isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {driver.full_name}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({driver.employee_code})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          SĐT: {driver.phone_masked}
                        </div>
                      </div>
                      <Badge variant="outline">
                        Đang nhận: {driver.active_pickup_count} đơn
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || loadingDrivers}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {assignMode === "auto"
              ? "Xác nhận gán tự động"
              : "Xác nhận phân công"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}