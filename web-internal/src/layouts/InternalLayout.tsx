import { useState } from "react";
import { Outlet } from "react-router-dom";
import { DynamicSidebar } from "@/layouts/components/DynamicSidebar";
import { Topbar } from "@/layouts/components/Topbar";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";

export function InternalLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mustChangePassword = useAuthStore(
    (state) =>
      state.user?.must_change_password === 1 ||
      state.user?.must_change_password === true,
  );

  return (
    <div className="min-h-screen">
      <div
        aria-hidden={mustChangePassword || undefined}
        className={mustChangePassword ? "pointer-events-none select-none" : ""}
      >
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-background lg:block">
          <DynamicSidebar />
        </aside>

        <div className="lg:pl-64">
          <Topbar onOpenSidebar={() => setIsSidebarOpen(true)} />
          <main className="min-w-0 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>

        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Điều hướng vận hành</SheetTitle>
            </SheetHeader>
            <DynamicSidebar onNavigate={() => setIsSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <Dialog open={mustChangePassword}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Yêu cầu đổi mật khẩu</DialogTitle>
            <DialogDescription>
              Tài khoản cần đổi mật khẩu trước khi tiếp tục sử dụng cổng vận
              hành. Các thao tác bên dưới đang được khóa.
            </DialogDescription>
          </DialogHeader>
          <ChangePasswordForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
