import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { buildingService } from "../services/buildingService";
import { equipmentService } from "../services/equipmentService";
import { roomService } from "../services/roomService";
import { requestService } from "../services/requestService";
import { errorMessage } from "../services/apiClient";
import { PageHeader, ResourceState, Field, SubmitButton, ErrorAlert } from "../components/UI";
import { priorities } from "../utils/format";

const DRAFT_KEY = "smart-building.new-request-draft";
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; } };

export default function NewRequest() {
  const { language, t } = useLanguage();
  const draft = useRef(loadDraft()).current;
  const navigate = useNavigate(), toast = useToast();
  const [building, setBuilding] = useState(draft.building || "");
  const [room, setRoom] = useState(draft.room || "");
  const [equipment, setEquipment] = useState(draft.equipment || "");
  const [urgent, setUrgent] = useState(draft.urgent === "true");
  const [priority, setPriority] = useState(draft.priority || "MEDIUM");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), formRef = useRef(null);
  const buildings = useResource(buildingService.list);
  const rooms = useResource(() => building ? roomService.list({ building_id: building }) : Promise.resolve([]), building);
  const items = useResource(() => building && room && room !== "building" ? equipmentService.list({ building_id: building, room_id: room }) : Promise.resolve([]), `${building}:${room}`);

  useRefreshOnFocus(() => building ? Promise.all([rooms.refresh({ background: true }), room && room !== "building" ? items.refresh({ background: true }) : Promise.resolve(true)]) : Promise.resolve(true), t("newRequest.refreshError"));
  useEffect(() => { formRef.current?.querySelectorAll("input, select, textarea").forEach((field) => field.setCustomValidity("")); }, [language]);
  useEffect(() => { if (room && room !== "building" && !rooms.loading && !rooms.data?.some((item) => item.room_id === Number(room))) setRoom(""); }, [room, rooms.data, rooms.loading]);
  useEffect(() => { if (equipment && !items.loading && !items.data?.some((item) => item.equipment_id === Number(equipment))) setEquipment(""); }, [equipment, items.data, items.loading]);

  const selectedRoom = rooms.data?.find((item) => item.room_id === Number(room));
  const saveDraft = () => {
    if (formRef.current) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...Object.fromEntries(new FormData(formRef.current)), building, room, equipment, urgent: String(urgent), priority }));
  };
  const selectBuilding = (value) => { setBuilding(value); setRoom(""); setEquipment(""); };
  const selectRoom = (value) => { setRoom(value); setEquipment(""); };
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const roomLocation = selectedRoom ? `Room ${selectedRoom.room_number} · ${selectedRoom.room_name}` : data.room_location?.trim();
    if (!roomLocation || !data.description?.trim()) { setError("newRequest.blankFields"); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await requestService.create({ building_id: Number(building), room_id: room && room !== "building" ? Number(room) : null, equipment_id: equipment ? Number(equipment) : null, room_location: roomLocation, fault_category: data.fault_category, description: data.description, preferred_maintenance_date: data.preferred_maintenance_date || null, priority: urgent ? "HIGH" : priority });
      localStorage.removeItem(DRAFT_KEY); toast(t("newRequest.success")); navigate(`/staff/requests/${result.request_id}`);
    } catch (exception) { setError(errorMessage(exception)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><PageHeader eyebrow={t("newRequest.eyebrow")} title={t("newRequest.title")} description={t("newRequest.description")} />
    <ResourceState resource={buildings} copy={{ loading: t("newRequest.loading"), error: (message) => t(message), retry: t("newRequest.retry") }}><div className="form-layout"><section className="panel"><div className="panel-heading"><h2>{t("newRequest.details")}</h2><span className="muted small-text">{t("newRequest.requiredFields")}</span></div><ErrorAlert message={t(error)} />
      <form ref={formRef} onSubmit={submit} onChangeCapture={saveDraft} onInvalidCapture={(event) => event.target.setCustomValidity(t("newRequest.requiredValidation"))} onInputCapture={(event) => event.target.setCustomValidity("")}><div className="form-grid">
        <Field label={t("newRequest.building")} required>{(id) => <select id={id} required value={building} onChange={(event) => selectBuilding(event.target.value)}><option value="">{t("newRequest.selectBuilding")}</option>{buildings.data?.map((item) => <option key={item.building_id} value={item.building_id}>{item.building_name}</option>)}</select>}</Field>
        <Field label={t("newRequest.room")} hint={t("newRequest.roomHint")} required>{(id) => <select id={id} required value={room} disabled={!building || rooms.loading || Boolean(rooms.error)} onChange={(event) => selectRoom(event.target.value)}><option value="">{rooms.loading && building ? t("newRequest.loadingRooms") : t("newRequest.selectRoom")}</option><option value="building">{t("newRequest.generalBuildingIssue")}</option>{rooms.data?.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_number} · {item.room_name}</option>)}</select>}</Field>
        {room === "building" && <Field label={t("newRequest.roomLocation")} required>{(id) => <input id={id} name="room_location" required maxLength={150} defaultValue={draft.room_location || ""} placeholder={t("newRequest.roomPlaceholder")} />}</Field>}
        {selectedRoom && <input type="hidden" name="room_location" value={`Room ${selectedRoom.room_number} · ${selectedRoom.room_name}`} />}
        <Field label={t("newRequest.equipment")} hint={t("newRequest.equipmentHint")}>{(id) => <select id={id} value={equipment} disabled={!room || room === "building" || items.loading || Boolean(items.error)} onChange={(event) => setEquipment(event.target.value)}><option value="">{items.loading && room ? t("newRequest.loadingEquipment") : t("newRequest.generalRoomIssue")}</option>{items.data?.map((item) => <option key={item.equipment_id} value={item.equipment_id}>{item.equipment_name} · {item.location}</option>)}</select>}</Field>
        <Field label={t("newRequest.category")} required>{(id) => <select id={id} name="fault_category" required defaultValue={draft.fault_category || ""}><option value="">{t("newRequest.selectCategory")}</option>{["Electrical", "Air Conditioning", "Plumbing", "Lighting", "Equipment", "Other"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>}</Field>
        <div className="span-all"><Field label={t("newRequest.descriptionLabel")} required hint={t("newRequest.descriptionHint")}>{(id) => <textarea id={id} name="description" required maxLength={5000} rows={5} defaultValue={draft.description || ""} placeholder={t("newRequest.descriptionPlaceholder")} />}</Field></div>
        <Field label={t("newRequest.preferredDate")} hint={t("newRequest.preferredDateHint")}>{(id) => <input id={id} name="preferred_maintenance_date" type="date" defaultValue={draft.preferred_maintenance_date || ""} />}</Field>
        <Field label={t("newRequest.priority")}>{() => <div className="priority-controls"><label className="urgent-toggle"><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />{t("newRequest.urgent")}</label>{urgent ? <p className="muted small-text">{t("newRequest.urgentHelp")}</p> : <select value={priority} onChange={(event) => setPriority(event.target.value)}>{priorities.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>}</div>}</Field>
      </div><ErrorAlert message={t(rooms.error || items.error)} onRetry={() => { rooms.refresh(); items.refresh(); }} retryLabel={t("newRequest.retry")} /><div className="form-actions"><Link className="button secondary" to="/staff/requests">{t("newRequest.cancel")}</Link><SubmitButton busy={busy} busyLabel={t("newRequest.saving")} disabled={!building || !room || rooms.loading || Boolean(rooms.error) || (room !== "building" && (items.loading || Boolean(items.error)))}>{t("newRequest.submit")}</SubmitButton></div></form>
    </section><aside className="form-note"><Info size={22} /><h3>{t("newRequest.noteTitle")}</h3><p>{t("newRequest.noteBuilding")}</p><p>{t("newRequest.noteTrack")}</p></aside></div></ResourceState></>;
}
