import { FileBarChart } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function ReportsAnalyticsPage() {
  return (
    <PagePlaceholder
      title="Báo cáo & phân tích"
      description="Khung trang tổng hợp dữ liệu vận hành và tài chính."
      icon={FileBarChart}
    />
  );
}
