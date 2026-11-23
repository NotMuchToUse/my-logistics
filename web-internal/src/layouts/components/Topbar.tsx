import { LoaderCircle, LogOut, Menu, PackageCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { logoutApi } from "@/features/auth/api/auth.api";
import { BranchSwitcher } from "@/layouts/components/BranchSwitcher";
import { toast } from "sonner";

export interface TopbarProps {
  onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const user = useAuthStore((state) => state.user);
  const roles = useAuthStore((state) => state.roles);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);

    try {
      await logoutApi();
      logout();
      navigate("/login", { replace: true });
    } catch {
      toast.error("Không thể đăng xuất an toàn. Vui lòng thử lại.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 min-w-0 items-center gap-3 px-4 sm:px-6">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Mở menu điều hướng"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        <Link
          to="/shipment-list"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight lg:hidden"
        >
          <PackageCheck className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Vietstar</span>
        </Link>

        <div className="min-w-0 flex-1">
          <BranchSwitcher />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden min-w-0 text-right xl:block">
            <p className="max-w-40 truncate text-sm font-medium">
              {user?.full_name ?? "Tài khoản"}
            </p>
            <p className="max-w-40 truncate text-xs text-muted-foreground">
              {roles[0] ?? "Chưa xác định vai trò"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isLoggingOut}
            onClick={handleLogout}
            aria-label="Đăng xuất"
          >
            {isLoggingOut ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {isLoggingOut ? "Đang đăng xuất" : "Đăng xuất"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
