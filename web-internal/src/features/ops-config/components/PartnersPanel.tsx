import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OpsConfigFilterSelect } from "./OpsConfigFormFields";
import { OpsConfigTable, type OpsConfigColumn } from "./OpsConfigTable";
import { PartnerDialog } from "./PartnerDialog";
import { PARTNER_TYPE_OPTIONS } from "../constants/ops-config.constants";
import type {
  OpsConfigFilters,
  ThirdPartyPartner,
  ThirdPartyPartnerPayload,
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

interface PartnersPanelProps {
  state: ResourceState<ThirdPartyPartner, ThirdPartyPartnerPayload>;
  canEdit: boolean;
}

const PARTNER_TYPE_LABELS = new Map(
  PARTNER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

function ActiveBadge({ value }: { value: number | boolean }) {
  const enabled = value === 1 || value === true;
  return (
    <Badge
      variant="outline"
      className={
        enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-700"
      }
    >
      {enabled ? "Đang hợp tác" : "Ngừng hợp tác"}
    </Badge>
  );
}

export function PartnersPanel({ state, canEdit }: PartnersPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [record, setRecord] = useState<ThirdPartyPartner | null>(null);

  const columns: OpsConfigColumn<ThirdPartyPartner>[] = [
    {
      key: "code",
      label: "Mã đối tác",
      render: (row) => <span className="font-mono text-sm">{row.code}</span>,
    },
    { key: "name", label: "Tên đối tác", render: (row) => row.name },
    {
      key: "type",
      label: "Loại đối tác",
      render: (row) =>
        PARTNER_TYPE_LABELS.get(row.partner_type) ?? row.partner_type,
    },
    {
      key: "contact",
      label: "Người liên hệ",
      render: (row) => row.contact_person ?? "—",
    },
    {
      key: "phone",
      label: "Số điện thoại",
      render: (row) => row.contact_phone ?? "—",
    },
    {
      key: "endpoint",
      label: "API endpoint",
      render: (row) => row.api_endpoint ?? "—",
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
  const openEdit = (row: ThirdPartyPartner) => {
    setRecord(row);
    state.clearError();
    setDialogOpen(true);
  };
  const save = async (payload: ThirdPartyPartnerPayload) => {
    if (record) {
      await state.update(record.id, payload);
    } else {
      await state.create(payload);
    }
    setDialogOpen(false);
    toast.success(record ? "Đã cập nhật đối tác." : "Đã thêm đối tác.");
  };

  return (
    <>
      <OpsConfigTable
        title="Đối tác 3PL"
        description="Quản lý thông tin đối tác; endpoint chỉ được lưu, không được gọi từ trình duyệt."
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
              label="Loại đối tác"
              value={state.filters.partner_type ?? ""}
              onChange={(value) => state.setFilter("partner_type", value)}
              options={PARTNER_TYPE_OPTIONS}
            />
            <OpsConfigFilterSelect
              label="Trạng thái"
              value={state.filters.is_active ?? ""}
              onChange={(value) => state.setFilter("is_active", value)}
              options={[
                { value: "1", label: "Đang hợp tác" },
                { value: "0", label: "Ngừng hợp tác" },
              ]}
            />
          </>
        }
      />
      {canEdit ? (
        <PartnerDialog
          open={dialogOpen}
          record={record}
          submitting={state.mutating}
          serverError={state.error}
          onOpenChange={setDialogOpen}
          onSubmit={save}
        />
      ) : null}
    </>
  );
}
