import { ClipboardList } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function WarehouseAuditPage() {
  return (
    <PagePlaceholder
      title="Kiểm kê kho"
      description="Khung trang kiểm kê và đối chiếu hàng tồn kho."
      icon={ClipboardList}
    />
  );
}
