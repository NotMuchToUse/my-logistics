import { LogOut, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";
import { useCustomerAuth } from "@/features/auth/hooks/useCustomerAuth";

interface HeaderAuthStatusProps {
  className?: string;
  onNavigate?: () => void;
}

export function HeaderAuthStatus({
  className,
  onNavigate,
}: HeaderAuthStatusProps) {
  const isAuthenticated = useCustomerAuthStore(
    (state) => state.isAuthenticated,
  );
  const user = useCustomerAuthStore((state) => state.user);
  const { logout } = useCustomerAuth();

  if (isAuthenticated) {
    return (
      <div className={className}>
        <Link
          to="/customer/shipments"
          onClick={onNavigate}
          className="flex min-w-0 flex-col gap-1 rounded-md px-2 py-1 text-sm hover:bg-accent"
        >
          <span className="truncate font-medium">
            {user?.public_id ?? "Khách hàng"}
          </span>
          <Badge variant="secondary" className="w-fit">
            Phiên đang hoạt động
          </Badge>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            onNavigate?.();
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Đăng xuất
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button asChild variant="ghost" size="sm">
        <Link to="/login" onClick={onNavigate}>
          <UserRound className="h-4 w-4" aria-hidden="true" />
          Đăng nhập
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link to="/register" onClick={onNavigate}>
          Đăng ký
        </Link>
      </Button>
    </div>
  );
}
