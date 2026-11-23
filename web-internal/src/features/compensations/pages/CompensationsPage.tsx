import { FileText } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function CompensationsPage() {
  return (
    <PagePlaceholder
      title="Hồ sơ đền bù"
      description="Khung trang theo dõi hồ sơ xử lý đền bù."
      icon={FileText}
    />
  );
}
