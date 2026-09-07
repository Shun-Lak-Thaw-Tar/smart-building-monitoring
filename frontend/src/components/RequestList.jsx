import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Badge, EmptyState } from "./UI";
import { dateTime } from "../utils/format";
export default function RequestList({
  requests,
  admin = false,
  compact = false,
  emptyTitle = "No maintenance requests yet.",
}) {
  if (!requests.length)
    return (
      <EmptyState title={emptyTitle}>
        {!admin && (
          <Link className="button" to="/staff/requests/new">
            Submit your first request
          </Link>
        )}
      </EmptyState>
    );
  const path = admin ? "/admin/requests/" : "/staff/requests/";
  return (
    <>
      <div className="table-scroll request-table">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Building / location</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              {admin && !compact && (
                <>
                  <th>Submitted by</th>
                  <th>Assigned to</th>
                </>
              )}
              <th>Created</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.request_id}>
                <td>
                  <Link className="request-id" to={path + r.request_id}>
                    #{r.request_id}
                  </Link>
                </td>
                <td>
                  <strong>{r.building.building_name}</strong>
                  <small>{r.room_location}</small>
                </td>
                <td>{r.fault_category}</td>
                <td>
                  <Badge value={r.priority} />
                </td>
                <td>
                  <Badge value={r.status} />
                </td>
                {admin && !compact && (
                  <>
                    <td>{r.submitted_by.name}</td>
                    <td>{r.assigned_to?.name || "Not assigned yet"}</td>
                  </>
                )}
                <td className="date-cell">{dateTime(r.created_at)}</td>
                <td>
                  <Link
                    className="table-action"
                    to={path + r.request_id}
                    aria-label={`${admin ? "Manage" : "View"} request #${r.request_id}`}
                  >
                    {admin ? "Manage" : "View"}
                    <ArrowUpRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-records">
        {requests.map((r) => (
          <Link
            className="record-card"
            to={path + r.request_id}
            key={r.request_id}
          >
            <div className="record-top">
              <strong>Request #{r.request_id}</strong>
              <Badge value={r.status} />
            </div>
            <h3>{r.fault_category}</h3>
            <p>
              <MapPin size={14} />
              {r.building.building_name} · {r.room_location}
            </p>
            {admin && (
              <p>Assigned to: {r.assigned_to?.name || "Not assigned yet"}</p>
            )}
            <div className="record-bottom">
              <Badge value={r.priority} />
              <small>{dateTime(r.created_at)}</small>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
