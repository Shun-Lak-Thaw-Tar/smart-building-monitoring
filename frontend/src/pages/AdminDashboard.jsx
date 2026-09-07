import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  TriangleAlert,
  MonitorCog,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { useResource } from "../hooks/useResource";
import { requestService } from "../services/requestService";
import { monitoringService } from "../services/monitoringService";
import { equipmentService } from "../services/equipmentService";
import { userService } from "../services/userService";
import {
  PageHeader,
  ResourceState,
  StatCard,
  Badge,
  EmptyState,
} from "../components/UI";
import { RequestCharts } from "../components/Charts";
import BuildingCards from "../components/BuildingCards";
export default function AdminDashboard() {
  const navigate = useNavigate(),
    resource = useResource(() =>
      Promise.all([
        requestService.list(),
        monitoringService.list(),
        equipmentService.list(),
        userService.staff(),
      ]),
    );
  const [requests, buildings, equipment, staff] = resource.data || [
      [],
      [],
      [],
      [],
    ],
    open = requests.filter((r) => r.status !== "RESOLVED"),
    high = open.filter((r) => r.priority === "HIGH");
  return (
    <>
      <PageHeader
        title="Facilities overview"
        description="A clear view of campus operations and what needs your attention."
      >
        <Link className="button" to="/admin/requests">
          Manage requests
          <ArrowUpRight size={17} />
        </Link>
      </PageHeader>
      <ResourceState resource={resource}>
        <div className="stats-grid">
          {[
            [
              "OPEN REQUESTS",
              open.length,
              ClipboardList,
              "Pending or in progress",
            ],
            [
              "HIGH PRIORITY",
              high.length,
              TriangleAlert,
              "Unresolved high priority",
            ],
            [
              "EQUIPMENT ATTENTION",
              equipment.filter((e) => e.status !== "OPERATIONAL").length,
              MonitorCog,
              "Maintenance or out of service",
            ],
            ["STAFF ACCOUNTS", staff.length, Users, "Office Staff with access"],
          ].map(([title, value, icon, note]) => (
            <StatCard key={title} {...{ title, value, icon, note }} />
          ))}
        </div>
        <RequestCharts requests={requests} />
        <section className="panel section-space">
          <div className="panel-heading">
            <div>
              <h2>Needs attention</h2>
              <p className="muted small-text">
                Unresolved high-priority requests
              </p>
            </div>
            <Link to="/admin/requests?priority=HIGH">View requests →</Link>
          </div>
          {high.length ? (
            <div className="attention-list">
              {high.map((r) => (
                <Link
                  key={r.request_id}
                  to={"/admin/requests/" + r.request_id}
                  className="attention-row"
                >
                  <span className="attention-icon">
                    <TriangleAlert size={20} />
                  </span>
                  <div>
                    <strong>
                      {r.fault_category}
                      <span> · #{r.request_id}</span>
                    </strong>
                    <p>
                      {r.building.building_name} · {r.room_location}
                    </p>
                  </div>
                  <div className="attention-assignee">
                    <small>Assigned to</small>
                    <span>{r.assigned_to?.name || "Not assigned yet"}</span>
                  </div>
                  <Badge value={r.priority} />
                  <Badge value={r.status} />
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No high-priority requests currently require attention." />
          )}
        </section>
        <section className="section-space">
          <div className="panel-heading">
            <h2>Campus Building Status</h2>
            <Link to="/admin/monitoring">View monitoring →</Link>
          </div>
          <BuildingCards
            buildings={buildings}
            compact
            onSelect={() => navigate("/admin/monitoring")}
          />
        </section>
      </ResourceState>
    </>
  );
}
