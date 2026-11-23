import { Navigate, useLocation } from "react-router-dom";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useCustomerAuthStore(
    (state) => state.isAuthenticated,
  );
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
