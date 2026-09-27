import { useState } from "react";
import { Download } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useResource } from "../hooks/useResource";
import { buildingService } from "../services/buildingService";
import { reportService } from "../services/reportService";
import { EmptyState, Field, PageHeader, ResourceState } from "../components/UI";

const types = ["MAINTENANCE_REQUESTS", "EQUIPMENT_HEALTH", "ENERGY_SUSTAINABILITY", "COMFORT", "ALERTS_INCIDENTS", "SAFETY_SECURITY"];
const configurations = {
  MAINTENANCE_REQUESTS: { status: ["PENDING", "IN_PROGRESS", "RESOLVED"], category: ["Electrical", "Air Conditioning", "Plumbing", "Lighting", "Equipment", "Other"], dates: true },
  EQUIPMENT_HEALTH: { status: ["OPERATIONAL", "MAINTENANCE_REQUIRED", "OUT_OF_SERVICE"], health_band: ["HEALTHY", "ATTENTION", "HIGH_RISK"] },
  ENERGY_SUSTAINABILITY: { status: ["NORMAL", "HIGH_USAGE"] },
  COMFORT: { status: ["COMFORTABLE", "ATTENTION", "UNCOMFORTABLE"] },
  ALERTS_INCIDENTS: { status: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"], category: ["EQUIPMENT", "ENERGY", "COMFORT"], severity: ["INFO", "WARNING", "CRITICAL"], dates: true },
  SAFETY_SECURITY: { status: ["NORMAL", "FAULT", "TESTING", "OFFLINE", "ALARM", "GRANTED", "DENIED", "DOOR_OPEN", "FORCED_ENTRY", "ACTIVE", "RESOLVED"], category: ["FIRE_SAFETY", "HAZARD_ADVISORY", "SECURITY_ACCESS"], severity: ["INFO", "WARNING", "CRITICAL"], event_type: ["SMOKE_DETECTOR", "HEAT_DETECTOR", "FIRE_PANEL", "FIRE", "FLOOD", "SEVERE_WEATHER", "EARTHQUAKE", "POWER_FAILURE", "CARD_READER", "MAIN_ENTRANCE", "SERVER_ROOM_DOOR"], dates: true },
};
const emptyFilters = { building_id: "", status: "", category: "", severity: "", health_band: "", event_type: "", start_date: "", end_date: "" };

export default function Reports() {
  const { t } = useLanguage();
  const [type, setType] = useState(types[0]);
  const [filters, setFilters] = useState(emptyFilters);
  const report = useResource(() => reportService.get(type, filters), `${type}:${JSON.stringify(filters)}`);
  const buildings = useResource(buildingService.list);
  const config = configurations[type];
  const update = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const changeType = (value) => { setType(value); setFilters(emptyFilters); };
  const exportCsv = () => {
    const data = report.data;
    if (!data) return;
    const esc = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [data.columns.map(esc).join(","), ...data.rows.map((row) => data.columns.map((column) => esc(row[column])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${type.toLowerCase()}-report.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <>
    <PageHeader eyebrow={t("reports.title")} title={t("reports.title")} description={t("reports.results")}><button className="button" onClick={exportCsv} disabled={!report.data?.rows.length}><Download size={17}/>{t("reports.export")}</button></PageHeader>
    <section className="panel filter-panel"><div className="filters report-filters">
      <Field label={t("reports.type")}>{(id) => <select id={id} value={type} onChange={(event) => changeType(event.target.value)}>{types.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>}</Field>
      <SelectFilter label={t("reports.building")} name="building_id" value={filters.building_id} values={buildings.data?.map((building) => ({ value: building.building_id, label: building.building_name }))} allLabel={t("reports.allBuildings")} onChange={update} />
      {config.status && <SelectFilter label={t("reports.status")} name="status" value={filters.status} values={config.status} allLabel={t("reports.allStatuses")} onChange={update} t={t} />}
      {config.category && <SelectFilter label={type === "SAFETY_SECURITY" ? t("reports.section") : t("reports.category")} name="category" value={filters.category} values={config.category} allLabel={t("reports.allCategories")} onChange={update} t={t} />}
      {config.severity && <SelectFilter label={t("reports.severity")} name="severity" value={filters.severity} values={config.severity} allLabel={t("reports.allSeverities")} onChange={update} t={t} />}
      {config.health_band && <SelectFilter label={t("reports.healthBand")} name="health_band" value={filters.health_band} values={config.health_band} allLabel={t("reports.allHealthBands")} onChange={update} t={t} />}
      {config.event_type && <SelectFilter label={t("reports.eventType")} name="event_type" value={filters.event_type} values={config.event_type} allLabel={t("reports.allEventTypes")} onChange={update} t={t} />}
      {config.dates && <><Field label={t("reports.from")}>{(id) => <input id={id} type="date" value={filters.start_date} onChange={(event) => update("start_date", event.target.value)} />}</Field><Field label={t("reports.to")}>{(id) => <input id={id} type="date" value={filters.end_date} onChange={(event) => update("end_date", event.target.value)} />}</Field></>}
      <button className="text-button" type="button" onClick={() => setFilters(emptyFilters)}>{t("reports.clear")}</button>
    </div></section>
    <ResourceState resource={report} copy={{ loading: t("reports.loading"), retry: t("reports.retry"), error: t }}>{report.data?.rows.length ? <section className="panel"><div className="panel-heading"><h2>{t("reports.results")}</h2><span className="count-label">{report.data.rows.length} {t("reports.rows")}</span></div><div className="report-summary">{Object.entries(report.data.summary).map(([key, value]) => <span key={key}><strong>{value ?? "—"}</strong> {t(`reports.${key}`)}</span>)}</div><div className="table-scroll management-table"><table><thead><tr>{report.data.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{report.data.rows.map((row, index) => <tr key={index}>{report.data.columns.map((column) => <td key={column}>{row[column] ?? "—"}</td>)}</tr>)}</tbody></table></div></section> : <EmptyState title={t("reports.empty")} description={t("reports.emptyDescription")} />}</ResourceState>
  </>;
}

function SelectFilter({ label, name, value, values = [], allLabel, onChange, t = (item) => item }) {
  return <Field label={label}>{(id) => <select id={id} value={value} onChange={(event) => onChange(name, event.target.value)}><option value="">{allLabel}</option>{values.map((item) => { const option = typeof item === "object" ? item : { value: item, label: t(item) }; return <option key={option.value} value={option.value}>{option.label}</option>; })}</select>}</Field>;
}