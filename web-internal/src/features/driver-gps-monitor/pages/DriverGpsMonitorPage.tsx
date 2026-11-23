import { MapPinned } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function DriverGpsMonitorPage() {
  return (
    <PagePlaceholder
      title="Giám sát GPS tài xế"
      description="Khung trang giám sát vị trí và trạng thái tài xế."
      icon={MapPinned}
    />
  );
}
