import { useRef } from "react";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { authService } from "../services/authService";
import { ErrorAlert, Field, Modal, SubmitButton } from "./UI";

export function ChangePasswordDialog({ onClose }) {
  const { t } = useLanguage();
  const action = useAction();
  const toast = useToast();
  const current = useRef(null);
  const next = useRef(null);
  const confirm = useRef(null);

  function submit(event) {
    event.preventDefault();
    if (next.current.value !== confirm.current.value) {
      action.setError("account.passwordMismatch");
      confirm.current.focus();
      return;
    }
    action.run(async () => {
      await authService.changePassword({
        current_password: current.current.value,
        new_password: next.current.value,
        confirm_password: confirm.current.value,
      });
      current.current.value = "";
      next.current.value = "";
      confirm.current.value = "";
      toast(t("account.passwordChanged"));
      onClose();
    });
  }

  return (
    <Modal title={t("account.changePassword")} onClose={onClose} busy={action.busy} closeLabel={t("account.closePasswordDialog")}>
      <p className="modal-intro">{t("account.passwordIntro")}</p>
      <ErrorAlert message={t(action.error)} />
      <form
        onSubmit={submit}
        onInvalidCapture={(event) => event.target.setCustomValidity(t("account.requiredValidation"))}
        onInputCapture={(event) => event.target.setCustomValidity("")}
        onChangeCapture={(event) => event.target.setCustomValidity("")}
      >
        <Field label={t("account.currentPassword")} required>
          {(id) => <input id={id} ref={current} type="password" required minLength={8} maxLength={1024} autoComplete="current-password" />}
        </Field>
        <Field label={t("account.newPassword")} hint={t("account.passwordHint")} required>
          {(id) => <input id={id} ref={next} type="password" required minLength={8} maxLength={1024} autoComplete="new-password" />}
        </Field>
        <Field label={t("account.confirmNewPassword")} required>
          {(id) => <input id={id} ref={confirm} type="password" required minLength={8} maxLength={1024} autoComplete="new-password" />}
        </Field>
        <div className="form-actions">
          <SubmitButton busy={action.busy} busyLabel={t("account.changingPassword")}>{t("account.changePassword")}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
