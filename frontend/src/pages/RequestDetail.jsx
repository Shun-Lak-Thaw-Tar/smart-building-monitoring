import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useResource } from "../hooks/useResource";
import { requestService } from "../services/requestService";
import { userService } from "../services/userService";
import { errorMessage } from "../services/apiClient";
import {
  Badge,
  PageHeader,
  ResourceState,
  Field,
  Options,
  SubmitButton,
  ErrorAlert,
  EmptyState,
} from "../components/UI";
import { dateTime, requestStatuses } from "../utils/format";
export default function RequestDetail() {
  const { id } = useParams(),
    { user } = useAuth(),
    admin = user.role === "ADMIN";
  const resource = useResource(
    () =>
      Promise.all([
        requestService.get(id),
        requestService.history(id),
        admin ? userService.admins() : Promise.resolve([]),
      ]),
    id,
  );
  const [request, history, admins] = resource.data || [null, [], []];
  return (
    <>
      <Link
        className="back-link"
        to={admin ? "/admin/requests" : "/staff/requests"}
      >
        <ArrowLeft size={16} />
        Back to requests
      </Link>
      <PageHeader
        title={`Request #${id}`}
        description="Maintenance request details and progress."
      >
        {request && (
          <>
            <Badge value={request.priority} />
            <Badge value={request.status} />
          </>
        )}
      </PageHeader>
      <ResourceState resource={resource}>
        {request && (
          <div className="detail-layout">
            <div>
              <section className="panel">
                <h2>Request details</h2>
                <dl className="detail-grid">
                  {[
                    ["Building", request.building.building_name],
                    ["Room / Location", request.room_location],
                    [
                      "Equipment",
                      request.equipment?.equipment_name ||
                        "General building issue",
                    ],
                    ["Fault Category", request.fault_category],
                    ["Submitted By", request.submitted_by.name],
                    [
                      "Assigned Administrator",
                      request.assigned_to?.name || "Not assigned yet",
                    ],
                    ["Created", dateTime(request.created_at)],
                    ["Updated", dateTime(request.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="description">
                  <h3>Description</h3>
                  <p>{request.description}</p>
                </div>
              </section>
              {admin && (
                <Management
                  key={
                    request.updated_at + String(request.assigned_to?.user_id)
                  }
                  request={request}
                  admins={admins}
                  refresh={resource.refresh}
                />
              )}
            </div>
            <section className="panel timeline-panel">
              <div className="panel-heading">
                <h2>Status timeline</h2>
                <span className="count-label">{history.length} events</span>
              </div>
              {history.length ? (
                <ol className="timeline">
                  {history.map((h, index) => (
                    <li
                      key={h.status_history_id}
                      style={{ animationDelay: `${index * 35}ms` }}
                    >
                      <span className="timeline-dot" />
                      <Badge value={h.new_status} />
                      {h.note ? (
                        <p>{h.note}</p>
                      ) : h.previous_status === null ? (
                        <p>Request submitted</p>
                      ) : null}
                      <strong>{h.changed_by.name}</strong>
                      <time dateTime={h.changed_at}>
                        {dateTime(h.changed_at)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="No status events yet." />
              )}
            </section>
          </div>
        )}
      </ResourceState>
    </>
  );
}
function Management({ request, admins, refresh }) {
  const [assigned, setAssigned] = useState(request.assigned_to?.user_id || ""),
    [status, setStatus] = useState(request.status),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    lock = useRef(false),
    toast = useToast();
  async function save(e, kind) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    setError("");
    try {
      if (kind === "assign")
        await requestService.assign(request.request_id, Number(assigned));
      else
        await requestService.status(request.request_id, {
          status,
          note: note.trim() || null,
        });
      toast(
        kind === "assign"
          ? "Request assignment updated."
          : "Request status updated.",
      );
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  return (
    <section className="panel section-space">
      <div className="panel-heading">
        <h2>Manage request</h2>
        <span className="count-label">Administrator</span>
      </div>
      <ErrorAlert message={error} />
      <div className="management-grid">
        <form onSubmit={(e) => save(e, "assign")}>
          <Field label="Assign administrator">
            {(id) => (
              <select
                id={id}
                required
                value={assigned}
                onChange={(e) => setAssigned(e.target.value)}
              >
                <option value="">Select administrator</option>
                {admins.map((a) => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <SubmitButton
            busy={busy === "assign"}
            disabled={
              Boolean(busy) ||
              !assigned ||
              Number(assigned) === request.assigned_to?.user_id
            }
          >
            Update assignment
          </SubmitButton>
        </form>
        <form onSubmit={(e) => save(e, "status")}>
          <Field label="Request Status">
            {(id) => (
              <select
                id={id}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <Options values={requestStatuses} />
              </select>
            )}
          </Field>
          <Field label="Optional Note">
            {(id) => (
              <textarea
                id={id}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Add a progress update…"
              />
            )}
          </Field>
          <SubmitButton
            busy={busy === "status"}
            disabled={Boolean(busy) || status === request.status}
          >
            Update status
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
