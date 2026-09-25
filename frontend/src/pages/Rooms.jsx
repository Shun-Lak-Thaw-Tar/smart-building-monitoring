import { BellRing, Building2, ClipboardList, DoorOpen, Layers3, MonitorCog, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import { Badge, EmptyState, Field, Modal, PageHeader, ResourceState } from "../components/UI";
import { useLanguage } from "../context/LanguageContext";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useResource } from "../hooks/useResource";
import { buildingService } from "../services/buildingService";
import { roomService } from "../services/roomService";
import { dateTime } from "../utils/format";

const roomTypes = ["OFFICE", "MEETING_ROOM", "COMPUTER_LAB", "TECHNICAL_SERVER_ROOM"];

export default function Rooms() {
  const { t } = useLanguage();
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [roomType, setRoomType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const query = JSON.stringify({ building_id: building || undefined, floor: floor || undefined, room_type: roomType || undefined, search: search || undefined });
  const rooms = useResource(() => roomService.list(JSON.parse(query)), query);
  const buildings = useResource(buildingService.list);
  useRefreshOnFocus(rooms.refresh, t("roomsPage.refreshError"));
  const clearFilters = () => {
    setBuilding("");
    setFloor("");
    setRoomType("");
    setSearch("");
  };

  return <>
    <PageHeader eyebrow={t("roomsPage.eyebrow")} title={t("roomsPage.title")} description={t("roomsPage.description")} />
    <section className="panel filter-panel" aria-label={t("roomsPage.filterRooms")}>
      <div className="filters room-filters">
        <Field label={t("roomsPage.search")}>
          {(id) => <div className="search-field"><Search size={18} aria-hidden="true" /><input id={id} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("roomsPage.searchPlaceholder")} /></div>}
        </Field>
        <Field label={t("roomsPage.building")}>
          {(id) => <select id={id} value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">{t("roomsPage.allBuildings")}</option>{buildings.data?.map((item) => <option key={item.building_id} value={item.building_id}>{item.building_name}</option>)}</select>}
        </Field>
        <Field label={t("roomsPage.floor")}>
          {(id) => <select id={id} value={floor} onChange={(event) => setFloor(event.target.value)}><option value="">{t("roomsPage.allFloors")}</option><option value="2">2</option><option value="3">3</option></select>}
        </Field>
        <Field label={t("roomsPage.roomType")}>
          {(id) => <select id={id} value={roomType} onChange={(event) => setRoomType(event.target.value)}><option value="">{t("roomsPage.allTypes")}</option>{roomTypes.map((type) => <option key={type} value={type}>{t(type)}</option>)}</select>}
        </Field>
        <button className="text-button" onClick={clearFilters}>{t("roomsPage.clear")}</button>
      </div>
    </section>
    <section aria-labelledby="room-results-title">
      <div className="panel-heading room-results-heading"><div><h2 id="room-results-title">{t("roomsPage.campusRooms")}</h2><p className="muted">{t("roomsPage.resultsDescription")}</p></div><span className="count-label">{rooms.data?.length ?? 0} {t((rooms.data?.length ?? 0) === 1 ? "roomsPage.room" : "roomsPage.rooms")}</span></div>
      <ResourceState resource={rooms} copy={{ loading: t("roomsPage.loading"), retry: t("roomsPage.retry"), error: t }}>
        {rooms.data?.length ? <div className="room-card-grid">{rooms.data.map((room) => <article className="room-card" key={room.room_id}><div className="room-card-top"><span className="room-number">{room.room_number}</span><span className="room-type">{t(room.room_type)}</span></div><h3>{room.room_name}</h3><div className="room-metadata"><span><Building2 size={15} aria-hidden="true" />{room.building.building_name}</span><span><Layers3 size={15} aria-hidden="true" />{t("roomsPage.floor")} {room.floor}</span><span><DoorOpen size={15} aria-hidden="true" />{t(room.room_type)}</span></div>{room.description && <p>{room.description}</p>}<RoomEquipmentSummary room={room} t={t} /><button className="text-button room-detail-button" onClick={() => setSelectedRoom(room)}>{t("roomsPage.viewDetails")}</button></article>)}</div> : <EmptyState title={t("roomsPage.empty")} description={t("roomsPage.emptyDescription")} />}
      </ResourceState>
    </section>
    {selectedRoom && <RoomDetail room={selectedRoom} t={t} onClose={() => setSelectedRoom(null)} />}
  </>;
}

function RoomEquipmentSummary({ room, t }) {
  const equipment = room.equipment || [];
  return <section className="room-equipment-summary" aria-label={t("roomsPage.activitySummary")}><div className="room-activity-grid"><ActivityMetric icon={MonitorCog} label={t("roomsPage.equipmentPlural")} value={equipment.length} /><ActivityMetric icon={MonitorCog} label={t("roomsPage.equipmentAttention")} value={room.equipment_attention_count} /><ActivityMetric icon={ClipboardList} label={t("roomsPage.openRequests")} value={room.open_request_count} note={room.high_priority_open_request_count ? `${room.high_priority_open_request_count} ${t("roomsPage.highPriority")}` : undefined} /><ActivityMetric icon={BellRing} label={t("roomsPage.activeAlerts")} value={room.active_alert_count} note={room.critical_alert_count ? `${room.critical_alert_count} ${t("roomsPage.critical")}` : undefined} /></div>{equipment.length ? <ul>{equipment.slice(0, 2).map((item) => <li key={item.equipment_id}><span>{item.equipment_name}</span><Badge value={item.status} /></li>)}</ul> : <small>{t("roomsPage.noEquipment")}</small>}</section>;
}

function ActivityMetric({ icon: Icon, label, value, note }) {
  return <div><Icon size={14} aria-hidden="true" /><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function RoomDetail({ room, t, onClose }) {
  return <Modal title={`${room.room_number} · ${room.room_name}`} onClose={onClose} closeLabel={t("roomsPage.closeDetails")}><div className="room-detail"><p className="muted">{room.building.building_name} · {t("roomsPage.floor")} {room.floor} · {t(room.room_type)}</p>{room.description && <p>{room.description}</p>}<h3>{t("roomsPage.assignedEquipment")}</h3>{room.equipment?.length ? <ul className="room-detail-equipment">{room.equipment.map((item) => <li key={item.equipment_id}><div><strong>{item.equipment_name}</strong><span>{item.equipment_type} · {item.location}</span></div><Badge value={item.status} /></li>)}</ul> : <EmptyState title={t("roomsPage.noEquipment")} />}<h3>{t("roomsPage.openRequests")}</h3>{room.open_requests?.length ? <ul className="room-detail-activity">{room.open_requests.map((item) => <li key={item.request_id}><div><strong>#{item.request_id} · {item.fault_category}</strong><span>{item.room_location} · {dateTime(item.created_at)}</span></div><span className="activity-badges"><Badge value={item.priority} /><Badge value={item.status} /></span></li>)}</ul> : <p className="muted">{t("roomsPage.noOpenRequests")}</p>}<h3>{t("roomsPage.activeAlerts")}</h3>{room.active_alerts?.length ? <ul className="room-detail-activity">{room.active_alerts.map((item) => <li key={item.alert_id}><div><strong>{item.title}</strong><span>{item.equipment_name || t("roomsPage.buildingAlert")} · {dateTime(item.created_at)}</span></div><Badge value={item.severity} /></li>)}</ul> : <p className="muted">{t("roomsPage.noActiveAlerts")}</p>}<nav className="room-detail-links" aria-label={t("roomsPage.roomLinks")}><Link to="/admin/requests" onClick={onClose}><ClipboardList size={15} />{t("roomsPage.requests")}</Link><Link to="/admin/alerts" onClick={onClose}><BellRing size={15} />{t("roomsPage.alerts")}</Link><Link to="/admin/equipment" onClick={onClose}><MonitorCog size={15} />{t("roomsPage.equipmentLink")}</Link></nav></div></Modal>;
}
