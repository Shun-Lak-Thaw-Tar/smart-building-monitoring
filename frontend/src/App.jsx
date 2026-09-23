import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ProtectedRoute, RoleRoute } from "./components/RouteGuards";
import { EmptyState, LoadingState } from "./components/UI";
import { homeFor } from "./utils/format";
import { useLanguage } from "./context/LanguageContext";
import AppShell from "./layouts/AppShell";
import Login from "./pages/Login";
import StaffDashboard from "./pages/StaffDashboard";
import NewRequest from "./pages/NewRequest";
import Requests from "./pages/Requests";
import RequestDetail from "./pages/RequestDetail";
const Monitoring = lazy(() => import("./pages/Monitoring"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Equipment = lazy(() => import("./pages/Equipment"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const StaffAccounts = lazy(() => import("./pages/StaffAccounts"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Energy = lazy(() => import("./pages/Energy"));
const Comfort = lazy(() => import("./pages/Comfort"));
const CampusOperations = lazy(() => import("./pages/CampusOperations"));
function Home() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  return loading ? (
    <LoadingState label={t("common.loading")} />
  ) : (
    <Navigate to={user ? homeFor(user) : "/login"} replace />
  );
}
export default function App() {
  return <LanguageProvider><Application /></LanguageProvider>;
}
function Application() {
  const { t } = useLanguage();
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <a href="#main-content" className="skip-link">
            {t("common.skipToContent")}
          </a>
          <Suspense fallback={<LoadingState label={t("common.loading")} />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute role="STAFF" />}>
                  <Route path="/staff" element={<AppShell />}>
                    <Route
                      index
                      element={<Navigate to="dashboard" replace />}
                    />
                    <Route path="dashboard" element={<StaffDashboard />} />
                    <Route path="requests/new" element={<NewRequest />} />
                    <Route path="requests" element={<Requests />} />
                    <Route path="requests/:id" element={<RequestDetail />} />
                    <Route path="monitoring" element={<Monitoring />} />
                  </Route>
                </Route>
                <Route element={<RoleRoute role="ADMIN" />}>
                  <Route path="/admin" element={<AppShell />}>
                    <Route path="equipment" element={<Equipment />} />
                    <Route path="maintenance" element={<Maintenance />} />
                    <Route path="staff" element={<StaffAccounts />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="energy" element={<Energy />} />
                    <Route path="comfort" element={<Comfort />} />
                    <Route path="operations" element={<CampusOperations />} />
                    <Route
                      index
                      element={<Navigate to="dashboard" replace />}
                    />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="requests" element={<Requests />} />
                    <Route path="requests/:id" element={<RequestDetail />} />
                    <Route path="monitoring" element={<Monitoring />} />
                  </Route>
                </Route>
              </Route>
              <Route
                path="*"
                element={
                  <div className="not-found">
                    <EmptyState
                      title={t("common.pageNotFound")}
                      description={t("common.pageNotFoundDescription")}
                    >
                      <Link className="button" to="/">
                        {t("common.returnDashboard")}
                      </Link>
                    </EmptyState>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
