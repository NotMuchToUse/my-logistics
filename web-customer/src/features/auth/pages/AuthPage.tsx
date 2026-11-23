import { Link, useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";
import { CustomerLoginForm } from "@/features/auth/components/CustomerLoginForm";

export function AuthPage() {
  const location = useLocation();
  const isRegistration = location.pathname === "/register";

  if (!isRegistration) {
    return (
      <div className="flex justify-center py-4 sm:py-8">
        <CustomerLoginForm />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8">
      <PagePlaceholder
        title="Đăng ký khách hàng"
        description="Tạo tài khoản khách hàng Vietstar Logistics."
        icon={KeyRound}
      />
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Bạn đã có tài khoản?</CardTitle>
          <CardDescription>
            Đăng nhập để quản lý địa chỉ và vận đơn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/login">Đăng nhập</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
