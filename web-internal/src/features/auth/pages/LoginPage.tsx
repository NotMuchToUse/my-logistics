import { KeyRound } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function LoginPage() {
  return (
    <PagePlaceholder
      title="Đăng nhập cổng vận hành"
      description="Đăng nhập bằng thông tin tài khoản nhân viên Vietstar."
      icon={KeyRound}
    />
  );
}
