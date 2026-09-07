import { useRef, useState } from "react";
import { CirclePlus, Users } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
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
  const resource = useResource(userService.staff),
    [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Manage Office Staff access to the Smart Building Monitoring System."
      >
        <button className="button" onClick={() => setOpen(true)}>
          <CirclePlus size={18} />
          Create Staff Account
        </button>
      </PageHeader>
      <section className="panel">
        <div className="panel-heading">
          <h2>Office Staff</h2>
          <span className="count-label">
            {resource.data?.length || 0} accounts
          </span>
        </div>
        <ResourceState resource={resource}>
          {resource.data?.length ? (
            <div className="staff-list">
              {resource.data.map((u) => (
                <div key={u.user_id} className="staff-row">
                  <span className="avatar">{u.name.slice(0, 1)}</span>
                  <div>
                    <strong>{u.name}</strong>
                    <small>Campus facilities access</small>
                  </div>
                  <Badge value={u.role} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No Staff accounts yet." />
          )}
        </ResourceState>
      </section>
      <p className="access-note">
        <Users size={17} />
        New accounts receive Office Staff access.
      </p>
      {open && (
        <StaffForm
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            resource.refresh();
          }}
        />
      )}
    </>
  );
}
function StaffForm({ onClose, onSaved }) {
  const action = useAction(),
    toast = useToast(),
    password = useRef(null),
    confirm = useRef(null);
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!form.get("name").trim()) {
      action.setError("Please enter a name.");
      return;
    }
    if (password.current.value !== confirm.current.value) {
      action.setError("Passwords must match.");
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
      toast("Staff account created successfully.");
      onSaved();
    });
  }
  return (
    <Modal title="Create Staff account" onClose={onClose} busy={action.busy}>
      <p className="modal-intro">Create access for a member of Office Staff.</p>
      <ErrorAlert message={action.error} />
      <form onSubmit={submit}>
        <Field label="Name" required>
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
          label="Initial Password"
          required
          hint="Use at least 8 characters."
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
        <Field label="Confirm Password" required>
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
          <SubmitButton busy={action.busy}>Create Staff account</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
