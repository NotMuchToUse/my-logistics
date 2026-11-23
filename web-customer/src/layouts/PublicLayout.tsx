import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, PackageCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const publicLinks = [
  { to: "/tracking", label: "Tra cứu vận đơn" },
  { to: "/branches", label: "Tìm bưu cục" },
  { to: "/rate-calculator", label: "Ước tính cước" },
];

function PublicNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="flex flex-col gap-1 md:flex-row md:items-center md:gap-6"
    >
      {publicLinks.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function PublicLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          >
            <PackageCheck className="h-5 w-5" aria-hidden="true" />
            <span>Vietstar Logistics</span>
          </Link>

          <div className="hidden md:block">
            <PublicNavigation />
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Đăng nhập
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">Đăng ký</Link>
            </Button>
          </div>

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Mở menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Vietstar Logistics</SheetTitle>
              </SheetHeader>
              <PublicNavigation
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
              <div className="mt-auto flex flex-col gap-2">
                <Button asChild variant="outline">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Đăng nhập
                  </Link>
                </Button>
                <Button asChild>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Đăng ký
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="container flex-1 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t bg-muted/30">
        <div className="container flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Vietstar Logistics — Dịch vụ chuyển phát trong nước.</p>
          <p>Đồng hành cùng mọi hành trình.</p>
        </div>
      </footer>
    </div>
  );
}
