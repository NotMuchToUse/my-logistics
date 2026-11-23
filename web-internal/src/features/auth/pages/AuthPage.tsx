import { UserCog } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function AuthPage() {
  return (
    <PagePlaceholder
      title="Tài khoản & xác thực"
      description="Quản lý phiên làm việc và bảo mật tài khoản nội bộ."
      icon={UserCog}
    />
  );
}
