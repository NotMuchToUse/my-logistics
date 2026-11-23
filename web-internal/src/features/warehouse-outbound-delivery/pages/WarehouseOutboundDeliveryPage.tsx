import { PackageCheck } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function WarehouseOutboundDeliveryPage() {
  return (
    <PagePlaceholder
      title="Xuất kho giao hàng"
      description="Khung trang quản lý xuất kho giao hàng chặng cuối."
      icon={PackageCheck}
    />
  );
}
