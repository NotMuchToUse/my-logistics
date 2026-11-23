import { Banknote } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function BranchCodCollectionPage() {
  return (
    <PagePlaceholder
      title="Thu COD tại bưu cục"
      description="Khung trang thu và quản lý bảng kê tiền COD."
      icon={Banknote}
    />
  );
}
