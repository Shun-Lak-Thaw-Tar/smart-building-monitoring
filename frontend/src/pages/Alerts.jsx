import { useMemo, useState } from "react";
import { BellRing, CirclePlus, Eye, MapPin } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { alertService } from "../services/alertService";
import { buildingService } from "../services/buildingService";
import { equipmentService } from "../services/equipmentService";
import { dateTime } from "../utils/format";
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, ResourceState, SubmitButton } from "../components/UI";

const categories = ["EQUIPMENT", "ENERGY", "COMFORT"];
const severities = ["INFO", "WARNING", "CRITICAL"];
const statuses = ["ACTIVE", "RESOLVED"];

export default function Alerts() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState({ category: "", severity: "", status: "" });
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const resource = useResource(() => alertService.list(filters), filters.category, filters.severity, filters.status);
  useRefreshOnFocus(resource.refresh, t("alertsPage.refreshError"));
  const activeCount = (resource.data || []).filter((alert) => alert.status === "ACTIVE").length;
  const updateFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  return (
    <>
      <PageHeader eyebrow={t("alertsPage.eyebrow")} title={t("alertsPage.title")} description={t("alertsPage.description")}>
        <button className="button" onClick={() => setCreating(true)}>
          <CirclePlus size={18} />
          {t("alertsPage.create")}
        </button>
      </PageHeader>
      <section className="stat-grid alerts-stat-grid" aria-label={t("alertsPage.summary")}>
        <div className="stat-card">
          <div className="stat-top"><span>{t("alertsPage.activeCount")}</span><BellRing size={20} aria-hidden="true" /></div>
          <strong>{activeCount}</strong>
          <small>{t("alertsPage.activeCountNote")}</small>
        </div>
      </section>
      <section className="panel filter-panel">
        <div className="filters">
          <SelectFilter label={t("alertsPage.severity")} value={filters.severity} onChange={(value) => updateFilter("severity", value)} values={severities} allLabel={t("alertsPage.allSeverities")} t={t} />
          <SelectFilter label={t("alertsPage.category")} value={filters.category} onChange={(value) => updateFilter("category", value)} values={categories} allLabel={t("alertsPage.allCategories")} t={t} />
          <SelectFilter label={t("alertsPage.status")} value={filters.status} onChange={(value) => updateFilter("status", value)} values={statuses} allLabel={t("alertsPage.allStatuses")} t={t} />
          <button className="text-button" onClick={() => setFilters({ category: "", severity: "", status: "" })}>{t("alertsPage.clear")}</button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("alertsPage.alertList")}</h2>
          <span className="count-label">{resource.data?.length || 0} {t(resource.data?.length === 1 ? "alertsPage.oneAlert" : "alertsPage.alerts")}</span>
        </div>
        <ResourceState resource={resource} copy={{ loading: t("alertsPage.loading"), retry: t("alertsPage.retry"), error: t }}>
          {resource.data?.length ? <AlertRecords alerts={resource.data} onSelect={setSelected} t={t} /> : <EmptyState title={t("alertsPage.empty")} description={t("alertsPage.emptyDescription")} />}
        </ResourceState>
      </section>
      {creating && <AlertForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); resource.refresh({ background: true }); }} />}
      {selected && <AlertDetail alert={selected} onClose={() => setSelected(null)} onResolved={() => { setSelected(null); resource.refresh({ background: true }); }} />}
    </>
  );
}

