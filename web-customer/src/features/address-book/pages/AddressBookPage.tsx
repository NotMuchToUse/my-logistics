import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AddressFormDialog } from "../components/AddressFormDialog";
import { AddressList } from "../components/AddressList";
import { useAddressBook } from "../hooks/useAddressBook";

export function AddressBookPage() {
  const addressBook = useAddressBook();
  const pageRef = useRef<HTMLDivElement>(null);
  const focusReturnTargetRef = useRef<HTMLButtonElement | null>(null);
  const hadOpenDialogRef = useRef(false);
  const isDialogOpen =
    addressBook.isFormOpen || addressBook.isDeleteDialogOpen;
  const pendingDeleteAddress = addressBook.pendingDeleteAddress;
  const pendingDeleteLabel =
    pendingDeleteAddress?.label.trim() || "Địa chỉ đã lưu";

  useEffect(() => {
    if (hadOpenDialogRef.current && !isDialogOpen) {
      if (focusReturnTargetRef.current?.isConnected) {
        focusReturnTargetRef.current.focus();
      } else {
        window.setTimeout(() => {
          if (
            document.activeElement === document.body ||
            document.activeElement === document.documentElement
          ) {
            pageRef.current?.querySelector("button")?.focus();
          }
        }, 250);
      }

      focusReturnTargetRef.current = null;
    }

    hadOpenDialogRef.current = isDialogOpen;
  }, [isDialogOpen]);

  function rememberFocusReturnTarget(
    event: ReactMouseEvent<HTMLDivElement>,
  ): void {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('[role="dialog"]')) {
      return;
    }

    const button = target.closest("button");
    const ariaLabel = button?.getAttribute("aria-label");
    const buttonText = button?.textContent?.trim();
    const isAddressAction =
      buttonText === "Thêm địa chỉ" ||
      ariaLabel?.startsWith("Sửa địa chỉ:") ||
      ariaLabel?.startsWith("Yêu cầu xóa địa chỉ:");

    if (button && isAddressAction) {
      focusReturnTargetRef.current = button;
    }
  }

  return (
    <div
      ref={pageRef}
      className="min-w-0"
      onClickCapture={rememberFocusReturnTarget}
    >
      <AddressList
        addressBook={addressBook}
        geographyCatalogs={addressBook.geographyCatalogs}
      />
      <AddressFormDialog addressBook={addressBook} />
      <ConfirmDialog
        open={addressBook.isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            addressBook.cancelDeleteAddress();
          }
        }}
        title="Xác nhận xóa địa chỉ"
        description={`Bạn có chắc muốn xóa địa chỉ "${pendingDeleteLabel}"?`}
        confirmLabel="Xóa địa chỉ"
        onConfirm={() => {
          void addressBook.confirmDeleteAddress();
        }}
        isLoading={addressBook.isDeletingAddress}
      />
    </div>
  );
}
