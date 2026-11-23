import { useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function AuthPage() {
  const location = useLocation();
  const isRegistration = location.pathname === "/register";

  return (
    <PagePlaceholder
      title={isRegistration ? "Đăng ký khách hàng" : "Đăng nhập"}
      description={
        isRegistration
          ? "Tạo tài khoản khách hàng Vietstar Logistics."
          : "Đăng nhập để quản lý sổ địa chỉ và vận đơn của bạn."
      }
      icon={KeyRound}
    />
  );
}
