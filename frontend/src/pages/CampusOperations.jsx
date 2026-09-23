import { Link } from "react-router-dom";
import { BellRing, ClipboardList, MonitorCog, RefreshCw, Thermometer, Zap } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useLanguage } from "../context/LanguageContext";
import { campusService } from "../services/campusService";
import { Badge, EmptyState, PageHeader, ResourceState, StatCard } from "../components/UI";

export default function CampusOperations() {
  const { t } = useLanguage();
  const resource = useResource(campusService.overview);
  useRefreshOnFocus(resource.refresh, t("campusPage.refreshError"));
  const totals = resource.data?.totals;
  return <>
    <PageHeader eyebrow={t("campusPage.eyebrow")} title={t("campusPage.title")} description={t("campusPage.description")}><button className="button secondary" disabled={resource.loading} onClick={() => resource.refresh({ background: true })}><RefreshCw size={16} />{t("campusPage.refresh")}</button></PageHeader>
    <ResourceState resource={resource} copy={{ loading: t("campusPage.loading"), retry: t("campusPage.retry"), error: t }}>
      {totals ? <><section className="stats-grid campus-stats" aria-label={t("campusPage.summary")}>
        <StatCard title={t("campusPage.openRequests")} value={totals.open_maintenance_requests} icon={ClipboardList} note={t("campusPage.openRequestsNote")} />
        <StatCard title={t("campusPage.equipmentAttention")} value={totals.equipment_attention_count} icon={MonitorCog} note={t("campusPage.equipmentAttentionNote")} />
        <StatCard title={t("campusPage.activeAlerts")} value={totals.active_alert_count} icon={BellRing} note={`${totals.critical_alert_count} ${t("campusPage.critical")}`} />
        <StatCard title={t("campusPage.highUsage")} value={totals.high_usage_buildings} icon={Zap} note={`${totals.uncomfortable_buildings} ${t("campusPage.uncomfortable")}`} />
      </section><section className="campus-building-grid">{resource.data.buildings.map((building) => <BuildingPanel key={building.building.building_id} building={building} t={t} />)}</section></> : <EmptyState title={t("campusPage.empty")} />}
    </ResourceState>
  </>;
}

function BuildingPanel({ building, t }) {
  return <article className="campus-building-card">
    <div className="record-top"><div><h2>{building.building.building_name}</h2><small>{t("campusPage.buildingOverview")}</small></div><Badge value={building.operational_status} /></div>
    <div className="campus-metrics">
      <Metric icon={ClipboardList} label={t("campusPage.openRequests")} value={building.open_maintenance_requests} detail={`${building.high_priority_open_requests} ${t("campusPage.highPriority")}`} />
      <Metric icon={MonitorCog} label={t("campusPage.equipmentAttention")} value={building.equipment_attention_count} />
      <Metric icon={BellRing} label={t("campusPage.activeAlerts")} value={building.active_alert_count} detail={`${building.critical_alert_count} ${t("campusPage.critical")}`} />
    </div>
    <div className="campus-conditions"><div><span>{t("campusPage.energy")}</span><Badge value={building.energy_condition || "NO_DATA"} /><strong>{building.latest_energy_value === null ? t("campusPage.noData") : `${building.latest_energy_value} kWh`}</strong></div><div><span>{t("campusPage.comfort")}</span><Badge value={building.comfort_condition || "NO_DATA"} /><strong>{building.latest_temperature === null ? t("campusPage.noData") : `${building.latest_temperature}°C · ${building.latest_humidity}%`}</strong></div></div>
    <nav className="campus-links" aria-label={`${building.building.building_name} ${t("campusPage.links")}`}><Link to="/admin/requests"><ClipboardList size={15} />{t("campusPage.requests")}</Link><Link to="/admin/alerts"><BellRing size={15} />{t("campusPage.alerts")}</Link><Link to="/admin/energy"><Zap size={15} />{t("campusPage.energy")}</Link><Link to="/admin/comfort"><Thermometer size={15} />{t("campusPage.comfort")}</Link><Link to="/admin/monitoring"><MonitorCog size={15} />{t("campusPage.monitoring")}</Link></nav>
  </article>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return <div><Icon size={17} aria-hidden="true" /><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
