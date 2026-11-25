import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { useAddressBook } from "../hooks/useAddressBook";
import { AddressForm, type AddressFormProps } from "./AddressForm";

type AddressFormDialogState = AddressFormProps["addressBook"] &
  Pick<ReturnType<typeof useAddressBook>, "isFormOpen">;

export interface AddressFormDialogProps {
  addressBook: AddressFormDialogState;
}

export function AddressFormDialog({
  addressBook,
}: AddressFormDialogProps) {
  const isEditMode = addressBook.formMode.mode === "edit";
  const isEditAddressReady =
    !isEditMode || addressBook.editingAddress !== null;

  function handleOpenChange(open: boolean): void {
    if (open || addressBook.isSavingAddress) {
      return;
    }

    addressBook.closeForm();
  }

  return (
    <Dialog
      open={addressBook.isFormOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent
        className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto p-4 sm:p-6"
        onEscapeKeyDown={(event) => {
          if (addressBook.isSavingAddress) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (addressBook.isSavingAddress) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>
            {isEditMode ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Cập nhật thông tin địa chỉ đã lưu của bạn."
              : "Nhập thông tin địa chỉ gửi hoặc nhận hàng của bạn."}
          </DialogDescription>
        </DialogHeader>

        {isEditAddressReady ? (
          <AddressForm addressBook={addressBook} />
        ) : (
          <p
            className="py-6 text-center text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Đang chuẩn bị địa chỉ cần chỉnh sửa...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
