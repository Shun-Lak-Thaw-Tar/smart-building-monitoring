import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Building2,
  CirclePlus,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorCog,
  Users,
  Wrench,
  X,
  Palette,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { ChangePasswordDialog } from "../components/ChangePasswordDialog";
const staff = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["requests/new", "New Request", CirclePlus],
  ["requests", "My Requests", ClipboardList],
  ["monitoring", "Building Monitoring", Activity],
];
const admin = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["requests", "Requests", ClipboardList],
  ["equipment", "Equipment", MonitorCog],
  ["maintenance", "Maintenance History", Wrench],
  ["monitoring", "Building Monitoring", Activity],
  ["staff", "Staff Accounts", Users],
];
export default function AppShell() {
  const { user, logout } = useAuth(),
    { preference, setPreference } = useTheme(),
    { language, setLanguage, t } = useLanguage(),
    [open, setOpen] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false),
    drawer = useRef(null),
    location = useLocation();
  const items = user.role === "ADMIN" ? admin : staff,
    prefix = `/${user.role.toLowerCase()}`;
  const title =
    [...items]
      .sort((a, b) => b[0].length - a[0].length)
      .find(([route]) =>
        location.pathname.startsWith(`${prefix}/${route}`),
      )?.[1] || "Campus Facilities";
  const displayTitle = t({
    Dashboard: "dashboard", "New Request": "newRequest", "My Requests": "myRequests",
    Requests: "requests", Equipment: "equipment", "Maintenance History": "maintenance",
    "Building Monitoring": "monitoring", "Staff Accounts": "staffAccounts",
    "Campus Facilities": "shell.campusFacilities",
  }[title]);
  useEffect(() => {
    setOpen(false);
    document.title = `${displayTitle} · Smart Building`;
  }, [location.pathname, displayTitle]);
  useEffect(() => {
    if (open) drawer.current.showModal();
    else drawer.current?.close();
  }, [open]);
  const sidebar = (
    <>
      <div className="brand">
        <div className="brand-mark">
          <Building2 size={26} />
        </div>
        <div>
          <strong>{t("shell.smartBuilding")}</strong>
          <span className="brand-system">{t("shell.monitoringSystem")}</span>
          <small>{t("shell.smartCampusFacilities")}</small>
        </div>
      </div>
      <p className="nav-label">
        {t(user.role === "ADMIN" ? "shell.campusManagement" : "shell.myWorkspace")}
      </p>
      <nav aria-label={t("shell.mainNavigation")}>
        {items.map(([route, label, Icon]) => (
          <NavLink
            key={route}
            to={`${prefix}/${route}`}
            end={route === "requests"}
            onClick={() => setOpen(false)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{t({ Dashboard: "dashboard", "New Request": "newRequest", "My Requests": "myRequests", Requests: "requests", Equipment: "equipment", "Maintenance History": "maintenance", "Building Monitoring": "monitoring", "Staff Accounts": "staffAccounts" }[label])}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-info">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{t(user.role)}</small>
          </div>
        </div>
        <button className="logout" onClick={logout}>
          <LogOut size={18} />
          {t("signOut")}
        </button>
        <button className="account-action" onClick={() => { setOpen(false); setPasswordOpen(true); }}>
          <KeyRound size={18} />
          {t("account.changePassword")}
        </button>
        <small className="campus-foot">{t("shell.campusFoot")}</small>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebar}</aside>
      <dialog
        ref={drawer}
        className="mobile-drawer"
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        aria-label={t("shell.navigation")}
      >
        <button
          className="drawer-close icon-button"
          aria-label={t("shell.closeMenu")}
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        {sidebar}
      </dialog>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button menu-toggle"
              aria-label={t("shell.openMenu")}
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>
              {t("shell.smartCampus")} <span className="breadcrumb">/</span>{" "}
              <strong>{displayTitle}</strong>
            </span>
          </div>
          <div className="topbar-user">
            <label className="theme-control">
              <Palette size={16} aria-hidden="true" />
              <span className="sr-only">{t("theme")}</span>
              <select
                aria-label={t("theme")}
                value={preference}
                onChange={(event) => setPreference(event.target.value)}
              >
                <option value="light">{t("light")}</option>
                <option value="dark">{t("dark")}</option>
                <option value="system">{t("system")}</option>
              </select>
            </label>
            <label className="theme-control language-control">
              <span className="sr-only">{t("language")}</span>
              <select aria-label={t("language")} value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="en">English</option>
                <option value="my">မြန်မာ</option>
              </select>
            </label>
            <span>{t(user.role)}</span>
            <span className="avatar">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        <main id="main-content" className="page" tabIndex={-1} key={location.pathname}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          {t("shell.footerTitle")} {" "}
          <span>{t("shell.footerTagline")}</span>
        </footer>
      </div>
      {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}
