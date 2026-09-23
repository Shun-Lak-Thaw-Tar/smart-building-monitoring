import { useState } from "react";
import { Link } from "react-router-dom";
import { CirclePlus } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAction } from "../hooks/useAction";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
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
export default function Maintenance() {
  const { t, language } = useLanguage();
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
  useRefreshOnFocus(async () => {
    const results = await Promise.all([
      options.refresh({ background: true }),
      resource.refresh({ background: true }),
    ]);
    return results.every(Boolean);
  }, t("maintenancePage.refreshError"));
  const [buildings, items] = options.data || [[], []],
    filteredEquipment = items.filter(
      (e) => !building || e.building.building_id === Number(building),
    );
  const displayDate = (value) => value
    ? new Intl.DateTimeFormat(language === "my" ? "my-MM" : undefined, {
        day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
      }).format(new Date(value))
    : t("maintenancePage.dateUnavailable");
  return (
    <>
      <PageHeader
        eyebrow={t("maintenancePage.eyebrow")}
        title={t("maintenancePage.title")}
        description={t("maintenancePage.description")}
      >
        <button
          className="button"
          onClick={() => setOpen(true)}
          disabled={options.loading || Boolean(options.error)}
        >
          <CirclePlus size={18} />
          {t("maintenancePage.record")}
        </button>
      </PageHeader>
      <section className="panel filter-panel">
        <div className="filters">
          <Field label={t("maintenancePage.building")}>
            {(id) => (
              <select
                id={id}
                value={building}
                onChange={(e) => {
                  setBuilding(e.target.value);
                  setEquipment("");
                }}
              >
                <option value="">{t("maintenancePage.allBuildings")}</option>
                {buildings.map((b) => (
                  <option key={b.building_id} value={b.building_id}>
                    {b.building_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("maintenancePage.equipment")}>
            {(id) => (
              <select
                id={id}
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              >
                <option value="">{t("maintenancePage.allEquipment")}</option>
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
            {t("maintenancePage.clear")}
          </button>
        </div>
        <ErrorAlert message={t(options.error)} onRetry={options.refresh} retryLabel={t("maintenancePage.retry")} />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("maintenancePage.completedMaintenance")}</h2>
          <span className="count-label">
            {resource.data?.length || 0} {t(resource.data?.length === 1 ? "maintenancePage.oneRecord" : "maintenancePage.records")}
          </span>
        </div>
        <ResourceState resource={resource} copy={{ loading: t("maintenancePage.loading"), retry: t("maintenancePage.retry"), error: t }}>
          {resource.data?.length ? (
            <>
              <div className="table-scroll management-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("maintenancePage.completed")}</th>
                      <th>{t("maintenancePage.equipmentBuilding")}</th>
                      <th>{t("maintenancePage.linkedRequest")}</th>
                      <th>{t("maintenancePage.completedBy")}</th>
                      <th>{t("maintenancePage.actionDetails")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.map((r) => (
                      <tr key={r.history_id}>
                        <td className="date-cell">
                          {displayDate(r.completed_at)}
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
                              {t("maintenancePage.request")} #{r.request.request_id}
                            </Link>
                          ) : (
                            <span className="preventive-label">
                              {t("maintenancePage.preventive")}
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
                      <small>{displayDate(r.completed_at)}</small>
                    </div>
                    <h3>{r.equipment.equipment_name}</h3>
                    <p className="action-details">{r.action_details}</p>
                    <div className="record-bottom">
                      {r.request ? (
                        <Link to={"/admin/requests/" + r.request.request_id}>
                          {t("maintenancePage.request")} #{r.request.request_id}
                        </Link>
                      ) : (
                        <small>{t("maintenancePage.preventive")}</small>
                      )}
                      <small>{r.completed_by.name}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title={t("maintenancePage.empty")} />
          )}
        </ResourceState>
      </section>
      {open && (
        <MaintenanceForm
          equipment={items}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            resource.refresh({ background: true });
          }}
        />
      )}
    </>
  );
}
function MaintenanceForm({ equipment, onClose, onSaved }) {
  const { t } = useLanguage();
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
      action.setError("maintenancePage.detailsRequired");
      return;
    }
    action.run(async () => {
      await maintenanceService.create({
        equipment_id: Number(selected),
        request_id: linked ? Number(linked) : null,
        action_details: details,
      });
      toast(t("maintenancePage.createSuccess"));
      onSaved();
    });
  }
  return (
    <Modal
      title={t("maintenancePage.recordDialog")}
      onClose={onClose}
      busy={action.busy}
      closeLabel={t("maintenancePage.closeDialog")}
    >
      <p className="modal-intro">
        {t("maintenancePage.dialogIntro")}
      </p>
      <ErrorAlert message={t(action.error)} />
      <form
        onSubmit={submit}
        onInvalidCapture={(e) => e.target.setCustomValidity(t("maintenancePage.requiredValidation"))}
        onInputCapture={(e) => e.target.setCustomValidity("")}
        onChangeCapture={(e) => e.target.setCustomValidity("")}
      >
        <Field label={t("maintenancePage.equipment")} required>
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
              <option value="">{t("maintenancePage.selectEquipment")}</option>
              {equipment.map((e) => (
                <option key={e.equipment_id} value={e.equipment_id}>
                  {e.equipment_name} · {e.building.building_name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label={t("maintenancePage.linkedResolvedRequest")}
          hint={
            selected && !matching.length && !requests.loading
              ? t("maintenancePage.noResolvedRequests")
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
                {requests.loading
                  ? t("maintenancePage.loadingRequests")
                  : t("maintenancePage.noLinkedRequest")}
              </option>
              {matching.map((r) => (
                <option key={r.request_id} value={r.request_id}>
                  {t("maintenancePage.request")} #{r.request_id} · {t(r.fault_category)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <ErrorAlert message={t(requests.error)} onRetry={requests.refresh} retryLabel={t("maintenancePage.retry")} />
        <Field label={t("maintenancePage.actionDetails")} required>
          {(id) => (
            <textarea
              id={id}
              name="action_details"
              required
              maxLength={2000}
              rows={5}
              placeholder={t("maintenancePage.detailsPlaceholder")}
            />
          )}
        </Field>
        <div className="form-actions">
          <SubmitButton busy={action.busy} busyLabel={t("maintenancePage.saving")} disabled={!selected}>
            {t("maintenancePage.recordButton")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
