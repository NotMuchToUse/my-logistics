import { Calculator } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function RateCalculatorPage() {
  return (
    <PagePlaceholder
      title="Ước tính cước phí"
      description="Tính cước vận chuyển theo tuyến đường và trọng lượng kiện hàng."
      icon={Calculator}
    />
  );
}
