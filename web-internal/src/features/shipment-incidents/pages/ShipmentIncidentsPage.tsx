import { Activity } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function ShipmentIncidentsPage() {
  return (
    <PagePlaceholder
      title="Sự cố vận đơn"
      description="Khung trang báo cáo và theo dõi sự cố vận đơn."
      icon={Activity}
    />
  );
}
