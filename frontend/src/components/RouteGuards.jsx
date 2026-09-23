import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../utils/format";
import { LoadingState } from "./UI";
import { useLanguage } from "../context/LanguageContext";
export function ProtectedRoute() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  return loading ? (
    <LoadingState label={t("common.loading")} />
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
