import { FileCheck2 } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function BranchRemittancePage() {
  return (
    <PagePlaceholder
      title="Nộp tiền về trung tâm"
      description="Khung trang lập và theo dõi bảng kê nộp tiền."
      icon={FileCheck2}
    />
  );
}
