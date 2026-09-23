import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CirclePlus, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { requestService } from "../services/requestService";
import { buildingService } from "../services/buildingService";
import { PageHeader, ResourceState, Field } from "../components/UI";
import { priorities, requestStatuses } from "../utils/format";
import RequestList from "../components/RequestList";
export default function Requests() {
  const { t, language } = useLanguage();
  const { user } = useAuth(),
    admin = user.role === "ADMIN",
    [params, setParams] = useSearchParams(),
    [status, setStatus] = useState("");
  const resource = useResource(
    () =>
      admin
        ? requestService.list(Object.fromEntries(params))
        : requestService.mine(),
    params.toString(),
  );
  const buildings = useResource(() =>
    admin ? buildingService.list() : Promise.resolve([]),
  );
  useRefreshOnFocus(resource.refresh, t(admin ? "adminRequests.refreshError" : "myRequests.refreshError"));
  function filter(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setParams(
      Object.fromEntries(
        Object.entries(values)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v),
      ),
    );
  }
  const list = (resource.data || []).filter(
    (r) => admin || !status || r.status === status,
  );
  const staffCopy = admin ? undefined : {
    emptyTitle: t(status ? "myRequests.noMatches" : "myRequests.empty"),
    firstRequest: t("myRequests.firstRequest"),
    request: t("myRequests.request"),
    buildingLocation: t("myRequests.buildingLocation"),
    category: t("myRequests.category"),
    priority: t("myRequests.priority"),
    status: t("myRequests.status"),
    created: t("myRequests.created"),
    action: t("myRequests.action"),
    view: t("myRequests.view"),
    categoryLabel: t,
    formatDate: (value) => value
      ? new Intl.DateTimeFormat(language === "my" ? "my-MM" : undefined, {
          day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
        }).format(new Date(value))
      : t("myRequests.dateUnavailable"),
  };
  const adminCopy = !admin ? undefined : {
    emptyTitle: t(params.size ? "adminRequests.noMatches" : "adminRequests.empty"),
    request: t("adminRequests.request"),
    buildingLocation: t("adminRequests.buildingLocation"),
    category: t("adminRequests.category"),
    priority: t("adminRequests.priority"),
    status: t("adminRequests.status"),
    submittedBy: t("adminRequests.submittedBy"),
    assignedTo: t("adminRequests.assignedTo"),
    unassigned: t("adminRequests.unassigned"),
    created: t("adminRequests.created"),
    action: t("adminRequests.action"),
    manage: t("adminRequests.manage"),
    categoryLabel: t,
    formatDate: (value) => value
      ? new Intl.DateTimeFormat(language === "my" ? "my-MM" : undefined, {
          day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
        }).format(new Date(value))
      : t("adminRequests.dateUnavailable"),
  };
  return (
    <>
      <PageHeader
        title={admin ? t("adminRequests.title") : t("myRequests.title")}
        description={
          admin
            ? t("adminRequests.description")
            : t("myRequests.description")
        }
        eyebrow={t(admin ? "adminRequests.eyebrow" : "myRequests.eyebrow")}
      >
        {!admin && (
          <Link className="button" to="/staff/requests/new">
            <CirclePlus size={18} />
            {t("myRequests.newRequest")}
          </Link>
        )}
      </PageHeader>
      {admin ? (
        <section className="panel filter-panel">
          <form className="filters" onSubmit={filter} key={params.toString()}>
            <Field label={t("adminRequests.search")}>
              {(id) => (
                <input
                  id={id}
                  name="search"
                  defaultValue={params.get("search") || ""}
                  maxLength={100}
                  placeholder={t("adminRequests.searchPlaceholder")}
                />
              )}
            </Field>
            <Field label={t("adminRequests.building")}>
              {(id) => (
                <select
                  id={id}
                  name="building_id"
                  defaultValue={params.get("building_id") || ""}
                >
                  <option value="">{t("adminRequests.allBuildings")}</option>
                  {buildings.data?.map((b) => (
                    <option value={b.building_id} key={b.building_id}>
                      {b.building_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("adminRequests.status")}>
              {(id) => (
                <select
                  id={id}
                  name="status"
                  defaultValue={params.get("status") || ""}
                >
                  <option value="">{t("adminRequests.allStatuses")}</option>
                  {requestStatuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}
                </select>
              )}
            </Field>
            <Field label={t("adminRequests.priority")}>
              {(id) => (
                <select
                  id={id}
                  name="priority"
                  defaultValue={params.get("priority") || ""}
                >
                  <option value="">{t("adminRequests.allPriorities")}</option>
                  {priorities.map((value) => <option key={value} value={value}>{t(value)}</option>)}
                </select>
              )}
            </Field>
            <button className="button">
              <Search size={16} />
              {t("adminRequests.apply")}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setParams({})}
            >
              {t("adminRequests.clear")}
            </button>
          </form>
          {buildings.error && (
            <p role="alert" className="muted">
              {t(buildings.error)}
            </p>
          )}
        </section>
      ) : (
        <div className="filter-tabs" aria-label={t("myRequests.filterAria")}>
          {["", ...requestStatuses].map((v) => (
            <button
              className={status === v ? "selected" : ""}
              key={v}
              aria-pressed={status === v}
              onClick={() => setStatus(v)}
            >
              {v ? t(v) : t("myRequests.allRequests")}
            </button>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>{admin ? t("adminRequests.campusRequests") : t("myRequests.yourRequests")}</h2>
          {!resource.loading && (
            <span className="count-label">{list.length} {t(admin ? (list.length === 1 ? "adminRequests.oneRequest" : "adminRequests.requestCount") : (list.length === 1 ? "myRequests.oneRequest" : "myRequests.requestCount"))}</span>
          )}
        </div>
        <ResourceState resource={resource} copy={{
          loading: t(admin ? "adminRequests.loading" : "myRequests.loading"),
          retry: t(admin ? "adminRequests.retry" : "myRequests.retry"),
          error: t,
        }}>
          <RequestList
            requests={list}
            admin={admin}
            copy={admin ? adminCopy : staffCopy}
            emptyTitle={
              admin
                ? t(params.size ? "adminRequests.noMatches" : "adminRequests.empty")
                : t(status ? "myRequests.noMatches" : "myRequests.empty")
            }
          />
        </ResourceState>
      </section>
    </>
  );
}
