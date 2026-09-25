import { Activity, BotMessageSquare, HeartPulse, Search, Wrench } from "lucide-react";
import { useState } from "react";

import { Badge, EmptyState, Field, PageHeader, ResourceState } from "../components/UI";
import { useLanguage } from "../context/LanguageContext";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useResource } from "../hooks/useResource";
import { buildingService } from "../services/buildingService";
import { equipmentIntelligenceService } from "../services/equipmentIntelligenceService";
import { roomService } from "../services/roomService";
import { dateTime } from "../utils/format";

const bands = ["HEALTHY", "ATTENTION", "HIGH_RISK"];

export default function EquipmentIntelligence() {
  const { t } = useLanguage();
  const [search, setSearch] = useState(""), [building, setBuilding] = useState(""), [room, setRoom] = useState(""), [band, setBand] = useState("");
  const intelligence = useResource(equipmentIntelligenceService.list);
  const buildings = useResource(buildingService.list);
  const rooms = useResource(() => roomService.list(building ? { building_id: building } : undefined), building);
  useRefreshOnFocus(intelligence.refresh, t("equipmentIntelligence.refreshError"));
  const items = (intelligence.data || []).filter((item) => (!building || String(item.equipment.building.building_id) === building) && (!room || String(item.equipment.room?.room_id) === room) && (!band || item.health_band === band) && [item.equipment.equipment_name, item.equipment.equipment_type, item.equipment.location, item.equipment.building.building_name, item.equipment.room?.room_name].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()));
  const clear = () => { setSearch(""); setBuilding(""); setRoom(""); setBand(""); };
  return <>
    <PageHeader eyebrow={t("equipmentIntelligence.eyebrow")} title={t("equipmentIntelligence.title")} description={t("equipmentIntelligence.description")} />
    <p className="intelligence-rule"><HeartPulse size={17} aria-hidden="true" />{t("equipmentIntelligence.rule")}</p>
    <section className="panel filter-panel" aria-label={t("equipmentIntelligence.filters")}><div className="filters intelligence-filters"><Field label={t("equipmentIntelligence.search")}>{(id) => <div className="search-field"><Search size={18} aria-hidden="true" /><input id={id} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("equipmentIntelligence.searchPlaceholder")} /></div>}</Field><Field label={t("equipmentIntelligence.building")}>{(id) => <select id={id} value={building} onChange={(event) => { setBuilding(event.target.value); setRoom(""); }}><option value="">{t("equipmentIntelligence.allBuildings")}</option>{buildings.data?.map((item) => <option key={item.building_id} value={item.building_id}>{item.building_name}</option>)}</select>}</Field><Field label={t("equipmentIntelligence.room")}>{(id) => <select id={id} value={room} onChange={(event) => setRoom(event.target.value)} disabled={!building}><option value="">{t("equipmentIntelligence.allRooms")}</option>{rooms.data?.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_number} · {item.room_name}</option>)}</select>}</Field><Field label={t("equipmentIntelligence.healthBand")}>{(id) => <select id={id} value={band} onChange={(event) => setBand(event.target.value)}><option value="">{t("equipmentIntelligence.allBands")}</option>{bands.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select>}</Field><button className="text-button" onClick={clear}>{t("equipmentIntelligence.clear")}</button></div></section>
    <div className="panel-heading intelligence-results"><h2>{t("equipmentIntelligence.equipmentOverview")}</h2><span className="count-label">{items.length} {t(items.length === 1 ? "equipmentIntelligence.item" : "equipmentIntelligence.items")}</span></div>
    <ResourceState resource={intelligence} copy={{ loading: t("equipmentIntelligence.loading"), retry: t("equipmentIntelligence.retry"), error: t }}>{items.length ? <section className="intelligence-grid">{items.map((item) => <IntelligenceCard key={item.equipment.equipment_id} item={item} t={t} />)}</section> : <EmptyState title={t("equipmentIntelligence.empty")} />}</ResourceState>
  </>;
}

function IntelligenceCard({ item, t }) {
  const { equipment } = item;
  return <article className="intelligence-card"><div className="record-top"><div><h3>{equipment.equipment_name}</h3><small>{equipment.building.building_name}{equipment.room ? ` · ${equipment.room.room_number}` : ` · ${t("equipmentIntelligence.buildingLevel")}`}</small></div><Badge value={item.health_band} /></div><div className="intelligence-score"><strong>{item.score}</strong><span>/ 100</span><small>{t("equipmentIntelligence.healthScore")}</small></div><div className="intelligence-status"><Badge value={equipment.status} /><span>{equipment.equipment_type} · {equipment.location}</span></div><section><h4><Activity size={16} aria-hidden="true" />{t("equipmentIntelligence.healthExplanation")}</h4><ul className="intelligence-list">{item.reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{t(reason.code)}{reason.count ? ` (${reason.count})` : ""}</li>)}</ul></section><div className="intelligence-metrics"><span>{t("equipmentIntelligence.openRequests")}<strong>{item.open_request_count}</strong></span><span>{t("equipmentIntelligence.highPriority")}<strong>{item.high_priority_open_request_count}</strong></span></div><section><h4><Wrench size={16} aria-hidden="true" />{t("equipmentIntelligence.recentMaintenance")}</h4>{item.recent_maintenance.length ? <ul className="intelligence-list">{item.recent_maintenance.map((record) => <li key={record.history_id}><strong>{dateTime(record.completed_at)}</strong><span>{record.action_details}</span></li>)}</ul> : <p className="muted">{t("equipmentIntelligence.noMaintenance")}</p>}</section><section><h4><BotMessageSquare size={16} aria-hidden="true" />{t("equipmentIntelligence.assistant")}</h4><p className="assistant-note">{t("equipmentIntelligence.guidance")}</p><ul className="intelligence-list suggestions">{item.suggestions.map((suggestion) => <li key={suggestion}>{t(suggestion)}</li>)}</ul></section></article>;
}
