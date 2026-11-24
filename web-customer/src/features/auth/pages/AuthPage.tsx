import { KeyRound } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CustomerLoginForm } from "@/features/auth/components/CustomerLoginForm";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

type AuthMode = "login" | "register";

function isAuthMode(value: string | null): value is AuthMode {
  return value === "login" || value === "register";
}

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const mode: AuthMode = isAuthMode(requestedMode)
    ? requestedMode
    : location.pathname === "/register"
      ? "register"
      : "login";

  function handleModeChange(value: string): void {
    if (!isAuthMode(value)) {
      return;
    }

    navigate({
      pathname: value === "register" ? "/register" : "/login",
      search: `?mode=${value}`,
    });
  }

  return (
    <section className="mx-auto w-full max-w-lg py-4 sm:py-8">
      <Card>
        <CardHeader className="items-center text-center">
          <KeyRound className="h-9 w-9 text-primary" aria-hidden="true" />
          <CardTitle className="text-2xl">
            {mode === "register" ? "Tạo tài khoản khách hàng" : "Đăng nhập"}
          </CardTitle>
          <CardDescription>
            {mode === "register"
              ? "Đăng ký để quản lý sổ địa chỉ và vận đơn của bạn."
              : "Đăng nhập để quản lý địa chỉ và theo dõi các yêu cầu gửi hàng."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
              <TabsTrigger value="register">Đăng ký</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="pt-4">
              <CustomerLoginForm />
            </TabsContent>
            <TabsContent value="register" className="pt-4">
              <RegisterForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
