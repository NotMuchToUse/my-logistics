import { PackageCheck } from "lucide-react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { PublicLayout } from "@/layouts/PublicLayout";
import { CustomerLayout } from "@/layouts/CustomerLayout";
import { ProtectedRoute } from "@/core/guards/ProtectedRoute";
import { AuthPage } from "@/features/auth/pages/AuthPage";
import { TrackingPage } from "@/features/tracking/pages/TrackingPage";
import { BranchLocatorPage } from "@/features/branch-locator/pages/BranchLocatorPage";
import { RateCalculatorPage } from "@/features/rate-calculator/pages/RateCalculatorPage";
import { AddressBookPage } from "@/features/address-book/pages/AddressBookPage";
import { PickupCreatePage } from "@/features/pickup-create/pages/PickupCreatePage";
import { MyShipmentsPage } from "@/features/my-shipments/pages/MyShipmentsPage";

function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-5 py-12 text-center sm:py-20">
      <PackageCheck
        className="h-12 w-12 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Dịch vụ chuyển phát Vietstar
        </h1>
        <p className="text-muted-foreground sm:text-lg">
          Tra cứu hành trình, tìm bưu cục và ước tính cước phí vận chuyển.
        </p>
      </div>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="space-y-3 py-12 text-center">
      <h1 className="text-2xl font-bold">Không tìm thấy trang</h1>
      <p className="text-sm text-muted-foreground">
        Đường dẫn bạn truy cập không tồn tại.
      </p>
    </section>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="tracking" element={<TrackingPage />} />
          <Route path="branches" element={<BranchLocatorPage />} />
          <Route path="rate-calculator" element={<RateCalculatorPage />} />
          <Route path="login" element={<AuthPage />} />
          <Route path="register" element={<AuthPage />} />
          <Route path="not-found" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Route>
        <Route
          path="customer"
          element={
            <ProtectedRoute>
              <CustomerLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<Navigate to="/customer/shipments" replace />}
          />
          <Route path="address-book" element={<AddressBookPage />} />
          <Route path="pickup-create" element={<PickupCreatePage />} />
          <Route path="shipments" element={<MyShipmentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
