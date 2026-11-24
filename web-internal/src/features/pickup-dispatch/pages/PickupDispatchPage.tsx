import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PhoneCall,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import type { PickupRequestStatus } from "@/types/api.types";
import {
  getBranchOptions,
  getPickupRequests,
} from "../api/pickup-dispatch.api";
import { AssignDriverDialog } from "../components/AssignDriverDialog";
import { CancelPickupDialog } from "../components/CancelPickupDialog";
import { CreatePickupDialog } from "../components/CreatePickupDialog";
import { PickupDispatchTable } from "../components/PickupDispatchTable";
import type {
  BranchOption,
  PickupRequestItem,
} from "../types/pickup-dispatch.types";
import { evaluateSlaStatus } from "../utils/sla.utils";

export function PickupDispatchPage() {
  const activeBranchId = useBranchScopeStore((state) => state.activeBranchId);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranchId ? String(activeBranchId) : "all",
  );
  const [statusFilter, setStatusFilter] = useState<PickupRequestStatus | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [slaAlertOnly, setSlaAlertOnly] = useState(false);

  const [items, setItems] = useState<PickupRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PickupRequestItem | null>(
    null,
  );
  const [cancelTarget, setCancelTarget] = useState<PickupRequestItem | null>(
    null,
  );

  useEffect(() => {
    void getBranchOptions().then(setBranches);
  }, []);

  useEffect(() => {
    if (activeBranchId) {
      setSelectedBranchId(String(activeBranchId));
    }
  }, [activeBranchId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const branchNum =
        selectedBranchId !== "all" ? Number(selectedBranchId) : null;
      const data = await getPickupRequests({
        branch_id: branchNum,
        status: statusFilter,
        search: searchQuery,
      });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, statusFilter, searchQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    let pending = 0;
    let slaAlert = 0;
    let inProgress = 0;
    let pickedUp = 0;

    for (const item of items) {
      if (item.status === "pending") {
        pending += 1;
      }
      if (item.status === "assigned" || item.status === "accepted") {
        inProgress += 1;
      }
      if (item.status === "picked_up") {
        pickedUp += 1;
      }
      const sla = evaluateSlaStatus(item.sla_deadline_at, item.status);
      if (sla.urgency === "overdue" || sla.urgency === "warning") {
        slaAlert += 1;
      }
    }

    return { pending, slaAlert, inProgress, pickedUp };
  }, [items]);

  const displayedItems = useMemo(() => {
    const filtered = slaAlertOnly
      ? items.filter((item) => {
          const sla = evaluateSlaStatus(item.sla_deadline_at, item.status);
          return sla.urgency === "overdue" || sla.urgency === "warning";
        })
      : items;

    // Ưu tiên đưa đơn quá hạn / sắp trễ SLA lên đầu bảng
    return [...filtered].sort((a, b) => {
      const rank = { overdue: 0, warning: 1, normal: 2, completed: 3 };
      const ra = rank[evaluateSlaStatus(a.sla_deadline_at, a.status).urgency];
      const rb = rank[evaluateSlaStatus(b.sla_deadline_at, b.status).urgency];
      return ra - rb;
    });
  }, [items, slaAlertOnly]);

  function handleCreated(created: PickupRequestItem) {
    setItems((prev) => [created, ...prev]);
  }

  function handleUpdated(updated: PickupRequestItem) {
    setItems((prev) =>
      prev.map((item) =>
        item.public_id === updated.public_id ? updated : item,
      ),
    );
  }

  const defaultBranchForCreate =
    selectedBranchId !== "all"
      ? Number(selectedBranchId)
      : (activeBranchId ?? branches[0]?.id ?? 3);

  return (
    <div className="space-y-6 p-6">
      {/* Thanh tiêu đề & nút hành động */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Điều phối lấy hàng
          </h1>
          <p className="text-sm text-muted-foreground">
            Tiếp nhận yêu cầu lấy hàng, giám sát cảnh báo SLA và phân lệnh tài
            xế theo bưu cục.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PhoneCall className="mr-1.5 h-4 w-4" />
            Tạo yêu cầu lấy hàng
          </Button>
        </div>
      </div>

      {/* Thẻ KPI tổng quan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chờ phân công
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Yêu cầu mới chưa có tài xế
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            stats.slaAlert > 0 ? "border-red-300 bg-red-50/40" : undefined
          }
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700">
              Cảnh báo / Trễ SLA
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.slaAlert}
            </div>
            <p className="text-xs text-red-700/80">
              Sắp quá hạn (≤30p) hoặc đã trễ hẹn
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tài xế đang đi lấy
            </CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              Đã phân công hoặc tài xế đã nhận
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã lấy thành công
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pickedUp}</div>
            <p className="text-xs text-muted-foreground">
              Hoàn tất nhận hàng từ khách
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bộ lọc & Bảng danh sách */}
      <Card>
        <CardHeader className="space-y-4 border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={statusFilter}
              onValueChange={(val) =>
                setStatusFilter(val as PickupRequestStatus | "all")
              }
            >
              <TabsList className="flex-wrap">
                <TabsTrigger value="all">Tất cả</TabsTrigger>
                <TabsTrigger value="pending">Chờ phân công</TabsTrigger>
                <TabsTrigger value="assigned">Đã phân công</TabsTrigger>
                <TabsTrigger value="accepted">Đang lấy</TabsTrigger>
                <TabsTrigger value="picked_up">Đã lấy</TabsTrigger>
                <TabsTrigger value="pickup_failed">Thất bại</TabsTrigger>
                <TabsTrigger value="cancelled">Đã hủy</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              type="button"
              size="sm"
              variant={slaAlertOnly ? "destructive" : "outline"}
              onClick={() => setSlaAlertOnly((prev) => !prev)}
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Cảnh báo SLA
              {stats.slaAlert > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 bg-white/90 text-red-700"
                >
                  {stats.slaAlert}
                </Badge>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              value={selectedBranchId}
              onValueChange={setSelectedBranchId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lọc theo bưu cục" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả bưu cục</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.code} - {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative sm:col-span-1 lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tìm theo mã yêu cầu (PU...), tên khách gửi, SĐT, địa chỉ, tài xế..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <PickupDispatchTable
            items={displayedItems}
            loading={loading}
            onAssignClick={(item) => setAssignTarget(item)}
            onCancelClick={(item) => setCancelTarget(item)}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <CreatePickupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branches={branches}
        defaultBranchId={defaultBranchForCreate}
        onCreated={handleCreated}
      />

      <AssignDriverDialog
        request={assignTarget}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null);
          }
        }}
        onAssigned={handleUpdated}
      />

      <CancelPickupDialog
        request={cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
          }
        }}
        onCancelled={handleUpdated}
      />
    </div>
  );
}

export default PickupDispatchPage;