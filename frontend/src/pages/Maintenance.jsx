import { useState } from "react";
import { Link } from "react-router-dom";
import { CirclePlus } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { maintenanceService } from "../services/maintenanceService";
import { equipmentService } from "../services/equipmentService";
import { buildingService } from "../services/buildingService";
import { requestService } from "../services/requestService";
import {
  PageHeader,
  ResourceState,
  Field,
  EmptyState,
  Modal,
  SubmitButton,
  ErrorAlert,
} from "../components/UI";
import { dateTime } from "../utils/format";
export default function Maintenance() {
  const [building, setBuilding] = useState(""),
    [equipment, setEquipment] = useState(""),
    [open, setOpen] = useState(false);
  const options = useResource(() =>
    Promise.all([buildingService.list(), equipmentService.list()]),
  );
  const resource = useResource(
    () =>
      maintenanceService.list({
        ...(building ? { building_id: building } : {}),
        ...(equipment ? { equipment_id: equipment } : {}),
      }),
    building + ":" + equipment,
  );
  const [buildings, items] = options.data || [[], []],
    filteredEquipment = items.filter(
      (e) => !building || e.building.building_id === Number(building),
    );
  return (
    <>
      <PageHeader
        title="Maintenance history"
        description="A record of completed equipment work across campus."
      >
        <button
          className="button"
          onClick={() => setOpen(true)}
          disabled={options.loading || Boolean(options.error)}
        >
          <CirclePlus size={18} />
          Record Maintenance
        </button>
      </PageHeader>
      <section className="panel filter-panel">
        <div className="filters">
          <Field label="Building">
            {(id) => (
              <select
                id={id}
                value={building}
                onChange={(e) => {
                  setBuilding(e.target.value);
                  setEquipment("");
                }}
              >
                <option value="">All buildings</option>
                {buildings.map((b) => (
                  <option key={b.building_id} value={b.building_id}>
                    {b.building_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Equipment">
            {(id) => (
              <select
                id={id}
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              >
                <option value="">All equipment</option>
                {filteredEquipment.map((eq) => (
                  <option key={eq.equipment_id} value={eq.equipment_id}>
                    {eq.equipment_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <button
            className="text-button"
            onClick={() => {
              setBuilding("");
              setEquipment("");
            }}
          >
            Clear filters
          </button>
        </div>
        <ErrorAlert message={options.error} onRetry={options.refresh} />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Completed maintenance</h2>
          <span className="count-label">
            {resource.data?.length || 0} records
          </span>
        </div>
        <ResourceState resource={resource}>
          {resource.data?.length ? (
            <>
              <div className="table-scroll management-table">
                <table>
                  <thead>
                    <tr>
                      <th>Completed</th>
                      <th>Equipment / building</th>
                      <th>Linked request</th>
                      <th>Completed by</th>
                      <th>Action details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.map((r) => (
                      <tr key={r.history_id}>
                        <td className="date-cell">
                          {dateTime(r.completed_at)}
                        </td>
                        <td>
                          <strong>{r.equipment.equipment_name}</strong>
                          <small>{r.equipment.building.building_name}</small>
                        </td>
                        <td>
                          {r.request ? (
                            <Link
                              to={"/admin/requests/" + r.request.request_id}
                            >
                              Request #{r.request.request_id}
                            </Link>
                          ) : (
                            <span className="preventive-label">
                              Preventive maintenance
                            </span>
                          )}
                        </td>
                        <td>{r.completed_by.name}</td>
                        <td className="action-details">{r.action_details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-records">
                {resource.data.map((r) => (
                  <div className="record-card" key={r.history_id}>
                    <div className="record-top">
                      <strong>{r.equipment.building.building_name}</strong>
                      <small>{dateTime(r.completed_at)}</small>
                    </div>
                    <h3>{r.equipment.equipment_name}</h3>
                    <p className="action-details">{r.action_details}</p>
                    <div className="record-bottom">
                      {r.request ? (
                        <Link to={"/admin/requests/" + r.request.request_id}>
                          Request #{r.request.request_id}
                        </Link>
                      ) : (
                        <small>Preventive maintenance</small>
                      )}
                      <small>{r.completed_by.name}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No maintenance records found." />
          )}
        </ResourceState>
      </section>
      {open && (
        <MaintenanceForm
          equipment={items}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            resource.refresh();
          }}
        />
      )}
    </>
  );
}
function MaintenanceForm({ equipment, onClose, onSaved }) {
  const [selected, setSelected] = useState(""),
    [linked, setLinked] = useState(""),
    action = useAction(),
    toast = useToast(),
    requests = useResource(() => requestService.list({ status: "RESOLVED" }));
  const matching = (requests.data || []).filter(
    (r) => r.equipment?.equipment_id === Number(selected),
  );
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      details = form.get("action_details").trim();
    if (!details) {
      action.setError("Please describe the maintenance completed.");
      return;
    }
    action.run(async () => {
      await maintenanceService.create({
        equipment_id: Number(selected),
        request_id: linked ? Number(linked) : null,
        action_details: details,
      });
      toast("Maintenance record created.");
      onSaved();
    });
  }
  return (
    <Modal title="Record maintenance" onClose={onClose} busy={action.busy}>
      <p className="modal-intro">
        Record completed work. Linked requests must already be resolved.
      </p>
      <ErrorAlert message={action.error} />
      <form onSubmit={submit}>
        <Field label="Equipment" required>
          {(id) => (
            <select
              id={id}
              required
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setLinked("");
              }}
            >
              <option value="">Select equipment</option>
              {equipment.map((e) => (
                <option key={e.equipment_id} value={e.equipment_id}>
                  {e.equipment_name} · {e.building.building_name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Linked Resolved Request"
          hint={
            selected && !matching.length && !requests.loading
              ? "No resolved requests are available for this equipment."
              : null
          }
        >
          {(id) => (
            <select
              id={id}
              value={linked}
              onChange={(e) => setLinked(e.target.value)}
              disabled={
                !selected || requests.loading || Boolean(requests.error)
              }
            >
              <option value="">
                No linked request — Preventive maintenance
              </option>
              {matching.map((r) => (
                <option key={r.request_id} value={r.request_id}>
                  Request #{r.request_id} · {r.fault_category}
                </option>
              ))}
            </select>
          )}
        </Field>
        <ErrorAlert message={requests.error} onRetry={requests.refresh} />
        <Field label="Action Details" required>
          {(id) => (
            <textarea
              id={id}
              name="action_details"
              required
              maxLength={2000}
              rows={5}
              placeholder="Describe the work completed…"
            />
          )}
        </Field>
        <div className="form-actions">
          <SubmitButton busy={action.busy} disabled={!selected}>
            Record maintenance
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
