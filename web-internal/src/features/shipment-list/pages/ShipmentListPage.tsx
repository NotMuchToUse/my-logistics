import { PackageSearch } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function ShipmentListPage() {
  return (
    <PagePlaceholder
      title="Danh sách vận đơn"
      description="Khung trang tra cứu và theo dõi danh sách vận đơn."
      icon={PackageSearch}
    />
  );
}
