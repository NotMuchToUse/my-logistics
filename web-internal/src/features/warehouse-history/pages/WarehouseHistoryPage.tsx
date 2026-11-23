import { FileClock } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function WarehouseHistoryPage() {
  return (
    <PagePlaceholder
      title="Lịch sử kho"
      description="Khung trang tra cứu lịch sử nhập, xuất kho."
      icon={FileClock}
    />
  );
}
