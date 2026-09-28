import { Activity, Cpu, Radio, Search, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { EmptyState, Field } from "../components/UI";

const demoSensors = [
  { id: "smoke-216-01", name: "smokeDetector216", type: "smokeDetector", category: "FIRE_SAFETY", building: "Building 216", area: "mainEntrance", reading: "clear", status: "NORMAL", updated: "10:42" },
  { id: "heat-216-201", name: "heatSensor216", type: "heatSensor", category: "FIRE_SAFETY", building: "Building 216", area: "room201", reading: "temperature241", status: "NORMAL", updated: "10:40" },
  { id: "motion-216-entry", name: "motionSensor216", type: "motionSensor", category: "OCCUPANCY_MOTION", building: "Building 216", area: "mainEntrance", reading: "motionDetected", status: "NORMAL", updated: "10:41" },
  { id: "temperature-216-201", name: "temperatureSensor216", type: "environmentalSensor", category: "ENVIRONMENTAL", building: "Building 216", area: "room201", reading: "temperature238", status: "NORMAL", updated: "10:42" },
  { id: "humidity-209-301", name: "humiditySensor209", type: "environmentalSensor", category: "ENVIRONMENTAL", building: "Building 209", area: "room301", reading: "humidity58", status: "NORMAL", updated: "10:39" },
  { id: "air-quality-js-202", name: "airQualitySensorJs", type: "environmentalSensor", category: "ENVIRONMENTAL", building: "JS Building", area: "room202", reading: "co2_780", status: "ATTENTION", updated: "10:36" },
  { id: "energy-216-main", name: "energyMeter216", type: "energyMeter", category: "ENERGY", building: "Building 216", area: "mainUtilityRoom", reading: "energy184", status: "ATTENTION", updated: "10:40" },
  { id: "door-js-main", name: "doorSensorJs", type: "accessSensor", category: "ACCESS_SECURITY", building: "JS Building", area: "mainEntrance", reading: "closed", status: "NORMAL", updated: "10:41" },
  { id: "leak-209-gf", name: "waterLeakSensor209", type: "waterLeakSensor", category: "WATER_LEAK", building: "Building 209", area: "groundFloor", reading: "dry", status: "NORMAL", updated: "10:38" },
  { id: "occupancy-209-202", name: "occupancySensor209", type: "occupancySensor", category: "OCCUPANCY_MOTION", building: "Building 209", area: "room202", reading: "noOccupancy", status: "OFFLINE", updated: "09:58" },
];

const statuses = ["NORMAL", "ATTENTION", "OFFLINE"];

export function EquipmentSensorsPanel() {
  const { t } = useLanguage();
  const [building, setBuilding] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const buildings = useMemo(() => [...new Set(demoSensors.map((item) => item.building))], []);
  const categories = useMemo(() => [...new Set(demoSensors.map((item) => item.category))], []);
  const items = demoSensors.filter((item) =>
    (!building || item.building === building) &&
    (!category || item.category === category) &&
    (!status || item.status === status) &&
    [t(`equipmentSensors.${item.name}`), t(`equipmentSensors.${item.type}`), item.building, t(`equipmentSensors.${item.area}`)]
      .join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  return <section className="sensor-demo" aria-labelledby="sensor-demo-title">
    <header className="sensor-demo-intro">
      <div className="sensor-demo-icon" aria-hidden="true"><Radio size={22} /></div>
      <div>
        <p className="eyebrow">{t("equipmentSensors.eyebrow")}</p>
        <h2 id="sensor-demo-title">{t("equipmentSensors.title")}</h2>
        <p>{t("equipmentSensors.description")}</p>
      </div>
    </header>
    <aside className="sensor-demo-notice" role="note"><Cpu size={18} aria-hidden="true" /><span>{t("equipmentSensors.notice")}</span></aside>

    <section className="panel filter-panel sensor-filter-panel" aria-label={t("equipmentSensors.filters")}>
      <div className="filters">
        <Field label={t("equipmentSensors.search")}>{(id) => <div className="search-field"><Search size={17} aria-hidden="true" /><input id={id} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("equipmentSensors.searchPlaceholder")} /></div>}</Field>
        <Field label={t("equipmentSensors.building")}>{(id) => <select id={id} value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">{t("equipmentSensors.allBuildings")}</option>{buildings.map((item) => <option key={item} value={item}>{item}</option>)}</select>}</Field>
        <Field label={t("equipmentSensors.category")}>{(id) => <select id={id} value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{t("equipmentSensors.allCategories")}</option>{categories.map((item) => <option key={item} value={item}>{t(`equipmentSensors.category${item}`)}</option>)}</select>}</Field>
        <Field label={t("equipmentSensors.status")}>{(id) => <select id={id} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t("equipmentSensors.allStatuses")}</option>{statuses.map((item) => <option key={item} value={item}>{t(`equipmentSensors.${item.toLowerCase()}`)}</option>)}</select>}</Field>
        <button type="button" className="text-button" onClick={() => { setBuilding(""); setCategory(""); setStatus(""); setSearch(""); }}>{t("equipmentSensors.clear")}</button>
      </div>
    </section>

    <div className="panel-heading sensor-results-heading"><div><h2>{t("equipmentSensors.readings")}</h2><p className="muted">{t("equipmentSensors.readingsHelp")}</p></div><span className="count-label">{items.length} {t(items.length === 1 ? "equipmentSensors.item" : "equipmentSensors.items")}</span></div>
    {items.length ? <div className="sensor-card-grid">{items.map((item) => <SensorCard item={item} key={item.id} t={t} />)}</div> : <EmptyState title={t("equipmentSensors.empty")} description={t("equipmentSensors.emptyDescription")} />}
  </section>;
}

function SensorCard({ item, t }) {
  const Icon = item.status === "OFFLINE" ? WifiOff : item.status === "ATTENTION" ? Activity : Radio;
  return <article className={`sensor-card sensor-status-${item.status.toLowerCase()}`}>
    <header className="sensor-card-header">
      <div className="sensor-equipment-icon"><Icon size={20} aria-hidden="true" /></div>
      <div><h3>{t(`equipmentSensors.${item.name}`)}</h3><p>{t(`equipmentSensors.${item.type}`)} - {t(`equipmentSensors.category${item.category}`)}</p></div>
      <Status status={item.status} t={t} />
    </header>
    <dl className="sensor-readings sensor-details">
      <div><dt>{t("equipmentSensors.location")}</dt><dd>{item.building} - {t(`equipmentSensors.${item.area}`)}</dd></div>
      <div><dt>{t("equipmentSensors.currentReading")}</dt><dd>{t(`equipmentSensors.${item.reading}`)}</dd></div>
    </dl>
    <footer><span>{t("equipmentSensors.lastUpdated")}</span><time>{item.updated}</time><span>{t("equipmentSensors.demoTimestamp")}</span></footer>
  </article>;
}

function Status({ status, t }) {
  return <span className={`sensor-status sensor-status-${status.toLowerCase()}`}>{t(`equipmentSensors.${status.toLowerCase()}`)}</span>;
}
