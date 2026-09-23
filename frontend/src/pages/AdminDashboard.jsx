import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  TriangleAlert,
  MonitorCog,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { requestService } from "../services/requestService";
import { monitoringService } from "../services/monitoringService";
import { equipmentService } from "../services/equipmentService";
import { userService } from "../services/userService";
import { useLanguage } from "../context/LanguageContext";
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
  const { t } = useLanguage();
  const navigate = useNavigate(),
    resource = useResource(() =>
      Promise.all([
        requestService.list(),
        monitoringService.list(),
        equipmentService.list(),
        userService.staff(),
      ]),
    );
  useRefreshOnFocus(resource.refresh, t("adminDashboard.refreshError"));
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
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminDashboard.title")}
        description={t("adminDashboard.description")}
      >
        <Link className="button" to="/admin/requests">
          {t("adminDashboard.manageRequests")}
          <ArrowUpRight size={17} />
        </Link>
      </PageHeader>
      <ResourceState resource={resource} copy={{
        loading: t("adminDashboard.loading"),
        retry: t("adminDashboard.retry"),
        error: t,
      }}>
        <div className="stats-grid">
          {[
            [
              t("adminDashboard.openRequests"),
              open.length,
              ClipboardList,
              t("adminDashboard.openRequestsNote"),
            ],
            [
              t("adminDashboard.highPriority"),
              high.length,
              TriangleAlert,
              t("adminDashboard.highPriorityNote"),
            ],
            [
              t("adminDashboard.equipmentAttention"),
              equipment.filter((e) => e.status !== "OPERATIONAL").length,
              MonitorCog,
              t("adminDashboard.equipmentAttentionNote"),
            ],
            [t("adminDashboard.staffAccounts"), staff.length, Users, t("adminDashboard.staffAccountsNote")],
          ].map(([title, value, icon, note]) => (
            <StatCard key={title} {...{ title, value, icon, note }} />
          ))}
        </div>
        <RequestCharts requests={requests} copy={{
          byStatus: t("adminDashboard.byStatus"),
          byPriority: t("adminDashboard.byPriority"),
          allRequests: t("adminDashboard.allRequests"),
          requests: t("adminDashboard.requestsUpper"),
          requestSeries: t("adminDashboard.requests"),
          empty: t("adminDashboard.noChartData"),
          label: t,
        }} />
        <section className="panel section-space">
          <div className="panel-heading">
            <div>
              <h2>{t("adminDashboard.needsAttention")}</h2>
              <p className="muted small-text">
                {t("adminDashboard.needsAttentionDescription")}
              </p>
            </div>
            <Link to="/admin/requests?priority=HIGH">{t("adminDashboard.viewRequests")} →</Link>
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
                      {t(r.fault_category)}
                      <span> · #{r.request_id}</span>
                    </strong>
                    <p>
                      {r.building.building_name} · {r.room_location}
                    </p>
                  </div>
                  <div className="attention-assignee">
                    <small>{t("adminDashboard.assignedTo")}</small>
                    <span>{r.assigned_to?.name || t("adminDashboard.unassigned")}</span>
                  </div>
                  <Badge value={r.priority} />
                  <Badge value={r.status} />
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title={t("adminDashboard.noAttentionRequests")} />
          )}
        </section>
        <section className="section-space">
          <div className="panel-heading">
            <h2>{t("adminDashboard.buildingStatus")}</h2>
            <Link to="/admin/monitoring">{t("adminDashboard.viewMonitoring")} →</Link>
          </div>
          <BuildingCards
            buildings={buildings}
            compact
            copy={{
              noBuildings: t("adminDashboard.noBuildings"),
              equipment: t("adminDashboard.buildingEquipment"),
              openRequests: t("adminDashboard.buildingOpenRequests"),
            }}
            onSelect={() => navigate("/admin/monitoring")}
          />
        </section>
      </ResourceState>
    </>
  );
}
