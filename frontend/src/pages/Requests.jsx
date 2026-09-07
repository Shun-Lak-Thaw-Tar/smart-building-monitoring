import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CirclePlus, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useResource } from "../hooks/useResource";
import { requestService } from "../services/requestService";
import { buildingService } from "../services/buildingService";
import { PageHeader, ResourceState, Field, Options } from "../components/UI";
import { labels, priorities, requestStatuses } from "../utils/format";
import RequestList from "../components/RequestList";
export default function Requests() {
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
  return (
    <>
      <PageHeader
        title={admin ? "Request management" : "My requests"}
        description={
          admin
            ? "Review campus issues, coordinate assignments and track progress."
            : "Follow every request, from submission to resolution."
        }
      >
        {!admin && (
          <Link className="button" to="/staff/requests/new">
            <CirclePlus size={18} />
            New Request
          </Link>
        )}
      </PageHeader>
      {admin ? (
        <section className="panel filter-panel">
          <form className="filters" onSubmit={filter} key={params.toString()}>
            <Field label="Search">
              {(id) => (
                <input
                  id={id}
                  name="search"
                  defaultValue={params.get("search") || ""}
                  maxLength={100}
                  placeholder="Search location, building, equipment or fault…"
                />
              )}
            </Field>
            <Field label="Building">
              {(id) => (
                <select
                  id={id}
                  name="building_id"
                  defaultValue={params.get("building_id") || ""}
                >
                  <option value="">All buildings</option>
                  {buildings.data?.map((b) => (
                    <option value={b.building_id} key={b.building_id}>
                      {b.building_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Status">
              {(id) => (
                <select
                  id={id}
                  name="status"
                  defaultValue={params.get("status") || ""}
                >
                  <option value="">All statuses</option>
                  <Options values={requestStatuses} />
                </select>
              )}
            </Field>
            <Field label="Priority">
              {(id) => (
                <select
                  id={id}
                  name="priority"
                  defaultValue={params.get("priority") || ""}
                >
                  <option value="">All priorities</option>
                  <Options values={priorities} />
                </select>
              )}
            </Field>
            <button className="button">
              <Search size={16} />
              Apply
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setParams({})}
            >
              Clear filters
            </button>
          </form>
          {buildings.error && (
            <p role="alert" className="muted">
              {buildings.error}
            </p>
          )}
        </section>
      ) : (
        <div className="filter-tabs" aria-label="Filter requests by status">
          {["", ...requestStatuses].map((v) => (
            <button
              className={status === v ? "selected" : ""}
              key={v}
              aria-pressed={status === v}
              onClick={() => setStatus(v)}
            >
              {labels[v] || "All requests"}
            </button>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>{admin ? "Campus requests" : "Your requests"}</h2>
          {!resource.loading && (
            <span className="count-label">{list.length} requests</span>
          )}
        </div>
        <ResourceState resource={resource}>
          <RequestList
            requests={list}
            admin={admin}
            emptyTitle={
              status || params.size
                ? "No requests match these filters."
                : "No maintenance requests yet."
            }
          />
        </ResourceState>
      </section>
    </>
  );
}
