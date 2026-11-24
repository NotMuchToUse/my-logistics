import { useState } from "react";
import { toast } from "sonner";
import type { CatalogColumn } from "./CatalogTable";
import { CatalogTable } from "./CatalogTable";
import { CatalogCrudDialog, type CatalogKind } from "./CatalogCrudDialog";
import { CatalogDeleteDialog } from "./CatalogDeleteDialog";
import type { CatalogApiError } from "../hooks/pricing-catalog-state";

interface CatalogResourceState<T, P> {
  data: T[];
  loading: boolean;
  mutating: boolean;
  error: CatalogApiError | null;
  page: number;
  perPage: number;
  search: string;
  totalPages: number;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  refresh: () => void;
  create: (payload: P) => Promise<unknown> | null;
  update: (id: number, payload: P) => Promise<unknown> | null;
  remove: (id: number) => Promise<unknown> | null;
}

interface CatalogResourcePanelProps<T extends { id: number }, P> {
  kind: CatalogKind;
  title: string;
  description: string;
  state: CatalogResourceState<T, P>;
  columns: CatalogColumn<T>[];
  canManage: boolean;
}

export function CatalogResourcePanel<T extends { id: number }, P>({
  kind,
  title,
  description,
  state,
  columns,
  canManage,
}: CatalogResourcePanelProps<T, P>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRecord, setDialogRecord] = useState<Record<string, unknown> | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<Record<string, unknown> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openCreate = () => {
    setDialogRecord(null);
    setDialogOpen(true);
  };

  const openEdit = (row: T) => {
    setDialogRecord(row as unknown as Record<string, unknown>);
    setDialogOpen(true);
  };

  const openDelete = (row: T) => {
    setDeleteRecord(row as unknown as Record<string, unknown>);
    setDeleteOpen(true);
  };

  const submit = async (payload: Record<string, unknown>) => {
    let result: Promise<unknown> | null;
    if (dialogRecord?.id !== undefined) {
      result = state.update(Number(dialogRecord.id), payload as P);
    } else {
      result = state.create(payload as P);
    }
    if (result === null) return;

    try {
      await result;
      setDialogOpen(false);
      toast.success(dialogRecord ? `Đã cập nhật ${title.toLowerCase()}.` : `Đã thêm ${title.toLowerCase()}.`);
    } catch {
      return;
    }
  };

  const confirmDelete = async () => {
    if (deleteRecord?.id === undefined) return;
    const result = state.remove(Number(deleteRecord.id));
    if (result === null) return;
    try {
      await result;
      setDeleteOpen(false);
      setDeleteRecord(null);
      toast.success(`Đã xóa mềm ${title.toLowerCase()}.`);
    } catch {
      return;
    }
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <CatalogTable
        rows={state.data}
        columns={columns}
        loading={state.loading}
        error={state.error?.message ?? null}
        search={state.search}
        page={state.page}
        totalPages={state.totalPages}
        canManage={canManage}
        onSearch={(value) => {
          state.setSearch(value);
          state.setPage(1);
        }}
        onPageChange={state.setPage}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={openDelete}
        onRetry={state.refresh}
      />

      {canManage ? (
        <>
          <CatalogCrudDialog
            kind={kind}
            open={dialogOpen}
            record={dialogRecord}
            submitting={state.mutating}
            serverError={state.error?.message ?? null}
            onOpenChange={setDialogOpen}
            onSubmit={submit}
          />
          <CatalogDeleteDialog
            open={deleteOpen}
            title={`Xóa mềm ${title.toLowerCase()}`}
            description="Thao tác chỉ ngừng hoạt động bản ghi, không xóa cứng dữ liệu."
            submitting={state.mutating}
            onOpenChange={setDeleteOpen}
            onConfirm={() => void confirmDelete()}
          />
        </>
      ) : null}
    </section>
  );
}
