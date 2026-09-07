import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useToast } from "../context/ToastContext";
import { buildingService } from "../services/buildingService";
import { equipmentService } from "../services/equipmentService";
import { requestService } from "../services/requestService";
import { errorMessage } from "../services/apiClient";
import {
  PageHeader,
  ResourceState,
  Field,
  Options,
  SubmitButton,
  ErrorAlert,
} from "../components/UI";
import { priorities } from "../utils/format";
export default function NewRequest() {
  const navigate = useNavigate(),
    toast = useToast(),
    [building, setBuilding] = useState(""),
    [equipment, setEquipment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  const buildings = useResource(buildingService.list),
    items = useResource(
      () =>
        building
          ? equipmentService.list({ building_id: building })
          : Promise.resolve([]),
      building,
    );
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const data = Object.fromEntries(new FormData(e.currentTarget));
    for (const key of ["room_location", "description"])
      if (!data[key].trim()) {
        setError("Location and description must not be blank.");
        return;
      }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await requestService.create({
        ...data,
        building_id: Number(building),
        equipment_id: equipment ? Number(equipment) : null,
      });
      toast("Maintenance request submitted successfully.");
      navigate("/staff/requests/" + result.request_id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="New maintenance request"
        description="Tell us what needs attention. Your campus team will take it from here."
      />
      <ResourceState resource={buildings}>
        <div className="form-layout">
          <section className="panel">
            <div className="panel-heading">
              <h2>Request details</h2>
              <span className="muted small-text">* Required fields</span>
            </div>
            <ErrorAlert message={error} />
            <form onSubmit={submit}>
              <div className="form-grid">
                <Field label="Building" required>
                  {(id) => (
                    <select
                      id={id}
                      required
                      value={building}
                      onChange={(e) => {
                        setBuilding(e.target.value);
                        setEquipment("");
                      }}
                    >
                      <option value="">Select a building</option>
                      {buildings.data?.map((b) => (
                        <option key={b.building_id} value={b.building_id}>
                          {b.building_name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  label="Equipment"
                  hint="Leave unselected for a general building issue."
                >
                  {(id) => (
                    <select
                      id={id}
                      value={equipment}
                      disabled={
                        !building || items.loading || Boolean(items.error)
                      }
                      onChange={(e) => setEquipment(e.target.value)}
                    >
                      <option value="">
                        {items.loading && building
                          ? "Loading equipment…"
                          : "No specific equipment / General building issue"}
                      </option>
                      {!items.loading &&
                        !items.error &&
                        items.data?.map((eq) => (
                          <option key={eq.equipment_id} value={eq.equipment_id}>
                            {eq.equipment_name} · {eq.location}
                          </option>
                        ))}
                    </select>
                  )}
                </Field>
                <Field label="Room / Location" required>
                  {(id) => (
                    <input
                      id={id}
                      name="room_location"
                      required
                      maxLength={150}
                      placeholder="e.g. Room 205, second floor"
                    />
                  )}
                </Field>
                <Field label="Fault Category" required>
                  {(id) => (
                    <select
                      id={id}
                      name="fault_category"
                      required
                      defaultValue=""
                    >
                      <option value="">Select a category</option>
                      {[
                        "Electrical",
                        "Air Conditioning",
                        "Plumbing",
                        "Lighting",
                        "Equipment",
                        "Other",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <div className="span-all">
                  <Field
                    label="Description"
                    required
                    hint="Include what happened and any details that help the facilities team."
                  >
                    {(id) => (
                      <textarea
                        id={id}
                        name="description"
                        required
                        maxLength={5000}
                        rows={5}
                        placeholder="Describe the issue…"
                      />
                    )}
                  </Field>
                </div>
                <Field label="Priority" required>
                  {(id) => (
                    <select id={id} name="priority" defaultValue="MEDIUM">
                      <Options values={priorities} />
                    </select>
                  )}
                </Field>
              </div>
              <ErrorAlert message={items.error} onRetry={items.refresh} />
              <div className="form-actions">
                <Link className="button secondary" to="/staff/requests">
                  Cancel
                </Link>
                <SubmitButton
                  busy={busy}
                  disabled={!building || items.loading || Boolean(items.error)}
                >
                  Submit request
                </SubmitButton>
              </div>
            </form>
          </section>
          <aside className="form-note">
            <Info size={22} />
            <h3>A little detail goes a long way</h3>
            <p>
              Choose the correct building and give a clear room or location so
              the team can find the issue.
            </p>
            <p>
              You can track updates and administrator notes in My Requests after
              submitting.
            </p>
          </aside>
        </div>
      </ResourceState>
    </>
  );
}
