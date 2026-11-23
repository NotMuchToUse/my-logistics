import { Gauge } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function HqFinancePage() {
  return (
    <PagePlaceholder
      title="Tài chính trung tâm"
      description="Khung trang theo dõi đối soát tài chính tại trung tâm."
      icon={Gauge}
    />
  );
}
