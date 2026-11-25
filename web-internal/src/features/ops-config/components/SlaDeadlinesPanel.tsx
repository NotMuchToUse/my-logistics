import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OpsConfigFilterSelect } from "./OpsConfigFormFields";
import { OpsConfigTable, type OpsConfigColumn } from "./OpsConfigTable";
import { SlaDeadlineDialog } from "./SlaDeadlineDialog";
import { ROUTE_SCOPE_OPTIONS } from "../constants/ops-config.constants";
import type {
  OpsConfigLookups,
  OpsConfigFilters,
  SlaDeadline,
  SlaDeadlinePayload,
} from "../types/ops-config.types";

interface ResourceState<T, P> {
  data: T[];
  loading: boolean;
  mutating: boolean;
  error: string | null;
  page: number;
  search: string;
  filters: OpsConfigFilters;
  totalPages: number;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setFilter: (key: keyof OpsConfigFilters, value: string) => void;
  refresh: () => void;
  clearError: () => void;
  create: (payload: P) => Promise<unknown>;
  update: (id: string | number, payload: P) => Promise<unknown>;
}

interface SlaDeadlinesPanelProps {
  state: ResourceState<SlaDeadline, SlaDeadlinePayload>;
  lookups: OpsConfigLookups;
  lookupLoading: boolean;
  canEdit: boolean;
}

const ROUTE_LABELS = new Map(
  ROUTE_SCOPE_OPTIONS.map((option) => [option.value, option.label]),
);

function isActive(value: number | boolean) {
  return value === 1 || value === true;
}

function ActiveBadge({ value }: { value: number | boolean }) {
  const enabled = isActive(value);
  return (
    <Badge
      variant="outline"
      className={
        enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-700"
      }
    >
      {enabled ? "Đang áp dụng" : "Ngừng áp dụng"}
    </Badge>
  );
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

export function SlaDeadlinesPanel({
  state,
  lookups,
  lookupLoading,
  canEdit,
}: SlaDeadlinesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [record, setRecord] = useState<SlaDeadline | null>(null);

  const serviceLabel = (id: string | number) => {
    const service = lookups.service_types.find(
      (item) => String(item.id) === String(id),
    );
    return service
      ? `${service.code} — ${service.name}`
      : `Không có trong lookup (#${id})`;
  };

  const columns: OpsConfigColumn<SlaDeadline>[] = [
    {
      key: "service",
      label: "Dịch vụ",
      render: (row) => serviceLabel(row.service_type_id),
    },
    {
      key: "route_scope",
      label: "Phạm vi tuyến",
      render: (row) => ROUTE_LABELS.get(row.route_scope) ?? row.route_scope,
    },
    {
      key: "pickup",
      label: "Lấy hàng",
      render: (row) => `${row.pickup_sla_minutes.toLocaleString("vi-VN")} phút`,
    },
    {
      key: "warehouse",
      label: "Nhập kho",
      render: (row) =>
        `${row.warehouse_inbound_sla_minutes.toLocaleString("vi-VN")} phút`,
    },
    {
      key: "linehaul",
      label: "Trung chuyển",
      render: (row) => `${row.linehaul_sla_hours.toLocaleString("vi-VN")} giờ`,
    },
    {
      key: "delivery",
      label: "Giao hàng",
      render: (row) => `${row.delivery_sla_hours.toLocaleString("vi-VN")} giờ`,
    },
    {
      key: "storage",
      label: "Lưu kho",
      render: (row) =>
        `${row.max_storage_days_before_return.toLocaleString("vi-VN")} ngày`,
    },
    {
      key: "status",
      label: "Trạng thái",
      render: (row) => <ActiveBadge value={row.is_active} />,
    },
    {
      key: "updated",
      label: "Cập nhật gần nhất",
      render: (row) => displayDate(row.updated_at),
    },
  ];

  const openCreate = () => {
    setRecord(null);
    state.clearError();
    setDialogOpen(true);
  };

  const openEdit = (row: SlaDeadline) => {
    setRecord(row);
    state.clearError();
    setDialogOpen(true);
  };

  const save = async (payload: SlaDeadlinePayload) => {
    if (record) {
      await state.update(record.id, payload);
    } else {
      await state.create(payload);
    }
    setDialogOpen(false);
    toast.success(record ? "Đã cập nhật cấu hình SLA." : "Đã thêm cấu hình SLA.");
  };

  return (
    <>
      <OpsConfigTable
        title="SLA Deadline"
        description="Cấu hình các mốc thời gian cam kết và cảnh báo vận hành."
        rows={state.data}
        columns={columns}
        loading={state.loading}
        error={state.error}
        search={state.search}
        page={state.page}
        totalPages={state.totalPages}
        onSearch={(value) => {
          state.setSearch(value);
          state.setPage(1);
        }}
        onPageChange={state.setPage}
        onAdd={openCreate}
        onEdit={openEdit}
        onRetry={state.refresh}
        canEdit={canEdit}
        filterControls={
          <>
            <OpsConfigFilterSelect
              label="Dịch vụ"
              value={state.filters.service_type_id ?? ""}
              onChange={(value) => state.setFilter("service_type_id", value)}
              options={lookups.service_types.map((item) => ({
                value: String(item.id),
                label: `${item.code} — ${item.name}${isActive(item.is_active) ? "" : " (ngừng hoạt động)"}`,
              }))}
            />
            <OpsConfigFilterSelect
              label="Phạm vi tuyến"
              value={state.filters.route_scope ?? ""}
              onChange={(value) => state.setFilter("route_scope", value)}
              options={ROUTE_SCOPE_OPTIONS}
            />
            <OpsConfigFilterSelect
              label="Trạng thái"
              value={state.filters.is_active ?? ""}
              onChange={(value) => state.setFilter("is_active", value)}
              options={[
                { value: "1", label: "Đang áp dụng" },
                { value: "0", label: "Ngừng áp dụng" },
              ]}
            />
          </>
        }
      />
      {canEdit ? (
        <SlaDeadlineDialog
          open={dialogOpen}
          record={record}
          lookups={lookups}
          lookupLoading={lookupLoading}
          submitting={state.mutating}
          serverError={state.error}
          onOpenChange={setDialogOpen}
          onSubmit={save}
        />
      ) : null}
    </>
  );
}
