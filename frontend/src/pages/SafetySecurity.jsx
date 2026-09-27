import { useMemo, useState } from "react";
import { Activity, BellRing, DoorOpen, Flame, Radio, RefreshCw, ShieldCheck, TriangleAlert, Waves } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useResource } from "../hooks/useResource";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { buildingService } from "../services/buildingService";
import { safetyService } from "../services/safetyService";
import { alertService } from "../services/alertService";
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, ResourceState, SubmitButton } from "../components/UI";
import { dateTime } from "../utils/format";

const tabs = [
  ["FIRE_SAFETY", "safety.fire", Flame],
  ["HAZARD_ADVISORY", "safety.hazards", TriangleAlert],
  ["SECURITY_ACCESS", "safety.security", ShieldCheck],
];

const monitoring = {
  FIRE_SAFETY: {
    sensors: [
      ["SMOKE_DETECTOR", "safety.sensorSmoke", "safety.sensorSmokeHelp", Activity],
      ["HEAT_DETECTOR", "safety.sensorHeat", "safety.sensorHeatHelp", Flame],
      ["FIRE_PANEL", "safety.sensorFirePanel", "safety.sensorFirePanelHelp", BellRing],
    ],
    simulation: { name: "Fire safety detection", eventType: "SMOKE_DETECTOR", status: "ALARM", severity: "CRITICAL", description: "[SIMULATION] Smoke detection triggered a fire safety alarm.", action: "safety.simulateFireDetection", requiresBuilding: true },
  },
  HAZARD_ADVISORY: {
    sensors: [
      ["FLOOD", "safety.sensorFlood", "safety.sensorFloodHelp", Waves],
      ["POWER_FAILURE", "safety.sensorPower", "safety.sensorPowerHelp", Activity],
      ["SEVERE_WEATHER", "safety.sensorAdvisory", "safety.sensorAdvisoryHelp", TriangleAlert],
    ],
    simulation: { name: "Hazard detection", eventType: "FLOOD", status: "ACTIVE", severity: "CRITICAL", description: "[SIMULATION] Water detection triggered a hazard alert.", action: "safety.simulateHazardDetection", requiresBuilding: false },
  },
  SECURITY_ACCESS: {
    sensors: [
      ["MAIN_ENTRANCE", "safety.sensorEntrance", "safety.sensorEntranceHelp", DoorOpen],
      ["CARD_READER", "safety.sensorAccess", "safety.sensorAccessHelp", ShieldCheck],
      ["SERVER_ROOM_DOOR", "safety.sensorForcedEntry", "safety.sensorForcedEntryHelp", TriangleAlert],
    ],
    simulation: { name: "Forced entry detection", eventType: "MAIN_ENTRANCE", status: "FORCED_ENTRY", severity: "CRITICAL", description: "[SIMULATION] Forced-entry detection triggered a security alert.", action: "safety.simulateForcedEntryDetection", requiresBuilding: true },
  },
};

function isCritical(event) {
  return event.status === "ALARM" || event.status === "FORCED_ENTRY" || (event.section === "HAZARD_ADVISORY" && event.status === "ACTIVE" && event.severity === "CRITICAL");
}
function isAttention(event) {
  return isCritical(event) || event.severity === "WARNING" || ["FAULT", "OFFLINE", "DENIED", "DOOR_OPEN"].includes(event.status);
}
function overallState(events) {
  if (events?.some(isCritical)) return "CRITICAL";
  if (events?.some(isAttention)) return "ATTENTION";
  return "NORMAL";
}

