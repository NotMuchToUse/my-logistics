import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Building2,
  ChevronRight,
  CirclePlus,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createBranch,
  createWarehouse,
  deleteBranch,
  deleteWarehouse,
  getBranches,
  getWarehouses,
  networkOrgLocations,
  updateBranch,
  updateWarehouse,
} from "../api/network-org.api";
import {
  branchFormSchema,
  warehouseFormSchema,
} from "../schemas/network-org.schema";
import {
  BRANCH_TYPES,
  WAREHOUSE_TYPES,
  type Branch,
  type BranchInput,
  type BranchType,
  type Warehouse,
  type WarehouseInput,
  type WarehouseType,
} from "../types/network-org.types";

type BranchDraft = {
  code: string;
  name: string;
  branch_type: BranchType;
  parent_branch_id: string;
  province_id: string;
  district_id: string;
  ward_id: string;
  address_line: string;
  latitude: string;
  longitude: string;
  operating_hours: string;
  accepts_counter_dropoff: string;
  is_active: string;
};

type WarehouseDraft = {
  branch_id: string;
  code: string;
  name: string;
  warehouse_type: WarehouseType;
  max_capacity_parcels: string;
  province_id: string;
  district_id: string;
  ward_id: string;
  address_line: string;
  latitude: string;
  longitude: string;
  operating_hours: string;
  is_active: string;
};

type DialogState =
  | { kind: "branch"; branch?: Branch; suggestedParentId?: number }
  | { kind: "warehouse"; warehouse?: Warehouse; branchId?: number }
  | null;

const branchTypeLabels: Record<BranchType, string> = {
  hq: "Trụ sở",
  regional_hub: "Trung tâm vùng",
  branch: "Chi nhánh",
  post_office: "Bưu cục",
};

const warehouseTypeLabels: Record<WarehouseType, string> = {
  hub_sorting: "Kho khai thác",
  branch_warehouse: "Kho chi nhánh",
  post_office_storage: "Kho bưu cục",
};

const parentTypeOptions: Record<BranchType, BranchType[]> = {
  hq: [],
  regional_hub: ["hq"],
  branch: ["regional_hub"],
  post_office: ["branch"],
};

const childTypeOptions: Record<BranchType, BranchType> = {
  hq: "regional_hub",
  regional_hub: "branch",
  branch: "post_office",
  post_office: "hq",
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }
  return error instanceof Error ? error.message : "Đã xảy ra lỗi, vui lòng thử lại.";
}

function getDescendantIds(branches: Branch[], branchId: number): Set<number> {
  const descendants = new Set<number>();
  const pending = [branchId];

  while (pending.length > 0) {
    const parentId = pending.pop();
    if (parentId === undefined) continue;

    branches
      .filter((branch) => branch.parent_branch_id === parentId)
      .forEach((branch) => {
        if (!descendants.has(branch.id)) {
          descendants.add(branch.id);
          pending.push(branch.id);
        }
      });
  }

  return descendants;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-xs font-normal text-destructive">{error}</span> : null}
    </label>
  );
}

