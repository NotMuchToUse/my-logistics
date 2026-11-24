import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface CatalogDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function CatalogDeleteDialog({
  open,
  title,
  description,
  submitting,
  onOpenChange,
  onConfirm,
}: CatalogDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel="Xóa mềm"
      cancelLabel="Hủy"
      onConfirm={onConfirm}
      isLoading={submitting}
    />
  );
}
