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
import { useLanguage } from "../context/LanguageContext";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { requestService } from "../services/requestService";
import { monitoringService } from "../services/monitoringService";
import { PageHeader, ResourceState, StatCard } from "../components/UI";
import RequestList from "../components/RequestList";
import BuildingCards from "../components/BuildingCards";
export default function StaffDashboard() {
  const { user } = useAuth(),
    { t, language } = useLanguage(),
    navigate = useNavigate(),
    resource = useResource(() =>
      Promise.all([requestService.mine(), monitoringService.list()]),
    );
  useRefreshOnFocus(resource.refresh);
  const [requests, buildings] = resource.data || [[], []];
  return (
    <>
      <PageHeader
        title={`${t("staffDashboard.welcome")} ${user.name}`}
        description={t("staffDashboard.description")}
        eyebrow={t("staffDashboard.eyebrow")}
      />
      <ResourceState
        resource={resource}
        copy={{
          loading: t("staffDashboard.loading"),
          retry: t("staffDashboard.retry"),
          error: t,
        }}
      >
        <div className="stats-grid">
          {[
            [
              t("staffDashboard.total"),
              requests.length,
              ClipboardList,
              t("staffDashboard.allSubmissions"),
            ],
            [
              t("staffDashboard.pending"),
              requests.filter((r) => r.status === "PENDING").length,
              Clock3,
              t("staffDashboard.awaiting"),
            ],
            [
              t("staffDashboard.inProgress"),
              requests.filter((r) => r.status === "IN_PROGRESS").length,
              Timer,
              t("staffDashboard.inCare"),
            ],
            [
              t("staffDashboard.resolved"),
              requests.filter((r) => r.status === "RESOLVED").length,
              CircleCheck,
              t("staffDashboard.completed"),
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
            <h2>{t("staffDashboard.prompt")}</h2>
            <p>{t("staffDashboard.promptHelp")}</p>
          </div>
          <Link className="button" to="/staff/requests/new">
            {t("staffDashboard.newMaintenance")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <section className="panel section-space">
          <div className="panel-heading">
            <h2>{t("staffDashboard.recent")}</h2>
            <Link to="/staff/requests">{t("staffDashboard.viewAll")} →</Link>
          </div>
          <RequestList
            requests={requests.slice(0, 5)}
            compact
            copy={{
              emptyTitle: t("staffDashboard.noRequests"),
              firstRequest: t("staffDashboard.firstRequest"),
              request: t("staffDashboard.request"),
              buildingLocation: t("staffDashboard.buildingLocation"),
              category: t("staffDashboard.category"),
              priority: t("staffDashboard.priority"),
              status: t("staffDashboard.status"),
              created: t("staffDashboard.created"),
              action: t("staffDashboard.action"),
              view: t("staffDashboard.view"),
              categoryLabel: t,
              formatDate: (value) =>
                value
                  ? new Intl.DateTimeFormat(language === "my" ? "my-MM" : undefined, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(value))
                  : t("staffDashboard.dateUnavailable"),
            }}
          />
        </section>
        <section className="section-space">
          <div className="panel-heading">
            <h2>{t("staffDashboard.buildingStatus")}</h2>
            <Link to="/staff/monitoring">{t("staffDashboard.viewMonitoring")} →</Link>
          </div>
          <BuildingCards
            buildings={buildings}
            compact
            copy={{
              noBuildings: t("staffDashboard.noBuildings"),
              equipment: t("staffDashboard.equipment"),
              openRequests: t("staffDashboard.openRequests"),
            }}
            onSelect={() => navigate("/staff/monitoring")}
          />
        </section>
      </ResourceState>
    </>
  );
}
