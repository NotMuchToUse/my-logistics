import { PackageCheck } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function ShipmentDetailPage() {
  return (
    <PagePlaceholder
      title="Chi tiết vận đơn"
      description="Khung trang chi tiết, hành trình và lịch sử vận đơn."
      icon={PackageCheck}
    />
  );
}
