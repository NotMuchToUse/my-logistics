import { useEffect, useState } from "react";
import { Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
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
  createPickupRequest,
  getDistrictOptions,
  getProvinceOptions,
  getWardOptions,
} from "../api/pickup-dispatch.api";
import { createPickupRequestSchema } from "../schemas/pickup-dispatch.schema";
import type {
  BranchOption,
  GeoOption,
  PickupMode,
  PickupRequestItem,
} from "../types/pickup-dispatch.types";

interface CreatePickupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchOption[];
  defaultBranchId: number | null;
  onCreated: (created: PickupRequestItem) => void;
}

export function CreatePickupDialog({
  open,
  onOpenChange,
  branches,
  defaultBranchId,
  onCreated,
}: CreatePickupDialogProps) {
  const initialBranchId = defaultBranchId ?? branches[0]?.id ?? 3;
  const initialBranch = branches.find((b) => b.id === initialBranchId);

  const [branchId, setBranchId] = useState<number>(initialBranchId);
  const [pickupMode, setPickupMode] = useState<PickupMode>("driver_pickup");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [provinceId, setProvinceId] = useState<number>(
    initialBranch?.province_id ?? 48,
  );
  const [districtId, setDistrictId] = useState<number>(
    initialBranch?.district_id ?? 490,
  );
  const [wardId, setWardId] = useState<number>(20194);
  const [pickupAddress, setPickupAddress] = useState("");
  const [parcelCount, setParcelCount] = useState("1");
  const [weightGram, setWeightGram] = useState("1000");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [provinces, setProvinces] = useState<GeoOption[]>([]);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [wards, setWards] = useState<GeoOption[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextBranchId = defaultBranchId ?? branches[0]?.id ?? 3;
    const branch = branches.find((b) => b.id === nextBranchId);
    setBranchId(nextBranchId);
    if (branch) {
      setProvinceId(branch.province_id);
      setDistrictId(branch.district_id);
    }
    setErrors({});
    void getProvinceOptions().then(setProvinces);
  }, [open, defaultBranchId, branches]);

  useEffect(() => {
    if (!open || provinceId < 1) {
      return;
    }
    void getDistrictOptions(provinceId).then((list) => {
      setDistricts(list);
      if (list.length > 0 && !list.some((d) => d.id === districtId)) {
        setDistrictId(list[0]!.id);
      }
    });
  }, [open, provinceId]);

  useEffect(() => {
    if (!open || districtId < 1) {
      return;
    }
    void getWardOptions(districtId).then((list) => {
      setWards(list);
      if (list.length > 0 && !list.some((w) => w.id === wardId)) {
        setWardId(list[0]!.id);
      }
    });
  }, [open, districtId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = createPickupRequestSchema.safeParse({
      branch_id: branchId,
      pickup_mode: pickupMode,
      sender_name: senderName,
      sender_phone: senderPhone,
      province_id: provinceId,
      district_id: districtId,
      ward_id: wardId,
      pickup_address: pickupAddress,
      estimated_parcel_count: Number(parcelCount),
      estimated_weight_gram: Number(weightGram),
      note: note.trim() === "" ? undefined : note,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPickupRequest(parsed.data);
      toast.success(`Đã tiếp nhận yêu cầu lấy hàng ${created.request_code}.`);
      setSenderName("");
      setSenderPhone("");
      setPickupAddress("");
      setParcelCount("1");
      setWeightGram("1000");
      setNote("");
      onCreated(created);
      onOpenChange(false);
    } catch (error) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        typeof (error as { error?: { message?: string } }).error?.message ===
          "string"
          ? (error as { error: { message: string } }).error.message
          : "Không thể tạo yêu cầu lấy hàng.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Tạo yêu cầu lấy hàng (Khách gọi điện)
          </DialogTitle>
          <DialogDescription>
            Ghi nhận thông tin điểm lấy hàng từ cuộc gọi của khách để điều phối
            tài xế trong ca.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bưu cục & Hình thức lấy */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Bưu cục phụ trách *</Label>
              <Select
                value={String(branchId)}
                onValueChange={(val) => setBranchId(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn bưu cục" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.code} - {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.branch_id && (
                <p className="text-xs text-destructive">{errors.branch_id}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Hình thức lấy hàng *</Label>
              <Select
                value={pickupMode}
                onValueChange={(val) => setPickupMode(val as PickupMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver_pickup">
                    Tài xế đến tận nơi lấy
                  </SelectItem>
                  <SelectItem value="counter_dropoff">
                    Khách mang ra bưu cục
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Thông tin người gửi */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pickup-sender-name">Tên khách hàng / Shop *</Label>
              <Input
                id="pickup-sender-name"
                placeholder="VD: Shop Thời Trang Mai Anh"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
              {errors.sender_name && (
                <p className="text-xs text-destructive">{errors.sender_name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pickup-sender-phone">Số điện thoại liên hệ *</Label>
              <Input
                id="pickup-sender-phone"
                placeholder="VD: 0905123456"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
              />
              {errors.sender_phone && (
                <p className="text-xs text-destructive">{errors.sender_phone}</p>
              )}
            </div>
          </div>

          {/* Địa chỉ lấy hàng */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tỉnh / Thành phố *</Label>
              <Select
                value={String(provinceId)}
                onValueChange={(val) => setProvinceId(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn Tỉnh/TP" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Quận / Huyện *</Label>
              <Select
                value={String(districtId)}
                onValueChange={(val) => setDistrictId(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn Quận/Huyện" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Phường / Xã *</Label>
              <Select
                value={String(wardId)}
                onValueChange={(val) => setWardId(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn Phường/Xã" />
                </SelectTrigger>
                <SelectContent>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pickup-address-line">Số nhà, tên đường chi tiết *</Label>
            <Input
              id="pickup-address-line"
              placeholder="VD: 35 Lê Duẩn, Phường Hải Châu I"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
            />
            {errors.pickup_address && (
              <p className="text-xs text-destructive">{errors.pickup_address}</p>
            )}
          </div>

          {/* Ước tính kiện hàng */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pickup-parcel-count">Số kiện dự kiến *</Label>
              <Input
                id="pickup-parcel-count"
                type="number"
                min={1}
                value={parcelCount}
                onChange={(e) => setParcelCount(e.target.value)}
              />
              {errors.estimated_parcel_count && (
                <p className="text-xs text-destructive">
                  {errors.estimated_parcel_count}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pickup-weight-gram">
                Tổng trọng lượng dự kiến (gram) *
              </Label>
              <Input
                id="pickup-weight-gram"
                type="number"
                min={50}
                step={50}
                value={weightGram}
                onChange={(e) => setWeightGram(e.target.value)}
              />
              {errors.estimated_weight_gram && (
                <p className="text-xs text-destructive">
                  {errors.estimated_weight_gram}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pickup-note">Ghi chú cho tài xế</Label>
            <Input
              id="pickup-note"
              placeholder="VD: Gọi trước 15 phút, hàng dễ vỡ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Đóng
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo yêu cầu lấy hàng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}