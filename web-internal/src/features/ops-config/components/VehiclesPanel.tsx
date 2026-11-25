import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OpsConfigFilterSelect } from "./OpsConfigFormFields";
import { OpsConfigTable, type OpsConfigColumn } from "./OpsConfigTable";
import { VehicleDialog } from "./VehicleDialog";
import {
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "../constants/ops-config.constants";
import type {
  OpsConfigFilters,
  OpsConfigLookups,
  Vehicle,
  VehiclePayload,
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

interface VehiclesPanelProps {
  state: ResourceState<Vehicle, VehiclePayload>;
  lookups: OpsConfigLookups;
  lookupLoading: boolean;
  canEdit: boolean;
}

const VEHICLE_TYPE_LABELS = new Map(
  VEHICLE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);
const VEHICLE_STATUS_LABELS = new Map(
  VEHICLE_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

function referenceLabel(
  rows: OpsConfigLookups["branches"],
  id: string | number,
) {
  const row = rows.find((item) => String(item.id) === String(id));
  return row ? `${row.code} — ${row.name}` : `Không có trong lookup (#${id})`;
}

function VehicleStatusBadge({ status }: { status: Vehicle["status"] }) {
  const color =
    status === "available"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "in_transit"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : status === "maintenance"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";
  return (
    <Badge variant="outline" className={color}>
      {VEHICLE_STATUS_LABELS.get(status) ?? status}
    </Badge>
  );
}

export function VehiclesPanel({
  state,
  lookups,
  lookupLoading,
  canEdit,
}: VehiclesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [record, setRecord] = useState<Vehicle | null>(null);

  const columns: OpsConfigColumn<Vehicle>[] = [
    {
      key: "plate_number",
      label: "Biển số / Mã hiệu",
      render: (row) => (
        <span className="font-mono text-sm">{row.plate_number}</span>
      ),
    },
    {
      key: "type",
      label: "Loại phương tiện",
      render: (row) => VEHICLE_TYPE_LABELS.get(row.vehicle_type) ?? row.vehicle_type,
    },
    {
      key: "branch",
      label: "Chi nhánh quản lý",
      render: (row) => referenceLabel(lookups.branches, row.branch_id),
    },
    {
      key: "partner",
      label: "Đối tác",
      render: (row) => {
        if (row.partner_id === null) return "Phương tiện công ty";
        const partner = lookups.partners.find(
          (item) => String(item.id) === String(row.partner_id),
        );
        return partner
          ? `${partner.code} — ${partner.name}`
          : `Không có trong lookup (#${row.partner_id})`;
      },
    },
    {
      key: "payload",
      label: "Tải trọng tối đa",
      className: "text-right tabular-nums",
      render: (row) => `${row.max_payload_kg} kg`,
    },
    {
      key: "driver",
      label: "Tài xế mặc định",
      render: (row) => {
        if (row.default_driver_id === null) return "Chưa gán tài xế";
        const driver = lookups.drivers.find(
          (item) => String(item.id) === String(row.default_driver_id),
        );
        return driver
          ? driver.full_name
          : `Không có trong lookup (#${row.default_driver_id})`;
      },
    },
    {
      key: "status",
      label: "Trạng thái",
      render: (row) => <VehicleStatusBadge status={row.status} />,
    },
  ];

  const openCreate = () => {
    setRecord(null);
    state.clearError();
    setDialogOpen(true);
  };
  const openEdit = (row: Vehicle) => {
    setRecord(row);
    state.clearError();
    setDialogOpen(true);
  };
  const save = async (payload: VehiclePayload) => {
    if (record) {
      await state.update(record.id, payload);
    } else {
      await state.create(payload);
    }
    setDialogOpen(false);
    toast.success(record ? "Đã cập nhật phương tiện." : "Đã thêm phương tiện.");
  };

  return (
    <>
      <OpsConfigTable
        title="Phương tiện"
        description="Quản lý phương tiện theo chi nhánh, đối tác, tải trọng và tài xế mặc định."
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
              label="Loại phương tiện"
              value={state.filters.vehicle_type ?? ""}
              onChange={(value) => state.setFilter("vehicle_type", value)}
              options={VEHICLE_TYPE_OPTIONS}
            />
            <OpsConfigFilterSelect
              label="Chi nhánh"
              value={state.filters.branch_id ?? ""}
              onChange={(value) => state.setFilter("branch_id", value)}
              options={lookups.branches.map((item) => ({
                value: String(item.id),
                label: `${item.code} — ${item.name}${item.is_active === 1 || item.is_active === true ? "" : " (ngừng hoạt động)"}`,
              }))}
            />
            <OpsConfigFilterSelect
              label="Đối tác"
              value={state.filters.partner_id ?? ""}
              onChange={(value) => state.setFilter("partner_id", value)}
              options={[
                { value: "null", label: "Phương tiện công ty" },
                ...lookups.partners.map((item) => ({
                  value: String(item.id),
                  label: `${item.code} — ${item.name}${item.is_active === 1 ? "" : " (ngừng hoạt động)"}`,
                })),
              ]}
            />
            <OpsConfigFilterSelect
              label="Trạng thái"
              value={state.filters.status ?? ""}
              onChange={(value) => state.setFilter("status", value)}
              options={VEHICLE_STATUS_OPTIONS}
            />
          </>
        }
      />
      {canEdit ? (
        <VehicleDialog
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
