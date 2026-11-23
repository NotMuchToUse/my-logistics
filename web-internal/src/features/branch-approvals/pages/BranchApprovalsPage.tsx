import { ShieldCheck } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function BranchApprovalsPage() {
  return (
    <PagePlaceholder
      title="Phê duyệt chi nhánh"
      description="Khung trang xử lý các yêu cầu chờ phê duyệt."
      icon={ShieldCheck}
    />
  );
}
