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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { labels } from "../utils/format";
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
    [open, setOpen] = useState(false),
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
  useEffect(() => {
    setOpen(false);
    document.title = `${title} · Smart Building`;
  }, [location.pathname, title]);
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
          <strong>Smart Building</strong>
          <small>FACILITIES PORTAL</small>
        </div>
      </div>
      <p className="nav-label">
        {user.role === "ADMIN" ? "CAMPUS MANAGEMENT" : "MY WORKSPACE"}
      </p>
      <nav aria-label="Main navigation">
        {items.map(([route, label, Icon]) => (
          <NavLink
            key={route}
            to={`${prefix}/${route}`}
            end={route === "requests"}
            onClick={() => setOpen(false)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-info">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{labels[user.role]}</small>
          </div>
        </div>
        <button className="logout" onClick={logout}>
          <LogOut size={18} />
          Sign out
        </button>
        <small className="campus-foot">Smart Campus · CET333</small>
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
        aria-label="Navigation"
      >
        <button
          className="drawer-close icon-button"
          aria-label="Close menu"
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
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>
              Smart Campus <span className="breadcrumb">/</span>{" "}
              <strong>{title}</strong>
            </span>
          </div>
          <div className="topbar-user">
            <span>{labels[user.role]}</span>
            <span className="avatar">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        <main id="main-content" className="page" key={location.pathname}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          Smart Building Monitoring System{" "}
          <span>Campus facilities, connected.</span>
        </footer>
      </div>
    </div>
  );
}