function BranchFormDialog({
  branch,
  branches,
  suggestedParentId,
  onOpenChange,
  onSave,
}: {
  branch?: Branch;
  branches: Branch[];
  suggestedParentId?: number;
  onOpenChange: (open: boolean) => void;
  onSave: (input: BranchInput) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<BranchDraft>(() => ({
    code: branch?.code ?? "",
    name: branch?.name ?? "",
    branch_type:
      branch?.branch_type ??
      (suggestedParentId
        ? childTypeOptions[
            branches.find((item) => item.id === suggestedParentId)?.branch_type ??
              "post_office"
          ]
        : "hq"),
    parent_branch_id:
      branch?.parent_branch_id != null
        ? String(branch.parent_branch_id)
        : suggestedParentId
          ? String(suggestedParentId)
          : "",
    province_id: branch ? String(branch.province_id) : "",
    district_id: branch ? String(branch.district_id) : "",
    ward_id: branch ? String(branch.ward_id) : "",
    address_line: branch?.address_line ?? "",
    latitude: branch ? String(branch.latitude) : "",
    longitude: branch ? String(branch.longitude) : "",
    operating_hours: branch?.operating_hours ?? "08:00-17:30",
    accepts_counter_dropoff: String(branch?.accepts_counter_dropoff ?? 1),
    is_active: String(branch?.is_active ?? 1),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const excludedParentIds = useMemo(
    () => (branch ? getDescendantIds(branches, branch.id) : new Set<number>()),
    [branch, branches],
  );
  const parentOptions = branches.filter(
    (item) =>
      parentTypeOptions[draft.branch_type].includes(item.branch_type) &&
      item.id !== branch?.id &&
      !excludedParentIds.has(item.id),
  );
  const provinces = networkOrgLocations.provinces;
  const districts = networkOrgLocations.districts.filter(
    (item) => String(item.province_id) === draft.province_id,
  );
  const wards = networkOrgLocations.wards.filter(
    (item) => String(item.district_id) === draft.district_id,
  );

  function update<K extends keyof BranchDraft>(key: K, value: BranchDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setLocation(key: "province_id" | "district_id" | "ward_id", value: string) {
    if (key === "province_id") {
      setDraft((current) => ({
        ...current,
        province_id: value === "none" ? "" : value,
        district_id: "",
        ward_id: "",
      }));
    } else if (key === "district_id") {
      setDraft((current) => ({
        ...current,
        district_id: value === "none" ? "" : value,
        ward_id: "",
      }));
    } else {
      update("ward_id", value === "none" ? "" : value);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = branchFormSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }

    const input: BranchInput = {
      ...parsed.data,
      parent_branch_id:
        parsed.data.branch_type === "hq" ? null : parsed.data.parent_branch_id,
    };
    const selectedParent = branches.find(
      (item) => item.id === input.parent_branch_id,
    );
    if (
      input.branch_type !== "hq" &&
      (!selectedParent ||
        selectedParent.id === branch?.id ||
        excludedParentIds.has(selectedParent.id) ||
        !parentTypeOptions[input.branch_type].includes(selectedParent.branch_type))
    ) {
      setErrors({ parent_branch_id: "Vui lòng chọn đơn vị cấp trên phù hợp." });
      return;
    }

    setSaving(true);
    const saved = await onSave(input);
    setSaving(false);
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{branch ? "Sửa đơn vị mạng lưới" : "Thêm đơn vị mạng lưới"}</DialogTitle>
          <DialogDescription>
            Khai báo loại đơn vị, cấp trên, địa chỉ, tọa độ GPS và giờ hoạt động.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã đơn vị" error={errors.code}>
              <Input value={draft.code} onChange={(event) => update("code", event.target.value)} />
            </Field>
            <Field label="Tên đơn vị" error={errors.name}>
              <Input value={draft.name} onChange={(event) => update("name", event.target.value)} />
            </Field>
            <Field label="Loại đơn vị" error={errors.branch_type}>
              <Select
                value={draft.branch_type}
                onValueChange={(value) => {
                  if (!BRANCH_TYPES.includes(value as BranchType)) return;
                  const newType = value as BranchType;
                  const validParents = branches.filter(
                    (item) =>
                      parentTypeOptions[newType].includes(item.branch_type) &&
                      item.id !== branch?.id &&
                      !excludedParentIds.has(item.id),
                  );
                  update("branch_type", newType);
                  update(
                    "parent_branch_id",
                    newType === "hq"
                      ? ""
                      : validParents.some(
                            (item) => String(item.id) === draft.parent_branch_id,
                          )
                        ? draft.parent_branch_id
                        : validParents[0]
                          ? String(validParents[0].id)
                          : "",
                  );
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BRANCH_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{branchTypeLabels[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Đơn vị cấp trên" error={errors.parent_branch_id}>
              <Select
                value={draft.parent_branch_id || "none"}
                onValueChange={(value) =>
                  update("parent_branch_id", value === "none" ? "" : value)
                }
                disabled={draft.branch_type === "hq"}
              >
                <SelectTrigger><SelectValue placeholder="Chọn đơn vị cấp trên" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không có</SelectItem>
                  {parentOptions.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <LocationFields
            draft={draft}
            errors={errors}
            provinces={provinces}
            districts={districts}
            wards={wards}
            update={update}
            setLocation={setLocation}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Giờ hoạt động (HH:mm-HH:mm)" error={errors.operating_hours}>
              <Input
                placeholder="08:00-17:30"
                value={draft.operating_hours}
                onChange={(event) => update("operating_hours", event.target.value)}
              />
            </Field>
            <Field label="Trạng thái">
              <Select value={draft.is_active} onValueChange={(value) => update("is_active", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Đang hoạt động</SelectItem>
                  <SelectItem value="0">Ngưng hoạt động</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nhận gửi hàng tại quầy">
              <Select
                value={draft.accepts_counter_dropoff}
                onValueChange={(value) => update("accepts_counter_dropoff", value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Có</SelectItem>
                  <SelectItem value="0">Không</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : branch ? "Lưu thay đổi" : "Thêm đơn vị"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LocationFields<Draft extends {
  province_id: string;
  district_id: string;
  ward_id: string;
  address_line: string;
  latitude: string;
  longitude: string;
}>({
  draft,
  errors,
  provinces,
  districts,
  wards,
  update,
  setLocation,
}: {
  draft: Draft;
  errors: Record<string, string>;
  provinces: typeof networkOrgLocations.provinces;
  districts: typeof networkOrgLocations.districts;
  wards: typeof networkOrgLocations.wards;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  setLocation: (key: "province_id" | "district_id" | "ward_id", value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tỉnh / Thành phố" error={errors.province_id}>
          <Select value={draft.province_id || "none"} onValueChange={(value) => setLocation("province_id", value)}>
            <SelectTrigger><SelectValue placeholder="Chọn tỉnh / thành phố" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Chọn tỉnh / thành phố</SelectItem>
              {provinces.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quận / Huyện" error={errors.district_id}>
          <Select
            value={draft.district_id || "none"}
            onValueChange={(value) => setLocation("district_id", value)}
            disabled={!draft.province_id}
          >
            <SelectTrigger><SelectValue placeholder="Chọn quận / huyện" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Chọn quận / huyện</SelectItem>
              {districts.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Phường / Xã" error={errors.ward_id}>
          <Select
            value={draft.ward_id || "none"}
            onValueChange={(value) => setLocation("ward_id", value)}
            disabled={!draft.district_id}
          >
            <SelectTrigger><SelectValue placeholder="Chọn phường / xã" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Chọn phường / xã</SelectItem>
              {wards.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Địa chỉ cụ thể" error={errors.address_line}>
        <Input value={draft.address_line} onChange={(event) => update("address_line", event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vĩ độ (latitude)" error={errors.latitude}>
          <Input type="number" step="any" min="-90" max="90" value={draft.latitude} onChange={(event) => update("latitude", event.target.value)} />
        </Field>
        <Field label="Kinh độ (longitude)" error={errors.longitude}>
          <Input type="number" step="any" min="-180" max="180" value={draft.longitude} onChange={(event) => update("longitude", event.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function WarehouseFormDialog({
  warehouse,
  branches,
  suggestedBranchId,
  onOpenChange,
  onSave,
}: {
  warehouse?: Warehouse;
  branches: Branch[];
  suggestedBranchId?: number;
  onOpenChange: (open: boolean) => void;
  onSave: (input: WarehouseInput) => Promise<boolean>;
}) {
  const initialBranch = branches.find(
    (item) => item.id === (warehouse?.branch_id ?? suggestedBranchId),
  );
  const [draft, setDraft] = useState<WarehouseDraft>(() => ({
    branch_id: String(warehouse?.branch_id ?? suggestedBranchId ?? ""),
    code: warehouse?.code ?? "",
    name: warehouse?.name ?? "",
    warehouse_type: warehouse?.warehouse_type ?? "branch_warehouse",
    max_capacity_parcels: String(warehouse?.max_capacity_parcels ?? 1000),
    province_id: String(warehouse?.province_id ?? initialBranch?.province_id ?? ""),
    district_id: String(warehouse?.district_id ?? initialBranch?.district_id ?? ""),
    ward_id: String(warehouse?.ward_id ?? initialBranch?.ward_id ?? ""),
    address_line: warehouse?.address_line ?? initialBranch?.address_line ?? "",
    latitude: String(warehouse?.latitude ?? initialBranch?.latitude ?? ""),
    longitude: String(warehouse?.longitude ?? initialBranch?.longitude ?? ""),
    operating_hours: warehouse?.operating_hours ?? initialBranch?.operating_hours ?? "08:00-17:30",
    is_active: String(warehouse?.is_active ?? 1),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const provinces = networkOrgLocations.provinces;
  const districts = networkOrgLocations.districts.filter(
    (item) => String(item.province_id) === draft.province_id,
  );
  const wards = networkOrgLocations.wards.filter(
    (item) => String(item.district_id) === draft.district_id,
  );

  function update<K extends keyof WarehouseDraft>(key: K, value: WarehouseDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setLocation(key: "province_id" | "district_id" | "ward_id", value: string) {
    if (key === "province_id") {
      setDraft((current) => ({
        ...current,
        province_id: value === "none" ? "" : value,
        district_id: "",
        ward_id: "",
      }));
    } else if (key === "district_id") {
      setDraft((current) => ({
        ...current,
        district_id: value === "none" ? "" : value,
        ward_id: "",
      }));
    } else {
      update("ward_id", value === "none" ? "" : value);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = warehouseFormSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }

    setSaving(true);
    const saved = await onSave(parsed.data);
    setSaving(false);
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{warehouse ? "Sửa kho bãi" : "Thêm kho bãi"}</DialogTitle>
          <DialogDescription>
            Gắn kho với đơn vị quản lý và khai báo vị trí, tọa độ GPS, giờ hoạt động.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Đơn vị trực thuộc" error={errors.branch_id}>
              <Select
                value={draft.branch_id || "none"}
                onValueChange={(value) => {
                  const branchId = value === "none" ? "" : value;
                  update("branch_id", branchId);
                  const selectedBranch = branches.find((item) => String(item.id) === branchId);
                  if (selectedBranch) {
                    setDraft((current) => ({
                      ...current,
                      branch_id: branchId,
                      province_id: String(selectedBranch.province_id),
                      district_id: String(selectedBranch.district_id),
                      ward_id: String(selectedBranch.ward_id),
                      address_line: selectedBranch.address_line,
                      latitude: String(selectedBranch.latitude),
                      longitude: String(selectedBranch.longitude),
                      operating_hours: selectedBranch.operating_hours,
                    }));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Chọn đơn vị</SelectItem>
                  {branches.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Loại kho" error={errors.warehouse_type}>
              <Select
                value={draft.warehouse_type}
                onValueChange={(value) => {
                  if (WAREHOUSE_TYPES.includes(value as WarehouseType)) {
                    update("warehouse_type", value as WarehouseType);
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{warehouseTypeLabels[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mã kho" error={errors.code}>
              <Input value={draft.code} onChange={(event) => update("code", event.target.value)} />
            </Field>
            <Field label="Tên kho" error={errors.name}>
              <Input value={draft.name} onChange={(event) => update("name", event.target.value)} />
            </Field>
            <Field label="Sức chứa (kiện)" error={errors.max_capacity_parcels}>
              <Input
                type="number"
                min="1"
                step="1"
                value={draft.max_capacity_parcels}
                onChange={(event) => update("max_capacity_parcels", event.target.value)}
              />
            </Field>
            <Field label="Giờ hoạt động (HH:mm-HH:mm)" error={errors.operating_hours}>
              <Input value={draft.operating_hours} onChange={(event) => update("operating_hours", event.target.value)} />
            </Field>
          </div>

          <LocationFields
            draft={draft}
            errors={errors}
            provinces={provinces}
            districts={districts}
            wards={wards}
            update={update}
            setLocation={setLocation}
          />

          <Field label="Trạng thái">
            <Select value={draft.is_active} onValueChange={(value) => update("is_active", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Đang hoạt động</SelectItem>
                <SelectItem value="0">Ngưng hoạt động</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : warehouse ? "Lưu thay đổi" : "Thêm kho"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NetworkOrgPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getBranches(), getWarehouses()])
      .then(([branchData, warehouseData]) => {
        if (!active) return;
        setBranches(branchData);
        setWarehouses(warehouseData);
        setSelectedBranchId((current) =>
          current !== null && branchData.some((branch) => branch.id === current)
            ? current
            : null,
        );
      })
      .catch((error: unknown) => {
        if (active) {
          toast.error(
            `Không thể tải dữ liệu mạng lưới: ${getErrorMessage(error)}`,
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const visibleWarehouses = warehouses.filter(
    (warehouse) =>
      selectedBranchId === null || warehouse.branch_id === selectedBranchId,
  );
  const stats = useMemo(
    () => ({
      activeBranches: branches.filter((branch) => branch.is_active).length,
      activeWarehouses: warehouses.filter((warehouse) => warehouse.is_active).length,
    }),
    [branches, warehouses],
  );

  async function saveBranch(id: number | undefined, input: BranchInput): Promise<boolean> {
    try {
      const saved = id ? await updateBranch(id, input) : await createBranch(input);
      setBranches((current) =>
        id
          ? current.map((branch) => (branch.id === id ? saved : branch))
          : [...current, saved],
      );
      toast.success(id ? "Đã cập nhật đơn vị." : "Đã thêm đơn vị.");
      return true;
    } catch (error) {
      toast.error(`Không thể lưu đơn vị: ${getErrorMessage(error)}`);
      return false;
    }
  }

  async function saveWarehouse(
    id: number | undefined,
    input: WarehouseInput,
  ): Promise<boolean> {
    try {
      const saved = id
        ? await updateWarehouse(id, input)
        : await createWarehouse(input);
      setWarehouses((current) =>
        id
          ? current.map((warehouse) => (warehouse.id === id ? saved : warehouse))
          : [...current, saved],
      );
      toast.success(id ? "Đã cập nhật kho." : "Đã thêm kho.");
      return true;
    } catch (error) {
      toast.error(`Không thể lưu kho: ${getErrorMessage(error)}`);
      return false;
    }
  }

  async function removeBranch(branch: Branch) {
    const hasChildren = branches.some(
      (item) => item.parent_branch_id === branch.id,
    );
    const hasWarehouses = warehouses.some(
      (warehouse) => warehouse.branch_id === branch.id,
    );
    if (hasChildren || hasWarehouses) {
      toast.error("Chỉ có thể xóa đơn vị chưa có cấp dưới hoặc kho trực thuộc.");
      return;
    }
    if (!window.confirm(`Xóa đơn vị "${branch.name}"?`)) return;

    try {
      await deleteBranch(branch.id);
      setBranches((current) => current.filter((item) => item.id !== branch.id));
      if (selectedBranchId === branch.id) setSelectedBranchId(null);
      toast.success("Đã xóa đơn vị.");
    } catch (error) {
      toast.error(`Không thể xóa đơn vị: ${getErrorMessage(error)}`);
    }
  }

  async function removeWarehouse(warehouse: Warehouse) {
    if (!window.confirm(`Xóa kho "${warehouse.name}"?`)) return;
    try {
      await deleteWarehouse(warehouse.id);
      setWarehouses((current) => current.filter((item) => item.id !== warehouse.id));
      toast.success("Đã xóa kho.");
    } catch (error) {
      toast.error(`Không thể xóa kho: ${getErrorMessage(error)}`);
    }
  }

  function renderBranchRows(parentId: number | null, depth = 0): ReactNode[] {
    return branches
      .filter((branch) => branch.parent_branch_id === parentId)
      .sort((left, right) => BRANCH_TYPES.indexOf(left.branch_type) - BRANCH_TYPES.indexOf(right.branch_type))
      .flatMap((branch) => [
        <TableRow
          key={branch.id}
          className={selectedBranchId === branch.id ? "bg-muted/60" : undefined}
        >
          <TableCell className="min-w-60">
            <button
              type="button"
              className="flex items-center gap-2 text-left font-medium hover:text-primary"
              style={{ paddingLeft: `${depth * 20}px` }}
              onClick={() =>
                setSelectedBranchId((current) => current === branch.id ? null : branch.id)
              }
            >
              {depth > 0 ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-primary" />}
              <span>
                <span className="block">{branch.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{branch.code}</span>
              </span>
            </button>
          </TableCell>
          <TableCell><Badge variant="outline">{branchTypeLabels[branch.branch_type]}</Badge></TableCell>
          <TableCell>{branch.operating_hours || "—"}</TableCell>
          <TableCell>
            <Badge variant={branch.is_active ? "secondary" : "outline"}>
              {branch.is_active ? "Hoạt động" : "Tạm ngưng"}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              {branch.branch_type !== "post_office" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Thêm đơn vị cấp dưới cho ${branch.name}`}
                  title="Thêm đơn vị cấp dưới"
                  onClick={() =>
                    setDialog({
                      kind: "branch",
                      suggestedParentId: branch.id,
                    })
                  }
                >
                  <CirclePlus className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Sửa ${branch.name}`}
                onClick={() => setDialog({ kind: "branch", branch })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Xóa ${branch.name}`}
                onClick={() => void removeBranch(branch)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>,
        ...renderBranchRows(branch.id, depth + 1),
      ]);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Quản trị mạng lưới</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Trung tâm, chi nhánh & kho bãi
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quản lý cây đơn vị từ trụ sở đến bưu cục và các kho trực thuộc.
          </p>
        </div>
        <Button
          onClick={() =>
            setDialog({
              kind: "branch",
              suggestedParentId:
                selectedBranch?.branch_type === "post_office"
                  ? undefined
                  : selectedBranchId ?? undefined,
            })
          }
        >
          <Plus className="h-4 w-4" />
          Thêm đơn vị
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 className="h-5 w-5" /></span>
            <div><p className="text-sm text-muted-foreground">Tổng đơn vị</p><p className="text-2xl font-semibold">{branches.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700"><Building2 className="h-5 w-5" /></span>
            <div><p className="text-sm text-muted-foreground">Đơn vị hoạt động</p><p className="text-2xl font-semibold">{stats.activeBranches}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="rounded-lg bg-amber-500/10 p-2 text-amber-700"><WarehouseIcon className="h-5 w-5" /></span>
            <div><p className="text-sm text-muted-foreground">Kho hoạt động</p><p className="text-2xl font-semibold">{stats.activeWarehouses}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Cây đơn vị</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Trụ sở → Trung tâm vùng → Chi nhánh → Bưu cục</p>
          </div>
          {selectedBranch && selectedBranch.branch_type !== "post_office" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDialog({
                  kind: "branch",
                  suggestedParentId: selectedBranch.id,
                })
              }
            >
              <CirclePlus className="h-4 w-4" /> Thêm cấp dưới
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Đang tải mạng lưới...</p>
          ) : branches.length === 0 ? (
            <div className="py-10 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Chưa có đơn vị mạng lưới.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Giờ hoạt động</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderBranchRows(null)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">
              {selectedBranch ? `Kho trực thuộc · ${selectedBranch.name}` : "Danh sách kho bãi"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedBranch ? "Kho gắn trực tiếp với đơn vị đang chọn." : "Chọn một đơn vị để lọc kho trực thuộc."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={branches.length === 0}
            onClick={() =>
              setDialog({
                kind: "warehouse",
                branchId: selectedBranchId ?? undefined,
              })
            }
          >
            <Plus className="h-4 w-4" /> Thêm kho
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Đang tải kho bãi...</p>
          ) : visibleWarehouses.length === 0 ? (
            <div className="py-10 text-center">
              <WarehouseIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {selectedBranch ? "Đơn vị này chưa có kho trực thuộc." : "Chưa có kho bãi."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kho</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Loại kho</TableHead>
                  <TableHead>Địa điểm</TableHead>
                  <TableHead>Giờ hoạt động</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleWarehouses.map((warehouse) => {
                  const owner = branches.find((branch) => branch.id === warehouse.branch_id);
                  const provinceName = networkOrgLocations.provinces.find(
                    (province) => province.id === (warehouse.province_id ?? owner?.province_id),
                  )?.name;
                  return (
                    <TableRow key={warehouse.id}>
                      <TableCell>
                        <span className="block font-medium">{warehouse.name}</span>
                        <span className="text-xs text-muted-foreground">{warehouse.code}</span>
                      </TableCell>
                      <TableCell>{owner?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{warehouseTypeLabels[warehouse.warehouse_type]}</Badge></TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {provinceName ?? "Chưa cập nhật"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                          {warehouse.operating_hours ?? owner?.operating_hours ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Sửa ${warehouse.name}`}
                            onClick={() => setDialog({ kind: "warehouse", warehouse })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Xóa ${warehouse.name}`}
                            onClick={() => void removeWarehouse(warehouse)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {dialog?.kind === "branch" ? (
        <BranchFormDialog
          key={dialog.branch?.id ?? `new-${dialog.suggestedParentId ?? "root"}`}
          branch={dialog.branch}
          branches={branches}
          suggestedParentId={dialog.suggestedParentId}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSave={(input) => saveBranch(dialog.branch?.id, input)}
        />
      ) : null}
      {dialog?.kind === "warehouse" ? (
        <WarehouseFormDialog
          key={dialog.warehouse?.id ?? `new-${dialog.branchId ?? "unassigned"}`}
          warehouse={dialog.warehouse}
          branches={branches}
          suggestedBranchId={dialog.branchId}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSave={(input) => saveWarehouse(dialog.warehouse?.id, input)}
        />
      ) : null}
    </section>
  );
}
