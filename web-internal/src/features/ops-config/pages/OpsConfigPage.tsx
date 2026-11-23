import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function OpsConfigPage() {
  return (
    <PagePlaceholder
      title="Cấu hình vận hành"
      description="Khung trang cho SLA, quy tắc định tuyến và cấu hình khai thác."
      icon={Settings}
    />
  );
}
