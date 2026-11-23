import { MapPin } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function BranchLocatorPage() {
  return (
    <PagePlaceholder
      title="Tìm bưu cục"
      description="Tìm kiếm bưu cục và chi nhánh Vietstar theo khu vực."
      icon={MapPin}
    />
  );
}
