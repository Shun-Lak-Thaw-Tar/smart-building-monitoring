import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useToast } from "../context/ToastContext";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { requestService } from "../services/requestService";
import { userService } from "../services/userService";
import { errorMessage } from "../services/apiClient";
import {
  Badge,
  PageHeader,
  ResourceState,
  Field,
  SubmitButton,
  ErrorAlert,
  EmptyState,
} from "../components/UI";
import { requestStatuses } from "../utils/format";
export default function RequestDetail() {
  const { t, language } = useLanguage();
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
  const namespace = admin ? "adminRequestDetail" : "requestDetail";
  useRefreshOnFocus(resource.refresh, t(`${namespace}.refreshError`));
  const [request, history, admins] = resource.data || [null, [], []];
  const copy = (key) => t(`${namespace}.${key}`);
  const displayDate = (value) => value
      ? new Intl.DateTimeFormat(language === "my" ? "my-MM" : undefined, {
          day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
        }).format(new Date(value))
      : copy("dateUnavailable");
  return (
    <>
      <Link
        className="back-link"
        to={admin ? "/admin/requests" : "/staff/requests"}
      >
        <ArrowLeft size={16} />
        {copy("back")}
      </Link>
      <PageHeader
        title={`${copy("request")} #${id}`}
        description={copy("description")}
        eyebrow={copy("eyebrow")}
      >
        {request && (
          <>
            <Badge value={request.priority} />
            <Badge value={request.status} />
          </>
        )}
      </PageHeader>
      <ResourceState resource={resource} copy={{
        loading: copy("loading"),
        retry: copy("retry"),
        error: t,
      }}>
        {request && (
          <div className="detail-layout">
            <div>
              <section className="panel">
                <h2>{copy("details")}</h2>
                <dl className="detail-grid">
                  {[
                    [copy("building"), request.building.building_name],
                    [copy("room"), request.room_location],
                    [
                      copy("equipment"),
                      request.equipment?.equipment_name ||
                        copy("generalIssue"),
                    ],
                    [copy("category"), t(request.fault_category)],
                    [copy("submittedBy"), request.submitted_by.name],
                    [
                      copy("assignedAdministrator"),
                      request.assigned_to?.name || copy("unassigned"),
                    ],
                    [copy("created"), displayDate(request.created_at)],
                    [copy("updated"), displayDate(request.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="description">
                  <h3>{copy("descriptionLabel")}</h3>
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
                <h2>{copy("timeline")}</h2>
                <span className="count-label">{history.length} {copy(history.length === 1 ? "oneEvent" : "events")}</span>
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
                        <p>{copy("submitted")}</p>
                      ) : null}
                      <strong>{h.changed_by.name}</strong>
                      <time dateTime={h.changed_at}>
                        {displayDate(h.changed_at)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title={copy("emptyTimeline")} />
              )}
            </section>
          </div>
        )}
      </ResourceState>
    </>
  );
}
function Management({ request, admins, refresh }) {
  const { t } = useLanguage();
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
          ? t("adminRequestDetail.assignmentSuccess")
          : t("adminRequestDetail.statusSuccess"),
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
        <h2>{t("adminRequestDetail.manage")}</h2>
        <span className="count-label">{t("adminRequestDetail.administrator")}</span>
      </div>
      <ErrorAlert message={t(error)} />
      <div className="management-grid">
        <form
          onSubmit={(e) => save(e, "assign")}
          onInvalidCapture={(e) => e.target.setCustomValidity(t("adminRequestDetail.requiredValidation"))}
          onChangeCapture={(e) => e.target.setCustomValidity("")}
        >
          <Field label={t("adminRequestDetail.assignAdministrator")}>
            {(id) => (
              <select
                id={id}
                required
                value={assigned}
                onChange={(e) => setAssigned(e.target.value)}
              >
                <option value="">{t("adminRequestDetail.selectAdministrator")}</option>
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
            busyLabel={t("adminRequestDetail.saving")}
            disabled={
              Boolean(busy) ||
              !assigned ||
              Number(assigned) === request.assigned_to?.user_id
            }
          >
            {t("adminRequestDetail.updateAssignment")}
          </SubmitButton>
        </form>
        <form onSubmit={(e) => save(e, "status")}>
          <Field label={t("adminRequestDetail.requestStatus")}>
            {(id) => (
              <select
                id={id}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {requestStatuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}
              </select>
            )}
          </Field>
          <Field label={t("adminRequestDetail.optionalNote")}>
            {(id) => (
              <textarea
                id={id}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t("adminRequestDetail.notePlaceholder")}
              />
            )}
          </Field>
          <SubmitButton
            busy={busy === "status"}
            busyLabel={t("adminRequestDetail.saving")}
            disabled={Boolean(busy) || status === request.status}
          >
            {t("adminRequestDetail.updateStatus")}
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
