import { FileInput } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function WarehouseInboundPage() {
  return (
    <PagePlaceholder
      title="Nhập kho"
      description="Khung trang tiếp nhận và ghi nhận hàng nhập kho."
      icon={FileInput}
    />
  );
}
