import { useRef, useState } from "react";
import { CirclePlus, Users, ShieldCheck } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { userService } from "../services/userService";
import {
  PageHeader,
  ResourceState,
  Field,
  EmptyState,
  Modal,
  SubmitButton,
  ErrorAlert,
  Badge,
} from "../components/UI";
export default function StaffAccounts() {
  const { t } = useLanguage();
  const resource = useResource(userService.staff),
    [open, setOpen] = useState(false),
    action = useAction(),
    toast = useToast();
  useRefreshOnFocus(resource.refresh, t("staffAccountsPage.refreshError"));
  return (
    <>
      <PageHeader
        eyebrow={t("staffAccountsPage.eyebrow")}
        title={t("staffAccountsPage.title")}
        description={t("staffAccountsPage.description")}
      >
        <button className="button" onClick={() => setOpen(true)}>
          <CirclePlus size={18} />
          {t("staffAccountsPage.create")}
        </button>
      </PageHeader>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("staffAccountsPage.officeStaff")}</h2>
          <span className="count-label">
            {resource.data?.length || 0} {t(resource.data?.length === 1 ? "staffAccountsPage.oneAccount" : "staffAccountsPage.accounts")}
          </span>
        </div>
        <ResourceState resource={resource} copy={{ loading: t("staffAccountsPage.loading"), retry: t("staffAccountsPage.retry"), error: t }}>
          {resource.data?.length ? (
            <div className="staff-list">
              {resource.data.map((u) => (
                <div key={u.user_id} className="staff-row">
                  <span className="avatar">{u.name.slice(0, 1)}</span>
                  <div>
                    <strong>{u.name}</strong>
                    <small>{t("staffAccountsPage.facilitiesAccess")}</small>
                  </div>
                  <span className="staff-access">
                    <ShieldCheck size={18} aria-hidden="true" />
                    <Badge value={u.role} />
                    <Badge value={u.is_active ? "ACTIVE" : "DISABLED"} />
                  </span>
                  <button
                    className="button secondary staff-status-action"
                    disabled={action.busy}
                    onClick={() => action.run(async () => {
                      await userService.setStaffStatus(u.user_id, !u.is_active);
                      toast(t(u.is_active ? "staffAccountsPage.disabledSuccess" : "staffAccountsPage.enabledSuccess"));
                      resource.refresh({ background: true });
                    })}
                  >
                    {t(u.is_active ? "staffAccountsPage.disable" : "staffAccountsPage.enable")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t("staffAccountsPage.empty")} />
          )}
        </ResourceState>
      </section>
      <ErrorAlert message={t(action.error)} />
      <p className="access-note">
        <Users size={17} />
        {t("staffAccountsPage.accessNote")}
      </p>
      {open && (
        <StaffForm
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            resource.refresh({ background: true });
          }}
        />
      )}
    </>
  );
}
function StaffForm({ onClose, onSaved }) {
  const { t } = useLanguage();
  const action = useAction(),
    toast = useToast(),
    password = useRef(null),
    confirm = useRef(null);
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!form.get("name").trim()) {
      action.setError("staffAccountsPage.nameRequired");
      return;
    }
    if (password.current.value !== confirm.current.value) {
      action.setError("staffAccountsPage.passwordMismatch");
      confirm.current.focus();
      return;
    }
    action.run(async () => {
      await userService.createStaff({
        name: form.get("name").trim(),
        password: password.current.value,
      });
      password.current.value = "";
      confirm.current.value = "";
      toast(t("staffAccountsPage.createSuccess"));
      onSaved();
    });
  }
  return (
    <Modal title={t("staffAccountsPage.createDialog")} onClose={onClose} busy={action.busy} closeLabel={t("staffAccountsPage.closeDialog")}>
      <p className="modal-intro">{t("staffAccountsPage.dialogIntro")}</p>
      <ErrorAlert message={t(action.error)} />
      <form
        onSubmit={submit}
        onInvalidCapture={(e) => e.target.setCustomValidity(t("staffAccountsPage.requiredValidation"))}
        onInputCapture={(e) => e.target.setCustomValidity("")}
        onChangeCapture={(e) => e.target.setCustomValidity("")}
      >
        <Field label={t("staffAccountsPage.name")} required>
          {(id) => (
            <input
              id={id}
              name="name"
              required
              maxLength={100}
              autoComplete="off"
            />
          )}
        </Field>
        <Field
          label={t("staffAccountsPage.initialPassword")}
          required
          hint={t("staffAccountsPage.passwordHint")}
        >
          {(id) => (
            <input
              id={id}
              ref={password}
              type="password"
              required
              minLength={8}
              maxLength={1024}
              autoComplete="new-password"
            />
          )}
        </Field>
        <Field label={t("staffAccountsPage.confirmPassword")} required>
          {(id) => (
            <input
              id={id}
              ref={confirm}
              type="password"
              required
              minLength={8}
              maxLength={1024}
              autoComplete="new-password"
            />
          )}
        </Field>
        <div className="form-actions">
          <SubmitButton busy={action.busy} busyLabel={t("staffAccountsPage.saving")}>{t("staffAccountsPage.createDialog")}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
