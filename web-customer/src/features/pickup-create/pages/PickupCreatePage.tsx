import { PackagePlus } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function PickupCreatePage() {
  return (
    <PagePlaceholder
      title="Tạo yêu cầu gửi hàng"
      description="Tạo yêu cầu lấy hàng tận nơi hoặc mang hàng đến bưu cục."
      icon={PackagePlus}
    />
  );
}
