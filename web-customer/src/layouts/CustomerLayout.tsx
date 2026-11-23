import { ContactRound, LogOut, Package, PackagePlus } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";

const customerLinks = [
  {
    to: "/customer/address-book",
    label: "Sổ địa chỉ",
    icon: ContactRound,
  },
  {
    to: "/customer/pickup-create",
    label: "Tạo yêu cầu gửi hàng",
    icon: PackagePlus,
  },
  {
    to: "/customer/shipments",
    label: "Lịch sử vận đơn",
    icon: Package,
  },
];

export function CustomerLayout() {
  const logout = useCustomerAuthStore((state) => state.logout);
  const navigate = useNavigate();

  function handleLogout(): void {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="font-semibold tracking-tight">
            Vietstar Logistics
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </Button>
        </div>
      </header>

      <div className="container grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-6 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0">
          <nav
            aria-label="Điều hướng khách hàng"
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
          >
            {customerLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 py-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