function SelectFilter({ label, value, onChange, values, allLabel, t }) {
  return <Field label={label}>{(id) => <select id={id} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{allLabel}</option>{values.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select>}</Field>;
}

function AlertRecords({ alerts, onSelect, t }) {
  return <>
    <div className="table-scroll management-table"><table><thead><tr><th>{t("alertsPage.alert")}</th><th>{t("alertsPage.location")}</th><th>{t("alertsPage.category")}</th><th>{t("alertsPage.severity")}</th><th>{t("alertsPage.status")}</th><th>{t("alertsPage.created")}</th><th>{t("alertsPage.action")}</th></tr></thead><tbody>
      {alerts.map((alert) => <tr key={alert.alert_id}><td><strong>{alert.title}</strong><small className="table-subtitle">{alert.equipment?.equipment_name || t("alertsPage.generalBuilding")}</small></td><td>{alert.building.building_name}</td><td><Badge value={alert.category} /></td><td><Badge value={alert.severity} /></td><td><Badge value={alert.status} /></td><td>{dateTime(alert.created_at)}</td><td><button className="table-action text-button" aria-label={`${t("alertsPage.viewDetails")} ${alert.title}`} onClick={() => onSelect(alert)}><Eye size={14} />{t("alertsPage.view")}</button></td></tr>)}
    </tbody></table></div>
    <div className="mobile-records">{alerts.map((alert) => <div className="record-card" key={alert.alert_id}><div className="record-top"><Badge value={alert.severity} /><Badge value={alert.status} /></div><h3>{alert.title}</h3><p><MapPin size={15} aria-hidden="true" /> {alert.building.building_name}</p><small>{t(alert.category)} · {dateTime(alert.created_at)}</small><button className="text-button" aria-label={`${t("alertsPage.viewDetails")} ${alert.title}`} onClick={() => onSelect(alert)}>{t("alertsPage.viewDetails")} →</button></div>)}</div>
  </>;
}

function AlertForm({ onClose, onSaved }) {
  const { t } = useLanguage();
  const action = useAction();
  const toast = useToast();
  const [buildingId, setBuildingId] = useState("");
  const buildings = useResource(buildingService.list);
  const equipment = useResource(equipmentService.list);
  const availableEquipment = useMemo(() => (equipment.data || []).filter((item) => String(item.building.building_id) === buildingId), [equipment.data, buildingId]);
  function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (!body.building_id || !body.category || !body.severity || !body.title.trim() || !body.description.trim()) { action.setError("alertsPage.requiredFields"); return; }
    body.building_id = Number(body.building_id);
    body.equipment_id = body.equipment_id ? Number(body.equipment_id) : null;
    action.run(async () => { await alertService.create(body); toast(t("alertsPage.createSuccess")); onSaved(); });
  }
  return <Modal title={t("alertsPage.createDialog")} onClose={onClose} busy={action.busy} closeLabel={t("alertsPage.closeDialog")}><ErrorAlert message={t(action.error)} /><form onSubmit={submit} onInvalidCapture={(event) => event.target.setCustomValidity(t("alertsPage.requiredValidation"))} onInputCapture={(event) => event.target.setCustomValidity("")} onChangeCapture={(event) => event.target.setCustomValidity("")}>
    <Field label={t("alertsPage.building")} required>{(id) => <select id={id} name="building_id" required value={buildingId} onChange={(event) => setBuildingId(event.target.value)} disabled={buildings.loading}><option value="">{t("alertsPage.selectBuilding")}</option>{buildings.data?.map((building) => <option key={building.building_id} value={building.building_id}>{building.building_name}</option>)}</select>}</Field>
    <Field label={t("alertsPage.equipment")} hint={t("alertsPage.equipmentHint")}>{(id) => <select id={id} name="equipment_id" defaultValue="" disabled={!buildingId || equipment.loading}><option value="">{t("alertsPage.generalBuilding")}</option>{availableEquipment.map((item) => <option key={item.equipment_id} value={item.equipment_id}>{item.equipment_name} · {item.location}</option>)}</select>}</Field>
    <div className="form-grid"><SelectField label={t("alertsPage.category")} name="category" values={categories} t={t} /><SelectField label={t("alertsPage.severity")} name="severity" values={severities} t={t} /></div>
    <Field label={t("alertsPage.alertTitle")} required>{(id) => <input id={id} name="title" required maxLength={160} />}</Field>
    <Field label={t("alertsPage.descriptionLabel")} required>{(id) => <textarea id={id} name="description" required maxLength={2000} rows={4} />}</Field>
    <div className="form-actions"><SubmitButton busy={action.busy} busyLabel={t("alertsPage.saving")}>{t("alertsPage.createAlert")}</SubmitButton></div>
  </form></Modal>;
}

function SelectField({ label, name, values, t }) {
  return <Field label={label} required>{(id) => <select id={id} name={name} required defaultValue=""><option value="">{t("alertsPage.selectOption")}</option>{values.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>}</Field>;
}

function AlertDetail({ alert, onClose, onResolved }) {
  const { t } = useLanguage();
  const action = useAction();
  const toast = useToast();
  return <Modal title={t("alertsPage.alertDetails")} onClose={onClose} busy={action.busy} closeLabel={t("alertsPage.closeDialog")}><div className="alert-detail"><div className="record-top"><Badge value={alert.severity} /><Badge value={alert.status} /></div><h3>{alert.title}</h3><p>{alert.description}</p><dl><div><dt>{t("alertsPage.building")}</dt><dd>{alert.building.building_name}</dd></div><div><dt>{t("alertsPage.equipment")}</dt><dd>{alert.equipment ? `${alert.equipment.equipment_name} · ${alert.equipment.location}` : t("alertsPage.generalBuilding")}</dd></div><div><dt>{t("alertsPage.category")}</dt><dd>{t(alert.category)}</dd></div><div><dt>{t("alertsPage.created")}</dt><dd>{dateTime(alert.created_at)}</dd></div>{alert.resolved_at && <div><dt>{t("alertsPage.resolved")}</dt><dd>{dateTime(alert.resolved_at)}</dd></div>}</dl>{alert.status === "ACTIVE" && <div className="form-actions"><SubmitButton busy={action.busy} busyLabel={t("alertsPage.resolving")} onClick={() => action.run(async () => { await alertService.resolve(alert.alert_id); toast(t("alertsPage.resolveSuccess")); onResolved(); })}>{t("alertsPage.resolve")}</SubmitButton></div>}<ErrorAlert message={t(action.error)} /></div></Modal>;
}
