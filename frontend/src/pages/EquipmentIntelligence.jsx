import { Activity, BotMessageSquare, HeartPulse, Search } from "lucide-react";
import { useState } from "react";

import { Badge, EmptyState, Field, Modal, PageHeader, ResourceState } from "../components/UI";
import { useLanguage } from "../context/LanguageContext";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useResource } from "../hooks/useResource";
import { buildingService } from "../services/buildingService";
import { equipmentIntelligenceService } from "../services/equipmentIntelligenceService";
import { roomService } from "../services/roomService";

const bands = ["HEALTHY", "ATTENTION", "HIGH_RISK"];

export function EquipmentIntelligencePanel() {
  const { t } = useLanguage();
  const [search, setSearch] = useState(""), [building, setBuilding] = useState(""), [room, setRoom] = useState(""), [band, setBand] = useState(""), [assistantItem, setAssistantItem] = useState(null);
  const intelligence = useResource(equipmentIntelligenceService.list);
  const buildings = useResource(buildingService.list);
  const rooms = useResource(() => roomService.list(building ? { building_id: building } : undefined), building);
  useRefreshOnFocus(intelligence.refresh, t("equipmentIntelligence.refreshError"));
  const items = (intelligence.data || []).filter((item) => (!building || String(item.equipment.building.building_id) === building) && (!room || String(item.equipment.room?.room_id) === room) && (!band || item.health_band === band) && [item.equipment.equipment_name, item.equipment.equipment_type, item.equipment.location, item.equipment.building.building_name, item.equipment.room?.room_name].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()));
  const clear = () => { setSearch(""); setBuilding(""); setRoom(""); setBand(""); };
  return <>
    <p className="intelligence-rule"><HeartPulse size={17} aria-hidden="true" />{t("equipmentIntelligence.rule")}</p>
    <section className="panel filter-panel" aria-label={t("equipmentIntelligence.filters")}><div className="filters intelligence-filters"><Field label={t("equipmentIntelligence.search")}>{(id) => <div className="search-field"><Search size={18} aria-hidden="true" /><input id={id} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("equipmentIntelligence.searchPlaceholder")} /></div>}</Field><Field label={t("equipmentIntelligence.building")}>{(id) => <select id={id} value={building} onChange={(event) => { setBuilding(event.target.value); setRoom(""); }}><option value="">{t("equipmentIntelligence.allBuildings")}</option>{buildings.data?.map((item) => <option key={item.building_id} value={item.building_id}>{item.building_name}</option>)}</select>}</Field><Field label={t("equipmentIntelligence.room")}>{(id) => <select id={id} value={room} onChange={(event) => setRoom(event.target.value)} disabled={!building}><option value="">{t("equipmentIntelligence.allRooms")}</option>{rooms.data?.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_number} · {item.room_name}</option>)}</select>}</Field><Field label={t("equipmentIntelligence.healthBand")}>{(id) => <select id={id} value={band} onChange={(event) => setBand(event.target.value)}><option value="">{t("equipmentIntelligence.allBands")}</option>{bands.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select>}</Field><button className="text-button" onClick={clear}>{t("equipmentIntelligence.clear")}</button></div></section>
    <div className="panel-heading intelligence-results"><h2>{t("equipmentIntelligence.equipmentOverview")}</h2><span className="count-label">{items.length} {t(items.length === 1 ? "equipmentIntelligence.item" : "equipmentIntelligence.items")}</span></div>
    <ResourceState resource={intelligence} copy={{ loading: t("equipmentIntelligence.loading"), retry: t("equipmentIntelligence.retry"), error: t }}>{items.length ? <section className="intelligence-grid">{items.map((item) => <IntelligenceCard key={item.equipment.equipment_id} item={item} t={t} onGuidance={() => setAssistantItem(item)} />)}</section> : <EmptyState title={t("equipmentIntelligence.empty")} />}</ResourceState>
    {assistantItem && <FaultAssistantDialog item={assistantItem} t={t} onClose={() => setAssistantItem(null)} />}
  </>;
}

export default function EquipmentIntelligence() { return <EquipmentIntelligencePanel />; }

function IntelligenceCard({ item, t, onGuidance }) {
  const { equipment } = item;
  const location = equipment.room ? `${equipment.building.building_name} · ${equipment.room.room_number}` : `${equipment.building.building_name} · ${t("equipmentIntelligence.buildingLevel")}`;
  const reasons = item.reasons || [];
  return <article className="intelligence-card"><div className="record-top"><div><h3>{equipment.equipment_name}</h3><small>{t(equipment.equipment_type)} · {location}</small></div><Badge value={item.health_band} /></div><div className="intelligence-score"><strong>{item.score}</strong><span>/ 100</span><small>{t("equipmentIntelligence.healthScore")}</small></div><div className="intelligence-status"><Badge value={equipment.status} /><span>{t("equipmentIntelligence.currentStatus")}</span></div><div className="intelligence-reason"><Activity size={16} aria-hidden="true" /><p>{reasons.length ? reasons.slice(0, 2).map((reason) => `${t(reason.code)}${reason.count ? ` (${reason.count})` : ""}`).join(" · ") : t("equipmentIntelligence.noIndicators")}</p></div><button type="button" className="button secondary intelligence-assistant-button" onClick={onGuidance}><BotMessageSquare size={16} aria-hidden="true" />{t("equipmentIntelligence.assistant")}</button></article>;
}

function FaultAssistantDialog({ item, t, onClose }) {
  const { equipment } = item;
  const reasons = item.reasons || [];
  const suggestions = item.suggestions || [];
  return <Modal title={t("equipmentIntelligence.assistant")} onClose={onClose} closeLabel={t("equipmentIntelligence.closeAssistant")}><div className="fault-assistant-dialog"><p className="assistant-rule-label">{t("equipmentIntelligence.ruleBased")}</p><section className="fault-assistant-summary"><div><span>{t("equipmentIntelligence.equipment")}</span><strong>{equipment.equipment_name}</strong><small>{t(equipment.equipment_type)} · {equipment.building.building_name}{equipment.room ? ` · ${equipment.room.room_number}` : ""}</small></div><div><span>{t("equipmentIntelligence.healthSummary")}</span><strong>{item.score} / 100</strong><Badge value={item.health_band} /></div></section><section className="fault-assistant-section"><h3><Activity size={17} aria-hidden="true" />{t("equipmentIntelligence.detectedIssues")}</h3>{reasons.length ? <ul className="intelligence-list">{reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{t(reason.code)}{reason.count ? ` (${reason.count})` : ""}</li>)}</ul> : <p className="muted">{t("equipmentIntelligence.noIndicators")}</p>}</section><section className="fault-assistant-section"><h3><BotMessageSquare size={17} aria-hidden="true" />{t("equipmentIntelligence.recommendedChecks")}</h3>{suggestions.length ? <ul className="intelligence-list suggestions">{suggestions.map((suggestion) => <li key={suggestion}>{t(suggestion)}</li>)}</ul> : <p className="muted">{t("equipmentIntelligence.noGuidance")}</p>}</section><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>{t("equipmentIntelligence.close")}</button></div></div></Modal>;
}
