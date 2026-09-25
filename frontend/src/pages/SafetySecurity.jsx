import { useMemo, useState } from "react";
import { Flame, ShieldCheck, TriangleAlert, Radio, RefreshCw } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useResource } from "../hooks/useResource";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { buildingService } from "../services/buildingService";
import { safetyService } from "../services/safetyService";
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, ResourceState, SubmitButton } from "../components/UI";
import { dateTime } from "../utils/format";

const tabs = [
  ["FIRE_SAFETY", "safety.fire", Flame],
  ["SECURITY_ACCESS", "safety.security", ShieldCheck],
  ["HAZARD_ADVISORY", "safety.hazards", TriangleAlert],
];
const options = {
  FIRE_SAFETY: { types: ["SMOKE_DETECTOR", "HEAT_DETECTOR", "FIRE_PANEL"], statuses: ["NORMAL", "FAULT", "TESTING", "OFFLINE", "ALARM"] },
  SECURITY_ACCESS: { types: ["CARD_READER", "MAIN_ENTRANCE", "SERVER_ROOM_DOOR"], statuses: ["GRANTED", "DENIED", "DOOR_OPEN", "FORCED_ENTRY"] },
  HAZARD_ADVISORY: { types: ["FIRE", "FLOOD", "SEVERE_WEATHER", "EARTHQUAKE", "POWER_FAILURE"], statuses: ["ACTIVE", "RESOLVED"] },
};

export default function SafetySecurity() {
  const { t } = useLanguage();
  const [section, setSection] = useState("FIRE_SAFETY");
  const events = useResource(() => safetyService.list(section), section);
  const current = tabs.find(([value]) => value === section);
  return <>
    <PageHeader eyebrow={t("safety.eyebrow")} title={t("safety.title")} description={t("safety.description")}>
      <span className="simulation-label"><Radio size={16} />{t("safety.simulation")}</span>
    </PageHeader>
    <section className="simulation-notice" role="note"><TriangleAlert size={18} aria-hidden="true" /><span>{t("safety.simulationNotice")}</span></section>
    <div className="filter-tabs safety-tabs" role="tablist" aria-label={t("safety.sections")}>
      {tabs.map(([value, label, Icon]) => <button key={value} className={section === value ? "selected" : ""} role="tab" aria-selected={section === value} onClick={() => setSection(value)}><Icon size={17} />{t(label)}</button>)}
    </div>
    <section className="stat-grid safety-stat-grid" aria-label={t("safety.summary")}>
      <Summary events={events.data} title={t("safety.recentEvents")} countLabel={t("safety.events")} /><Summary events={(events.data || []).filter((event) => event.status === "ALARM" || event.status === "FORCED_ENTRY" || (event.status === "ACTIVE" && event.severity === "CRITICAL"))} title={t("safety.seriousEvents")} countLabel={t("safety.events")} />
    </section>
    <section className="safety-layout">
      <div className="panel"><div className="panel-heading"><h2>{t(current[1])}</h2><button className="icon-button" aria-label={t("safety.refresh")} onClick={() => events.refresh({ background: true })}><RefreshCw size={17} /></button></div>
        <ResourceState resource={events} copy={{ loading: t("safety.loading"), retry: t("safety.retry"), error: t }}>
          {events.data?.length ? <div className="safety-event-list">{events.data.map((event) => <article className="record-card safety-event" key={event.event_id}><div className="record-top"><Badge value={event.status} /><Badge value={event.severity} /></div><h3>{event.name}</h3><p>{event.building?.building_name || t("safety.campusWide")}</p><small>{t(event.event_type)} · {dateTime(event.occurred_at)}</small>{event.description && <p className="muted">{event.description}</p>}</article>)}</div> : <EmptyState title={t("safety.empty")} description={t("safety.emptyDescription")} />}
        </ResourceState>
      </div>
      <TriggerForm section={section} onSaved={() => events.refresh({ background: true })} />
    </section>
  </>;
}

function Summary({ events, title, countLabel }) { const count = events?.length || 0; return <div className="stat-card"><div className="stat-top"><span>{title}</span><ShieldCheck size={20} aria-hidden="true" /></div><strong>{count}</strong><small>{count} {countLabel}</small></div>; }

function TriggerForm({ section, onSaved }) {
  const { t } = useLanguage(); const action = useAction(); const toast = useToast(); const buildings = useResource(buildingService.list); const config = options[section];
  const requiresBuilding = section !== "HAZARD_ADVISORY";
  const examples = useMemo(() => ({ FIRE_SAFETY: "North stair detector", SECURITY_ACCESS: "Main entrance access point", HAZARD_ADVISORY: "Campus advisory" })[section], [section]);
  function submit(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); body.building_id = body.building_id ? Number(body.building_id) : null; if (!body.name.trim() || (requiresBuilding && !body.building_id)) { action.setError("safety.required"); return; } action.run(async () => { await safetyService.trigger(body); toast(t("safety.triggered")); event.currentTarget.reset(); onSaved(); }); }
  return <section className="panel safety-trigger"><div className="panel-heading"><h2>{t("safety.triggerTitle")}</h2><span className="simulation-label">{t("safety.simulation")}</span></div><p className="muted">{t("safety.triggerHelp")}</p><ErrorAlert message={t(action.error)} /><form onSubmit={submit} key={section}><input type="hidden" name="section" value={section} /><Field label={t("safety.building")} required={requiresBuilding} hint={!requiresBuilding ? t("safety.campusOptional") : undefined}>{(id) => <select id={id} name="building_id" required={requiresBuilding} defaultValue="" disabled={buildings.loading}><option value="">{t("safety.selectBuilding")}</option>{buildings.data?.map((building) => <option key={building.building_id} value={building.building_id}>{building.building_name}</option>)}</select>}</Field><Field label={t("safety.deviceName")} required>{(id) => <input id={id} name="name" required maxLength={160} placeholder={examples} />}</Field><Field label={t("safety.eventType")} required>{(id) => <select id={id} name="event_type" defaultValue={config.types[0]}>{config.types.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>}</Field><Field label={t("safety.status")} required>{(id) => <select id={id} name="status" defaultValue={config.statuses[0]}>{config.statuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>}</Field><Field label={t("safety.severity")} required>{(id) => <select id={id} name="severity" defaultValue="INFO">{["INFO", "WARNING", "CRITICAL"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>}</Field><Field label={t("safety.descriptionLabel")}>{(id) => <textarea id={id} name="description" rows={3} maxLength={2000} />}</Field><div className="form-actions"><SubmitButton busy={action.busy} busyLabel={t("safety.triggering")}>{t("safety.trigger")}</SubmitButton></div></form></section>;
}
