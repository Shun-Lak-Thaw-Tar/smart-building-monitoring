import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../utils/format";
import { LoadingState } from "./UI";
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  return loading ? (
    <LoadingState />
  ) : user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
}
export function RoleRoute({ role }) {
  const { user } = useAuth();
  return user.role === role ? (
    <Outlet />
  ) : (
    <Navigate to={homeFor(user)} replace />
  );
}
