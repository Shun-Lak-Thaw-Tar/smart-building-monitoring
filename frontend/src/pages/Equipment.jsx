import { useState } from "react";
import { CirclePlus, Pencil } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { equipmentService } from "../services/equipmentService";
import { buildingService } from "../services/buildingService";
import {
  PageHeader,
  ResourceState,
  Field,
  Options,
  Badge,
  EmptyState,
  Modal,
  SubmitButton,
  ErrorAlert,
} from "../components/UI";
import { equipmentStatuses } from "../utils/format";
export default function Equipment() {
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
        title="Equipment management"
        description="Keep campus equipment records accurate and up to date."
      >
        <button
          className="button"
          onClick={() => setEditing({})}
          disabled={buildings.loading || Boolean(buildings.error)}
        >
          <CirclePlus size={18} />
          Add Equipment
        </button>
      </PageHeader>
      <div className="panel filter-panel">
        <div className="filters">
          <Field label="Search equipment">
            {(id) => (
              <input
                id={id}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, type, location or building…"
              />
            )}
          </Field>
          <Field label="Building">
            {(id) => (
              <select
                id={id}
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              >
                <option value="">All buildings</option>
                {buildings.data?.map((b) => (
                  <option key={b.building_id} value={b.building_id}>
                    {b.building_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <select
                id={id}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <Options values={equipmentStatuses} />
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
            Clear filters
          </button>
        </div>
        <ErrorAlert message={buildings.error} onRetry={buildings.refresh} />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Campus equipment</h2>
          <span className="count-label">{items.length} records</span>
        </div>
        <ResourceState resource={resource}>
          {items.length ? (
            <>
              <div className="table-scroll management-table">
                <table>
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Building</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.equipment_id}>
                        <td>
                          <strong>{e.equipment_name}</strong>
                        </td>
                        <td>{e.building.building_name}</td>
                        <td>{e.equipment_type}</td>
                        <td>{e.location}</td>
                        <td>
                          <Badge value={e.status} />
                        </td>
                        <td>
                          <button
                            className="table-action text-button"
                            aria-label={"Edit " + e.equipment_name}
                            onClick={() => setEditing(e)}
                          >
                            <Pencil size={14} />
                            Edit
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
                    <h3>{e.equipment_name}</h3>
                    <p>
                      {e.equipment_type} · {e.location}
                    </p>
                    <button
                      className="text-button"
                      aria-label={"Edit " + e.equipment_name}
                      onClick={() => setEditing(e)}
                    >
                      Edit equipment →
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No equipment matches the selected filters." />
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
            resource.refresh();
          }}
        />
      )}
    </>
  );
}
function EquipmentForm({ equipment, buildings, onClose, onSaved }) {
  const action = useAction(),
    toast = useToast(),
    edit = Boolean(equipment.equipment_id);
  function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (Object.values(body).some((v) => !v.trim())) {
      action.setError("Please complete all required fields.");
      return;
    }
    if (!edit) body.building_id = Number(body.building_id);
    action.run(async () => {
      if (edit) await equipmentService.update(equipment.equipment_id, body);
      else await equipmentService.create(body);
      toast(
        edit
          ? "Equipment updated successfully."
          : "Equipment added successfully.",
      );
      onSaved();
    });
  }
  return (
    <Modal
      title={edit ? "Edit equipment" : "Add equipment"}
      onClose={onClose}
      busy={action.busy}
    >
      <ErrorAlert message={action.error} />
      <form onSubmit={submit}>
        {edit ? (
          <div className="readonly-field">
            <span>Building</span>
            <strong>{equipment.building.building_name}</strong>
          </div>
        ) : (
          <Field label="Building" required>
            {(id) => (
              <select id={id} name="building_id" required defaultValue="">
                <option value="">Select a building</option>
                {buildings.map((b) => (
                  <option key={b.building_id} value={b.building_id}>
                    {b.building_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Equipment Name" required>
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
        <div className="form-grid">
          <Field label="Equipment Type" required>
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
          <Field label="Location" required>
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
        <Field label="Status">
          {(id) => (
            <select
              id={id}
              name="status"
              defaultValue={equipment.status || "OPERATIONAL"}
            >
              <Options values={equipmentStatuses} />
            </select>
          )}
        </Field>
        <div className="form-actions">
          <SubmitButton busy={action.busy}>
            {edit ? "Save changes" : "Add equipment"}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
