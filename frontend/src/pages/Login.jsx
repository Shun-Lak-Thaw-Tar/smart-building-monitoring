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
import { useLanguage } from "../context/LanguageContext";
import { errorMessage } from "../services/apiClient";
import { homeFor } from "../utils/format";
import { ErrorAlert, Field, LoadingState } from "../components/UI";
export default function Login() {
  const { t } = useLanguage();
  const { user, loading, temporarilyUnavailable, notice, login, logout, retry } = useAuth(),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  if (loading) return <LoadingState label={t("common.loading")} />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  if (temporarilyUnavailable)
    return (
      <div className="login-page">
        <main className="login-form-side session-unavailable">
          <div className="login-card">
            <p className="eyebrow">{t("login.sessionCheckUnavailable")}</p>
            <h2>{t("login.sessionUnavailableTitle")}</h2>
            <p className="muted">
              {t("login.sessionUnavailableDescription")}
            </p>
            <div className="form-actions">
              <button className="button" onClick={retry}>
                {t("login.retrySession")}
              </button>
              <button className="button secondary" onClick={logout}>
                {t("signOut")}
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
      setError("login.nameRequired");
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
          <strong>{t("shell.smartBuilding")}</strong>
          <small>{t("login.monitoringSystem")}</small>
          </div>
        </div>
        <div className="login-story-body">
          <span className="portal-label">{t("login.portalLabel")}</span>
          <h1>
            {t("shell.smartBuilding")}
            <br />
            <em>{t("login.monitoring")}</em>
            <br />
            <span className="login-title-note">{t("login.titleNote")}</span>
          </h1>
          <p>
            {t("login.story")}
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
              {t("login.campusMonitoring")}
            </span>
            <span>
              <Wrench size={17} aria-hidden="true" />
              {t("login.maintenanceManagement")}
            </span>
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              {t("login.secureAccess")}
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
          <p className="eyebrow">{t("login.welcome")}</p>
          <h2>{t("login.signIn")}</h2>
          <p className="muted">{t("login.accessPortal")}</p>
          <ErrorAlert message={t(error || notice)} />
          <form
            onSubmit={submit}
            onInvalidCapture={(e) => e.target.setCustomValidity(t("login.requiredValidation"))}
            onInputCapture={(e) => e.target.setCustomValidity("")}
            onChangeCapture={(e) => e.target.setCustomValidity("")}
          >
            <Field label={t("login.name")} required>
              {(id) => (
                <input
                  id={id}
                  name="name"
                  autoComplete="username"
                  required
                  maxLength={100}
                  placeholder={t("login.namePlaceholder")}
                />
              )}
            </Field>
            <Field label={t("login.password")} required>
              {(id) => (
                <div className="password-control">
                  <input
                    id={id}
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder={t("login.passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t(show ? "login.hidePassword" : "login.showPassword")}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              )}
            </Field>
            <Field label={t("login.signInAs")}>
              {(id) => (
                <select id={id} name="role">
                  <option value="STAFF">{t("STAFF")}</option>
                  <option value="ADMIN">{t("ADMIN")}</option>
                </select>
              )}
            </Field>
            <button className="button login-submit" disabled={busy}>
              {busy ? t("login.signingIn") : t("login.signIn")}
              <ArrowRight size={19} />
            </button>
          </form>
          <p className="login-help">
            {t("login.help")}
          </p>
        </div>
        <small className="login-footer">{t("shell.footerTitle")}</small>
      </main>
    </div>
  );
}
