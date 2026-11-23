import { ContactRound } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function AddressBookPage() {
  return (
    <PagePlaceholder
      title="Sổ địa chỉ"
      description="Quản lý các địa chỉ gửi và nhận hàng đã lưu."
      icon={ContactRound}
    />
  );
}
