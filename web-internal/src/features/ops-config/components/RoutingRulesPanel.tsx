import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OpsConfigFilterSelect } from "./OpsConfigFormFields";
import { OpsConfigTable, type OpsConfigColumn } from "./OpsConfigTable";
import { RoutingRuleDialog } from "./RoutingRuleDialog";
import { TRANSPORT_MODE_OPTIONS } from "../constants/ops-config.constants";
import type {
  BranchRoutingRule,
  BranchRoutingRulePayload,
  OpsConfigFilters,
  OpsConfigLookups,
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

interface RoutingRulesPanelProps {
  state: ResourceState<BranchRoutingRule, BranchRoutingRulePayload>;
  lookups: OpsConfigLookups;
  lookupLoading: boolean;
  canEdit: boolean;
}

const TRANSPORT_LABELS = new Map(
  TRANSPORT_MODE_OPTIONS.map((option) => [option.value, option.label]),
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

export function RoutingRulesPanel({
  state,
  lookups,
  lookupLoading,
  canEdit,
}: RoutingRulesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [record, setRecord] = useState<BranchRoutingRule | null>(null);

  const warehouseLabel = (id: string | number) => {
    const warehouse = lookups.warehouses.find(
      (item) => String(item.id) === String(id),
    );
    return warehouse
      ? `${warehouse.code} — ${warehouse.name}`
      : `Không có trong lookup (#${id})`;
  };
  const branchLabel = (id: string | number) => {
    const branch = lookups.branches.find(
      (item) => String(item.id) === String(id),
    );
    return branch
      ? `${branch.code} — ${branch.name}`
      : `Không có trong lookup (#${id})`;
  };

  const columns: OpsConfigColumn<BranchRoutingRule>[] = [
    {
      key: "origin",
      label: "Kho xuất phát → Kho kế tiếp",
      render: (row) => (
        <span className="inline-flex min-w-max items-center gap-2">
          <span>{warehouseLabel(row.origin_warehouse_id)}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{warehouseLabel(row.next_hop_warehouse_id)}</span>
        </span>
      ),
    },
    {
      key: "destination",
      label: "Chi nhánh/Bưu cục đích",
      render: (row) => branchLabel(row.destination_branch_id),
    },
    {
      key: "transport",
      label: "Phương thức",
      render: (row) =>
        TRANSPORT_LABELS.get(row.transport_mode) ?? row.transport_mode,
    },
    {
      key: "transit",
      label: "Thời gian dự kiến",
      render: (row) =>
        `${row.estimated_transit_hours.toLocaleString("vi-VN")} giờ`,
    },
    {
      key: "status",
      label: "Trạng thái",
      render: (row) => <ActiveBadge value={row.is_active} />,
    },
  ];

  const openCreate = () => {
    setRecord(null);
    state.clearError();
    setDialogOpen(true);
  };
  const openEdit = (row: BranchRoutingRule) => {
    setRecord(row);
    state.clearError();
    setDialogOpen(true);
  };
  const save = async (payload: BranchRoutingRulePayload) => {
    if (record) {
      await state.update(record.id, payload);
    } else {
      await state.create(payload);
    }
    setDialogOpen(false);
    toast.success(
      record
        ? "Đã cập nhật quy tắc định tuyến."
        : "Đã thêm quy tắc định tuyến.",
    );
  };

  return (
    <>
      <OpsConfigTable
        title="Ma trận định tuyến kho"
        description="Hiển thị riêng kho xuất phát, chi nhánh đích và kho trung chuyển kế tiếp."
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
              label="Kho xuất phát"
              value={state.filters.origin_warehouse_id ?? ""}
              onChange={(value) =>
                state.setFilter("origin_warehouse_id", value)
              }
              options={lookups.warehouses.map((item) => ({
                value: String(item.id),
                label: `${item.code} — ${item.name}${isActive(item.is_active) ? "" : " (ngừng hoạt động)"}`,
              }))}
            />
            <OpsConfigFilterSelect
              label="Chi nhánh/Bưu cục đích"
              value={state.filters.destination_branch_id ?? ""}
              onChange={(value) =>
                state.setFilter("destination_branch_id", value)
              }
              options={lookups.branches.map((item) => ({
                value: String(item.id),
                label: `${item.code} — ${item.name}${isActive(item.is_active) ? "" : " (ngừng hoạt động)"}`,
              }))}
            />
            <OpsConfigFilterSelect
              label="Phương thức"
              value={state.filters.transport_mode ?? ""}
              onChange={(value) => state.setFilter("transport_mode", value)}
              options={TRANSPORT_MODE_OPTIONS}
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
        <RoutingRuleDialog
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
