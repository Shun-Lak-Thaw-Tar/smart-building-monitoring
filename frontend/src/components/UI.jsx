import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Inbox, LoaderCircle, X, Circle } from "lucide-react";
import { labels } from "../utils/format";
export function Badge({ value }) {
  return (
    <span className={`badge badge-${value?.toLowerCase()}`}>
      <Circle size={7} fill="currentColor" aria-hidden="true" />
      {labels[value] || value}
    </span>
  );
}
export function PageHeader({
  title,
  description,
  children,
  eyebrow = "CAMPUS FACILITIES",
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}
export function LoadingState() {
  return (
    <div role="status" className="loading">
      <span className="sr-only">Loading…</span>
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-wide" />
    </div>
  );
}
export function ErrorAlert({ message, onRetry }) {
  return message ? (
    <div className="error-alert" role="alert">
      <AlertCircle size={20} />
      <span>{message}</span>
      {onRetry && (
        <button className="button secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  ) : null;
}
export function EmptyState({
  title = "Nothing here yet",
  description,
  children,
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function ResourceState({ resource, children }) {
  if (resource.loading) return <LoadingState />;
  if (resource.error)
    return <ErrorAlert message={resource.error} onRetry={resource.refresh} />;
  return children;
}
export function SubmitButton({ busy, disabled, children, ...props }) {
  return (
    <button
      type="submit"
      className="button"
      disabled={busy || disabled}
      {...props}
    >
      {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
      {busy ? "Saving…" : children}
    </button>
  );
}
export function Field({ label, required, children, hint }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children(id)}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Options({ values }) {
  return values.map((v) => (
    <option value={v} key={v}>
      {labels[v]}
    </option>
  ));
}
export function StatCard({ title, value, icon: Icon, note }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <Icon size={20} aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef(null),
    titleId = useId(),
    timer = useRef(null),
    closeRef = useRef(onClose),
    busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  const [closing, setClosing] = useState(false);
  function close() {
    if (!busyRef.current && !timer.current) {
      setClosing(true);
      timer.current = setTimeout(() => closeRef.current(), 160);
    }
  }
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => {
      clearTimeout(timer.current);
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${closing ? "closing" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
