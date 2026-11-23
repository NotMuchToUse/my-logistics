import { Workflow } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function SystemLogsSettingsPage() {
  return (
    <PagePlaceholder
      title="Nhật ký & cài đặt hệ thống"
      description="Khung trang giám sát nhật ký và cấu hình hệ thống."
      icon={Workflow}
    />
  );
}
