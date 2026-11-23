import { ShieldAlert } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function ShipmentExceptionsPage() {
  return (
    <PagePlaceholder
      title="Vận đơn chờ xử lý"
      description="Khung trang theo dõi các vận đơn phát sinh ngoại lệ."
      icon={ShieldAlert}
    />
  );
}
