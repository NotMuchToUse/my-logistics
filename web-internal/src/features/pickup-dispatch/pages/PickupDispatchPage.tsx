import { Truck } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function PickupDispatchPage() {
  return (
    <PagePlaceholder
      title="Điều phối lấy hàng"
      description="Khung trang tiếp nhận và điều phối yêu cầu lấy hàng."
      icon={Truck}
    />
  );
}
