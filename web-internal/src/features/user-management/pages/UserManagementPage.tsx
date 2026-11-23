import { Users } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function UserManagementPage() {
  return (
    <PagePlaceholder
      title="Người dùng & phân quyền"
      description="Khung trang quản lý tài khoản và phạm vi làm việc."
      icon={Users}
    />
  );
}