export default function SafetySecurity() {
  const { t } = useLanguage();
  const [section, setSection] = useState("FIRE_SAFETY");
  const [emergency, setEmergency] = useState(null);
  const events = useResource(() => safetyService.list(section), section);
  const allEvents = useResource(() => safetyService.list(), "safety-overall-events");
  const current = tabs.find(([value]) => value === section);
  const [,, SectionIcon] = current;
  const currentEvents = events.data || [];
  const state = overallState(allEvents.data);
  const activeIncidents = (allEvents.data || []).filter(isCritical).length;

  function refresh() {
    events.refresh({ background: true });
    allEvents.refresh({ background: true });
  }

  return <main className="safety-centre">
    <PageHeader eyebrow={t("safety.eyebrow")} title={t("safety.title")} description={t("safety.monitoringDescription")}>
      <span className="simulation-label"><Radio size={16} />{t("safety.simulation")}</span>
    </PageHeader>
    <section className="simulation-notice" role="note"><TriangleAlert size={18} aria-hidden="true" /><span>{t("safety.simulationNotice")}</span></section>

    <section className={`safety-overview safety-overview-${state.toLowerCase()}`} aria-label={t("safety.overallState")}>
      <div className="safety-overview-icon"><ShieldCheck size={25} aria-hidden="true" /></div>
      <div><p className="eyebrow">{t("safety.overallState")}</p><h2>{t(`safety.state${state[0]}${state.slice(1).toLowerCase()}`)}</h2><p className="muted">{t(`safety.state${state[0]}${state.slice(1).toLowerCase()}Description`)}</p></div>
      <div className="safety-overview-count"><strong>{activeIncidents}</strong><span>{t("safety.activeIncidents")}</span></div>
    </section>

    <div className="filter-tabs safety-tabs" role="tablist" aria-label={t("safety.sections")}>
      {tabs.map(([value, label, Icon]) => <button key={value} className={section === value ? "selected" : ""} role="tab" aria-selected={section === value} onClick={() => setSection(value)}><Icon size={17} />{t(label)}</button>)}
    </div>

    <section className="safety-monitoring-header"><div><p className="eyebrow">{t("safety.sectionMonitoring")}</p><h2><SectionIcon size={20} aria-hidden="true" />{t(current[1])}</h2></div><button className="button secondary" type="button" onClick={refresh}><RefreshCw size={17} />{t("safety.refresh")}</button></section>
    <SensorGrid section={section} events={currentEvents} t={t} />

    <section className="safety-layout">
      <RecentEvents resource={events} t={t} />
      <DetectionPanel section={section} onDetected={refresh} onEmergency={setEmergency} />
    </section>
    {emergency && <EmergencyPopup emergency={emergency} onClose={() => setEmergency(null)} />}
  </main>;
}

function SensorGrid({ section, events, t }) {
  const sensors = monitoring[section].sensors;
  return <section className="safety-sensor-grid" aria-label={t("safety.sensorStatus")}>{sensors.map(([type, title, help, Icon]) => {
    const latest = events.find((event) => event.event_type === type);
    const status = latest?.status || "NORMAL";
    return <article className="safety-sensor-card" key={type}><div className="safety-sensor-icon"><Icon size={20} aria-hidden="true" /></div><div className="safety-sensor-copy"><div className="record-top"><h3>{t(title)}</h3><Badge value={status} /></div><p>{t(help)}</p><small>{latest ? `${t("safety.lastDetected")} ${dateTime(latest.occurred_at)}` : t("safety.noDetection")}</small></div></article>;
  })}</section>;
}

function RecentEvents({ resource, t }) {
  return <section className="panel safety-events-panel"><div className="panel-heading"><div><p className="eyebrow">{t("safety.detectedFromSimulation")}</p><h2>{t("safety.recentEvents")}</h2></div><span className="count-label">{resource.data?.length || 0} {t("safety.events")}</span></div>
    <ResourceState resource={resource} copy={{ loading: t("safety.loading"), retry: t("safety.retry"), error: t }}>
      {resource.data?.length ? <div className="safety-event-list">{resource.data.map((event) => <article className="record-card safety-event" key={event.event_id}><div className="record-top"><Badge value={event.status} /><Badge value={event.severity} /></div><h3>{event.name}</h3><p>{t(event.event_type)} · {event.building?.building_name || t("safety.campusWide")}</p><small>{t("safety.detectedAt")} {dateTime(event.occurred_at)}</small>{event.description && <p className="muted">{event.description}</p>}</article>)}</div> : <EmptyState title={t("safety.empty")} description={t("safety.emptyDescription")} />}
    </ResourceState>
  </section>;
}

