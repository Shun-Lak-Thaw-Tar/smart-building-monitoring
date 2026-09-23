import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { buildingService } from "../services/buildingService";
import { equipmentService } from "../services/equipmentService";
import { requestService } from "../services/requestService";
import { errorMessage } from "../services/apiClient";
import {
  PageHeader,
  ResourceState,
  Field,
  SubmitButton,
  ErrorAlert,
} from "../components/UI";
import { priorities } from "../utils/format";
export default function NewRequest() {
  const { language, t } = useLanguage();
  const navigate = useNavigate(),
    toast = useToast(),
    [building, setBuilding] = useState(""),
    [equipment, setEquipment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false),
    formRef = useRef(null);
  const buildings = useResource(buildingService.list),
    items = useResource(
      () =>
        building
          ? equipmentService.list({ building_id: building })
          : Promise.resolve([]),
      building,
    );
  useRefreshOnFocus(
    () => building ? items.refresh({ background: true }) : Promise.resolve(true),
    t("newRequest.refreshError"),
  );
  useEffect(() => {
    if (
      equipment &&
      !items.loading &&
      !items.data?.some((item) => item.equipment_id === Number(equipment))
    )
      setEquipment("");
  }, [equipment, items.data, items.loading]);
  useEffect(() => {
    formRef.current?.querySelectorAll("input, select, textarea").forEach((field) => {
      field.setCustomValidity("");
    });
  }, [language]);
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const data = Object.fromEntries(new FormData(e.currentTarget));
    for (const key of ["room_location", "description"])
      if (!data[key].trim()) {
        setError("newRequest.blankFields");
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
      toast(t("newRequest.success"));
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
        eyebrow={t("newRequest.eyebrow")}
        title={t("newRequest.title")}
        description={t("newRequest.description")}
      />
      <ResourceState resource={buildings} copy={{
        loading: t("newRequest.loading"),
        error: (message) => t(message),
        retry: t("newRequest.retry"),
      }}>
        <div className="form-layout">
          <section className="panel">
            <div className="panel-heading">
              <h2>{t("newRequest.details")}</h2>
              <span className="muted small-text">{t("newRequest.requiredFields")}</span>
            </div>
            <ErrorAlert message={t(error)} />
            <form
              ref={formRef}
              onSubmit={submit}
              onInvalidCapture={(e) => e.target.setCustomValidity(t("newRequest.requiredValidation"))}
              onInputCapture={(e) => e.target.setCustomValidity("")}
              onChangeCapture={(e) => e.target.setCustomValidity("")}
            >
              <div className="form-grid">
                <Field label={t("newRequest.building")} required>
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
                      <option value="">{t("newRequest.selectBuilding")}</option>
                      {buildings.data?.map((b) => (
                        <option key={b.building_id} value={b.building_id}>
                          {b.building_name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  label={t("newRequest.equipment")}
                  hint={t("newRequest.equipmentHint")}
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
                          ? t("newRequest.loadingEquipment")
                          : t("newRequest.generalIssue")}
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
                <Field label={t("newRequest.room")} required>
                  {(id) => (
                    <input
                      id={id}
                      name="room_location"
                      required
                      maxLength={150}
                      placeholder={t("newRequest.roomPlaceholder")}
                    />
                  )}
                </Field>
                <Field label={t("newRequest.category")} required>
                  {(id) => (
                    <select
                      id={id}
                      name="fault_category"
                      required
                      defaultValue=""
                    >
                      <option value="">{t("newRequest.selectCategory")}</option>
                      {[
                        "Electrical",
                        "Air Conditioning",
                        "Plumbing",
                        "Lighting",
                        "Equipment",
                        "Other",
                      ].map((v) => (
                        <option key={v} value={v}>{t(v)}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <div className="span-all">
                  <Field
                    label={t("newRequest.descriptionLabel")}
                    required
                    hint={t("newRequest.descriptionHint")}
                  >
                    {(id) => (
                      <textarea
                        id={id}
                        name="description"
                        required
                        maxLength={5000}
                        rows={5}
                        placeholder={t("newRequest.descriptionPlaceholder")}
                      />
                    )}
                  </Field>
                </div>
                <Field label={t("newRequest.priority")} required>
                  {(id) => (
                    <select id={id} name="priority" defaultValue="MEDIUM">
                      {priorities.map((value) => (
                        <option key={value} value={value}>{t(value)}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <ErrorAlert message={t(items.error)} onRetry={items.refresh} retryLabel={t("newRequest.retry")} />
              <div className="form-actions">
                <Link className="button secondary" to="/staff/requests">
                  {t("newRequest.cancel")}
                </Link>
                <SubmitButton
                  busy={busy}
                  busyLabel={t("newRequest.saving")}
                  disabled={!building || items.loading || Boolean(items.error)}
                >
                  {t("newRequest.submit")}
                </SubmitButton>
              </div>
            </form>
          </section>
          <aside className="form-note">
            <Info size={22} />
            <h3>{t("newRequest.noteTitle")}</h3>
            <p>
              {t("newRequest.noteBuilding")}
            </p>
            <p>
              {t("newRequest.noteTrack")}
            </p>
          </aside>
        </div>
      </ResourceState>
    </>
  );
}
