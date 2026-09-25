import { useEffect, useState } from "react";
import { CirclePlus, Pencil, MonitorCog } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { equipmentService } from "../services/equipmentService";
import { buildingService } from "../services/buildingService";
import { roomService } from "../services/roomService";
import {
  PageHeader,
  ResourceState,
  Field,
  Badge,
  EmptyState,
  Modal,
  SubmitButton,
  ErrorAlert,
} from "../components/UI";
import { equipmentStatuses } from "../utils/format";
export default function Equipment() {
  const { t } = useLanguage();
  const [building, setBuilding] = useState(""),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null);
  const resource = useResource(
      () =>
        equipmentService.list(building ? { building_id: building } : undefined),
      building,
    ),
    buildings = useResource(buildingService.list);
  useRefreshOnFocus(resource.refresh, t("equipmentPage.refreshError"));
  const items = (resource.data || []).filter(
    (e) =>
      (!status || e.status === status) &&
      [e.equipment_name, e.equipment_type, e.location, e.building.building_name]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow={t("equipmentPage.eyebrow")}
        title={t("equipmentPage.title")}
        description={t("equipmentPage.description")}
      >
        <button
          className="button"
          onClick={() => setEditing({})}
          disabled={buildings.loading || Boolean(buildings.error)}
        >
          <CirclePlus size={18} />
          {t("equipmentPage.add")}
        </button>
      </PageHeader>
      <div className="panel filter-panel">
        <div className="filters">
          <Field label={t("equipmentPage.search")}>
            {(id) => (
              <input
                id={id}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("equipmentPage.searchPlaceholder")}
              />
            )}
          </Field>
          <Field label={t("equipmentPage.building")}>
            {(id) => (
              <select
                id={id}
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              >
                <option value="">{t("equipmentPage.allBuildings")}</option>
                {buildings.data?.map((b) => (
                  <option key={b.building_id} value={b.building_id}>
                    {b.building_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("equipmentPage.status")}>
            {(id) => (
              <select
                id={id}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{t("equipmentPage.allStatuses")}</option>
                {equipmentStatuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}
              </select>
            )}
          </Field>
          <button
            className="text-button"
            onClick={() => {
              setBuilding("");
              setStatus("");
              setSearch("");
            }}
          >
            {t("equipmentPage.clear")}
          </button>
        </div>
        <ErrorAlert message={t(buildings.error)} onRetry={buildings.refresh} retryLabel={t("equipmentPage.retry")} />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("equipmentPage.campusEquipment")}</h2>
          <span className="count-label">{items.length} {t(items.length === 1 ? "equipmentPage.oneRecord" : "equipmentPage.records")}</span>
        </div>
        <ResourceState resource={resource} copy={{ loading: t("equipmentPage.loading"), retry: t("equipmentPage.retry"), error: t }}>
          {items.length ? (
            <>
              <div className="table-scroll management-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("equipmentPage.equipment")}</th>
                      <th>{t("equipmentPage.building")}</th>
                      <th>{t("equipmentPage.type")}</th>
                      <th>{t("equipmentPage.location")}</th>
                      <th>{t("equipmentPage.room")}</th>
                      <th>{t("equipmentPage.status")}</th>
                      <th>{t("equipmentPage.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.equipment_id}>
                        <td>
                          <strong className="equipment-title">
                            <MonitorCog size={19} aria-hidden="true" />
                            {e.equipment_name}
                          </strong>
                        </td>
                        <td>{e.building.building_name}</td>
                        <td>{e.equipment_type}</td>
                        <td>{e.location}</td>
                        <td>{e.room ? `${e.room.room_number} · ${e.room.room_name}` : t("equipmentPage.buildingLevel")}</td>
                        <td>
                          <Badge value={e.status} />
                        </td>
                        <td>
                          <button
                            className="table-action text-button"
                            aria-label={`${t("equipmentPage.edit")} ${e.equipment_name}`}
                            onClick={() => setEditing(e)}
                          >
                            <Pencil size={14} />
                            {t("equipmentPage.edit")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-records">
                {items.map((e) => (
                  <div className="record-card" key={e.equipment_id}>
                    <div className="record-top">
                      <strong>{e.building.building_name}</strong>
                      <Badge value={e.status} />
                    </div>
                    <h3 className="equipment-title">
                      <MonitorCog size={19} aria-hidden="true" />
                      {e.equipment_name}
                    </h3>
                    <p>
                      {e.equipment_type} · {e.location}{e.room ? ` · ${e.room.room_number}` : ` · ${t("equipmentPage.buildingLevel")}`}
                    </p>
                    <button
                      className="text-button"
                      aria-label={`${t("equipmentPage.edit")} ${e.equipment_name}`}
                      onClick={() => setEditing(e)}
                    >
                      {t("equipmentPage.editEquipment")} →
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title={t("equipmentPage.empty")} />
          )}
        </ResourceState>
      </section>
      {editing && (
        <EquipmentForm
          equipment={editing}
          buildings={buildings.data || []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            resource.refresh({ background: true });
          }}
        />
      )}
    </>
  );
}
function EquipmentForm({ equipment, buildings, onClose, onSaved }) {
  const { t } = useLanguage();
  const action = useAction(),
    toast = useToast(),
    edit = Boolean(equipment.equipment_id);
  const [buildingId, setBuildingId] = useState(edit ? String(equipment.building.building_id) : "");
  const [roomId, setRoomId] = useState(equipment.room ? String(equipment.room.room_id) : "");
  const rooms = useResource(() => roomService.list(buildingId ? { building_id: buildingId } : undefined), buildingId);
  useEffect(() => {
    if (roomId && rooms.data && !rooms.data.some((room) => String(room.room_id) === roomId)) setRoomId("");
  }, [buildingId, rooms.data, roomId]);
  function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (Object.entries(body).filter(([field]) => field !== "room_id").some(([, value]) => !value.trim())) {
      action.setError("equipmentPage.requiredFields");
      return;
    }
    if (!edit) body.building_id = Number(body.building_id);
    body.room_id = body.room_id ? Number(body.room_id) : null;
    action.run(async () => {
      if (edit) await equipmentService.update(equipment.equipment_id, body);
      else await equipmentService.create(body);
      toast(
        edit
          ? t("equipmentPage.updateSuccess")
          : t("equipmentPage.addSuccess"),
      );
      onSaved();
    });
  }
  return (
    <Modal
      title={t(edit ? "equipmentPage.editDialog" : "equipmentPage.addDialog")}
      onClose={onClose}
      busy={action.busy}
      closeLabel={t("equipmentPage.closeDialog")}
    >
      <ErrorAlert message={t(action.error)} />
      <form
        onSubmit={submit}
        onInvalidCapture={(e) => e.target.setCustomValidity(t("equipmentPage.requiredValidation"))}
        onInputCapture={(e) => e.target.setCustomValidity("")}
        onChangeCapture={(e) => e.target.setCustomValidity("")}
      >
        {edit ? (
          <div className="readonly-field">
            <span>{t("equipmentPage.building")}</span>
            <strong>{equipment.building.building_name}</strong>
          </div>
        ) : (
          <Field label={t("equipmentPage.building")} required>
            {(id) => (
              <select id={id} name="building_id" required value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setRoomId(""); }}>
                <option value="">{t("equipmentPage.selectBuilding")}</option>
                {buildings.map((b) => (
                  <option key={b.building_id} value={b.building_id}>
                    {b.building_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label={t("equipmentPage.name")} required>
          {(id) => (
            <input
              id={id}
              name="equipment_name"
              required
              maxLength={150}
              defaultValue={equipment.equipment_name || ""}
            />
          )}
        </Field>
        <Field label={t("equipmentPage.room")} hint={t("equipmentPage.roomHint")}>
          {(id) => <select id={id} name="room_id" value={roomId} onChange={(event) => setRoomId(event.target.value)} disabled={!buildingId || rooms.loading}>
            <option value="">{t("equipmentPage.buildingLevel")}</option>
            {rooms.data?.map((room) => <option key={room.room_id} value={room.room_id}>{room.room_number} · {room.room_name}</option>)}
          </select>}
        </Field>
        <div className="form-grid">
          <Field label={t("equipmentPage.equipmentType")} required>
            {(id) => (
              <input
                id={id}
                name="equipment_type"
                required
                maxLength={100}
                defaultValue={equipment.equipment_type || ""}
              />
            )}
          </Field>
          <Field label={t("equipmentPage.location")} required>
            {(id) => (
              <input
                id={id}
                name="location"
                required
                maxLength={150}
                defaultValue={equipment.location || ""}
              />
            )}
          </Field>
        </div>
        <Field label={t("equipmentPage.status")}>
          {(id) => (
            <select
              id={id}
              name="status"
              defaultValue={equipment.status || "OPERATIONAL"}
            >
              {equipmentStatuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}
            </select>
          )}
        </Field>
        <div className="form-actions">
          <SubmitButton busy={action.busy} busyLabel={t("equipmentPage.saving")}>
            {t(edit ? "equipmentPage.save" : "equipmentPage.addButton")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
