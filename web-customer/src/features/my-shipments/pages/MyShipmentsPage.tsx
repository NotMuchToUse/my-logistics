import { PackageSearch } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function MyShipmentsPage() {
  return (
    <PagePlaceholder
      title="Lịch sử vận đơn"
      description="Theo dõi các vận đơn và yêu cầu lấy hàng của bạn."
      icon={PackageSearch}
    />
  );
}
