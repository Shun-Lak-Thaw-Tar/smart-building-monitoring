import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ProtectedRoute, RoleRoute } from "./components/RouteGuards";
import { EmptyState, LoadingState } from "./components/UI";
import { homeFor } from "./utils/format";
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
function Home() {
  const { user, loading } = useAuth();
  return loading ? (
    <LoadingState />
  ) : (
    <Navigate to={user ? homeFor(user) : "/login"} replace />
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Suspense fallback={<LoadingState />}>
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
                      title="Page not found"
                      description="This page may have moved, or the address may be incorrect."
                    >
                      <Link className="button" to="/">
                        Return to your dashboard
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
  );
}