function DetectionPanel({ section, onDetected, onEmergency }) {
  const { t } = useLanguage();
  const action = useAction();
  const toast = useToast();
  const buildings = useResource(buildingService.list);
  const [buildingId, setBuildingId] = useState("");
  const simulation = monitoring[section].simulation;

  function detect() {
    if (simulation.requiresBuilding && !buildingId) { action.setError("safety.required"); return; }
    action.run(async () => {
      const event = await safetyService.trigger({ section, building_id: buildingId ? Number(buildingId) : null, name: simulation.name, event_type: simulation.eventType, status: simulation.status, severity: simulation.severity, description: simulation.description });
      let alertId = null;
      try {
        const title = `[SIMULATION] ${event.name}: ${event.event_type}`;
        const alerts = await alertService.list();
        alertId = alerts.find((alert) => alert.title === title && ["ACTIVE", "ACKNOWLEDGED"].includes(alert.status))?.alert_id || null;
      } catch {
        // The event and automatic alert already completed; the Alerts page is still available.
      }
      onDetected();
      onEmergency({ event, alertId });
      toast(t("safety.detectionTriggered"));
    });
  }

  return <section className="panel safety-detection-panel"><div className="panel-heading"><div><p className="eyebrow">{t("safety.automaticDetection")}</p><h2>{t("safety.simulateDetection")}</h2></div><span className="simulation-label">{t("safety.simulation")}</span></div><p className="muted">{t("safety.detectionHelp")}</p><ErrorAlert message={t(action.error)} />
    <Field label={t("safety.building")} required={simulation.requiresBuilding} hint={simulation.requiresBuilding ? t("safety.detectionBuildingHelp") : t("safety.campusOptional")}>{(id) => <select id={id} value={buildingId} onChange={(event) => setBuildingId(event.target.value)} disabled={buildings.loading}><option value="">{simulation.requiresBuilding ? t("safety.selectBuilding") : t("safety.campusWide")}</option>{buildings.data?.map((building) => <option key={building.building_id} value={building.building_id}>{building.building_name}</option>)}</select>}</Field>
    <div className="safety-detection-flow" aria-label={t("safety.detectionFlow")}><span>{t("safety.detectionStep")}</span><span>→</span><span>{t("safety.eventStep")}</span><span>→</span><span>{t("safety.alertStep")}</span></div>
    <SubmitButton busy={action.busy} busyLabel={t("safety.detecting")} type="button" onClick={detect}>{t(simulation.action)}</SubmitButton>
  </section>;
}
function EmergencyPopup({ emergency, onClose }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { event, alertId } = emergency;
  const guidanceKey = event.section === "FIRE_SAFETY" ? "fire" : event.section === "HAZARD_ADVISORY" ? "hazard" : "forcedEntry";
  const actions = Array.from({ length: 5 }, (_, index) => t(`safety.${guidanceKey}Action${index + 1}`));
  const viewAlert = () => {
    onClose();
    navigate(alertId ? `/admin/alerts?alert=${alertId}` : "/admin/alerts");
  };
  return <Modal title={t("safety.emergencyTitle")} onClose={onClose} closeLabel={t("safety.closeEmergency")}>
    <section className={`safety-emergency-content safety-emergency-${event.severity.toLowerCase()}`} aria-label={t("safety.emergencyTitle")}>
      <div className="safety-emergency-header"><div className="safety-emergency-icon"><TriangleAlert size={26} aria-hidden="true" /></div><div><p className="eyebrow">{t("safety.simulatedEmergency")}</p><h3>{t(event.event_type)}</h3></div><Badge value={event.severity} /></div>
      <p className="safety-emergency-description">{event.description}</p>
      <dl className="safety-emergency-meta"><div><dt>{t("safety.building")}</dt><dd>{event.building?.building_name || t("safety.campusWide")}</dd></div><div><dt>{t("safety.detectedAt")}</dt><dd>{dateTime(event.occurred_at)}</dd></div></dl>
      <div className="safety-emergency-actions"><h3>{t("safety.recommendedActions")}</h3><ul>{actions.map((action) => <li key={action}>{action}</li>)}</ul></div>
      <p className="safety-emergency-note">{t("safety.emergencyNote")}</p>
      <div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>{t("safety.close")}</button><button className="button" type="button" onClick={viewAlert}>{t("safety.viewAlert")}</button></div>
    </section>
  </Modal>;
}
