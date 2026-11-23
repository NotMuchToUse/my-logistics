import { Banknote } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function PricingCatalogPage() {
  return (
    <PagePlaceholder
      title="Danh mục & bảng giá"
      description="Khung trang cho dịch vụ vận chuyển, phụ phí và bảng giá."
      icon={Banknote}
    />
  );
}
