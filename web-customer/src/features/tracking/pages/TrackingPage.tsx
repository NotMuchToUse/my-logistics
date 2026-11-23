import { SearchCheck } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function TrackingPage() {
  return (
    <PagePlaceholder
      title="Tra cứu vận đơn"
      description="Theo dõi trạng thái và hành trình vận chuyển của đơn hàng."
      icon={SearchCheck}
    />
  );
}
