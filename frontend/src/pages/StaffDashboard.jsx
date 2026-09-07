import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Clock3,
  CircleCheck,
  Timer,
  CirclePlus,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useResource } from "../hooks/useResource";
import { requestService } from "../services/requestService";
import { monitoringService } from "../services/monitoringService";
import { PageHeader, ResourceState, StatCard } from "../components/UI";
import RequestList from "../components/RequestList";
import BuildingCards from "../components/BuildingCards";
export default function StaffDashboard() {
  const { user } = useAuth(),
    navigate = useNavigate(),
    resource = useResource(() =>
      Promise.all([requestService.mine(), monitoringService.list()]),
    );
  const [requests, buildings] = resource.data || [[], []];
  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name}`}
        description="Here is an overview of your maintenance requests and campus buildings."
      />
      <ResourceState resource={resource}>
        <div className="stats-grid">
          {[
            [
              "TOTAL REQUESTS",
              requests.length,
              ClipboardList,
              "All your submissions",
            ],
            [
              "PENDING",
              requests.filter((r) => r.status === "PENDING").length,
              Clock3,
              "Awaiting attention",
            ],
            [
              "IN PROGRESS",
              requests.filter((r) => r.status === "IN_PROGRESS").length,
              Timer,
              "Being looked after",
            ],
            [
              "RESOLVED",
              requests.filter((r) => r.status === "RESOLVED").length,
              CircleCheck,
              "Requests completed",
            ],
          ].map(([title, value, icon, note]) => (
            <StatCard key={title} {...{ title, value, icon, note }} />
          ))}
        </div>
        <div className="quick-action">
          <div className="quick-icon">
            <CirclePlus size={25} />
          </div>
          <div>
            <h2>Something needs attention?</h2>
            <p>Report a facilities issue and follow its progress.</p>
          </div>
          <Link className="button" to="/staff/requests/new">
            New Maintenance Request
            <ArrowRight size={17} />
          </Link>
        </div>
        <section className="panel section-space">
          <div className="panel-heading">
            <h2>Recent requests</h2>
            <Link to="/staff/requests">View all requests →</Link>
          </div>
          <RequestList requests={requests.slice(0, 5)} compact />
        </section>
        <section className="section-space">
          <div className="panel-heading">
            <h2>Campus Building Status</h2>
            <Link to="/staff/monitoring">View monitoring →</Link>
          </div>
          <BuildingCards
            buildings={buildings}
            compact
            onSelect={() => navigate("/staff/monitoring")}
          />
        </section>
      </ResourceState>
    </>
  );
}
