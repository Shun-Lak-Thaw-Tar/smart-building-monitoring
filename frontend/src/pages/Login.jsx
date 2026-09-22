import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  University,
  Activity,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../services/apiClient";
import { homeFor } from "../utils/format";
import { ErrorAlert, Field, LoadingState } from "../components/UI";
export default function Login() {
  const { user, loading, temporarilyUnavailable, notice, login, logout, retry } = useAuth(),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  if (loading) return <LoadingState />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  if (temporarilyUnavailable)
    return (
      <div className="login-page">
        <main className="login-form-side session-unavailable">
          <div className="login-card">
            <p className="eyebrow">SESSION CHECK UNAVAILABLE</p>
            <h2>Unable to verify your session right now.</h2>
            <p className="muted">
              Your saved session is still protected. Try again when the service is available.
            </p>
            <div className="form-actions">
              <button className="button" onClick={retry}>
                Retry session check
              </button>
              <button className="button secondary" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const form = new FormData(e.currentTarget);
    if (!form.get("name").trim()) {
      setError("Please enter your name.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await login({
        name: form.get("name").trim(),
        password: form.get("password"),
        role: form.get("role"),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <div className="brand-mark">
            <Building2 />
          </div>
          <div>
            <strong>Smart Building</strong>
            <small>MONITORING SYSTEM</small>
          </div>
        </div>
        <div className="login-story-body">
          <span className="portal-label">SMART CAMPUS FACILITIES PORTAL</span>
          <h1>
            Smart Building
            <br />
            <em>Monitoring.</em>
            <br />
            <span className="login-title-note">A more connected campus.</span>
          </h1>
          <p>
            Monitor campus buildings, manage maintenance requests and keep
            facilities running smoothly.
          </p>
          <div className="campus-illustration" aria-hidden="true">
            <University size={126} strokeWidth={1} />
            <span className="campus-line" />
            <Building2 size={94} strokeWidth={1} />
          </div>
          <div className="campus-names">
            <span>Building 216</span>
            <span>Building 209</span>
            <span>JS Building</span>
          </div>
          <div className="login-features">
            <span>
              <Activity size={17} aria-hidden="true" />
              Campus Monitoring
            </span>
            <span>
              <Wrench size={17} aria-hidden="true" />
              Maintenance Management
            </span>
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              Secure Role-Based Access
            </span>
          </div>
        </div>
        <small>CET333 · Product Development</small>
      </section>
      <main id="main-content" className="login-form-side">
        <div className="login-card">
          <div className="login-lock">
            <LockKeyhole size={24} />
          </div>
          <p className="eyebrow">WELCOME TO YOUR WORKSPACE</p>
          <h2>Sign in</h2>
          <p className="muted">Access your campus facilities portal.</p>
          <ErrorAlert message={error || notice} />
          <form onSubmit={submit}>
            <Field label="Name" required>
              {(id) => (
                <input
                  id={id}
                  name="name"
                  autoComplete="username"
                  required
                  maxLength={100}
                  placeholder="Enter your name"
                />
              )}
            </Field>
            <Field label="Password" required>
              {(id) => (
                <div className="password-control">
                  <input
                    id={id}
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              )}
            </Field>
            <Field label="Sign in as">
              {(id) => (
                <select id={id} name="role">
                  <option value="STAFF">Office Staff</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              )}
            </Field>
            <button className="button login-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={19} />
            </button>
          </form>
          <p className="login-help">
            Use the account provided by your campus administrator.
          </p>
        </div>
        <small className="login-footer">Smart Building Monitoring System</small>
      </main>
    </div>
  );
}
