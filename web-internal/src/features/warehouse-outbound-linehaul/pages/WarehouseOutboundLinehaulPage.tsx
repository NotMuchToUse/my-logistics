import { FileOutput } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function WarehouseOutboundLinehaulPage() {
  return (
    <PagePlaceholder
      title="Xuất kho trung chuyển"
      description="Khung trang quản lý phiếu xuất kho trung chuyển."
      icon={FileOutput}
    />
  );
}
