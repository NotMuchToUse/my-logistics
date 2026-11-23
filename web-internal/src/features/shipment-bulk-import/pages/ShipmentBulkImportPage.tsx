import { FileInput } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function ShipmentBulkImportPage() {
  return (
    <PagePlaceholder
      title="Nhập vận đơn hàng loạt"
      description="Khung trang nhập dữ liệu vận đơn theo lô."
      icon={FileInput}
    />
  );
}
