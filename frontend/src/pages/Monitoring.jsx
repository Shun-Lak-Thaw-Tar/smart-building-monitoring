import { useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useLanguage } from "../context/LanguageContext";
import { monitoringService } from "../services/monitoringService";
import { PageHeader, ResourceState, Modal, Badge } from "../components/UI";
import BuildingCards from "../components/BuildingCards";
import { EnvironmentCharts } from "../components/Charts";
export default function Monitoring() {
  const { t, language } = useLanguage();
  const resource = useResource(monitoringService.list),
    [selectedId, setSelectedId] = useState(null),
    selected = resource.data?.find(
      (item) => item.building.building_id === selectedId,
    );
  useRefreshOnFocus(resource.refresh, t("monitoringPage.refreshError"));
  const displayDate = (value, options) => new Intl.DateTimeFormat(
    language === "my" ? "my-MM" : undefined,
    options || { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
  ).format(new Date(value));
  const cardCopy = {
    noBuildings: t("monitoringPage.noBuildings"),
    temperature: t("monitoringPage.temperature"),
    humidity: t("monitoringPage.humidity"),
    energy: t("monitoringPage.energy"),
    equipment: t("monitoringPage.equipmentLower"),
    openRequests: t("monitoringPage.openRequests"),
    equipmentHeading: t("monitoringPage.equipment"),
    operational: t("monitoringPage.operational"),
    maintenanceRequired: t("monitoringPage.maintenanceRequired"),
    outOfService: t("monitoringPage.outOfService"),
    requestsHeading: t("monitoringPage.requests"),
    pending: t("monitoringPage.pending"),
    inProgress: t("monitoringPage.inProgress"),
    resolved: t("monitoringPage.resolved"),
    reading: t("monitoringPage.reading"),
    noReadings: t("monitoringPage.noReadings"),
    formatDate: displayDate,
  };
  return (
    <>
      <PageHeader
        eyebrow={t("monitoringPage.eyebrow")}
        title={t("monitoringPage.title")}
        description={t("monitoringPage.description")}
      >
        <button
          className="button secondary"
          disabled={resource.loading}
          onClick={() => resource.refresh({ background: true })}
        >
          <RefreshCw size={16} />
          {t("monitoringPage.refresh")}
        </button>
      </PageHeader>
      <div className="simulation-label">
        <Activity size={16} />
        {t("monitoringPage.simulatedData")}<span>{t("monitoringPage.readOnly")}</span>
      </div>
      <ResourceState resource={resource} copy={{ loading: t("monitoringPage.loading"), retry: t("monitoringPage.retry"), error: t }}>
        <BuildingCards
          buildings={resource.data || []}
          copy={cardCopy}
          onSelect={(building) => setSelectedId(building.building.building_id)}
        />
      </ResourceState>
      {selected && (
        <BuildingDetail building={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
function BuildingDetail({ building, onClose }) {
  const { t, language } = useLanguage();
  const resource = useResource(() =>
      monitoringService.history(building.building.building_id),
    ),
    e = building.equipment_summary,
    r = building.request_summary,
    latest = resource.data?.readings[0];
  useRefreshOnFocus(resource.refresh, t("monitoringPage.refreshError"));
  const displayDate = (value, options) => new Intl.DateTimeFormat(
    language === "my" ? "my-MM" : undefined,
    options || { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
  ).format(new Date(value));
  return (
    <Modal title={building.building.building_name} onClose={onClose} closeLabel={t("monitoringPage.closeDialog")}>
      <p className="simulation-label">{t("monitoringPage.simulatedData")}</p>
      <div className="monitor-summary">
        <Badge value={building.overall_status} />
        <p>
          <strong>{t("monitoringPage.equipment")}:</strong> {e.operational} {t("monitoringPage.operational")} ·{" "}
          {e.maintenance_required} {t("monitoringPage.maintenanceRequired")} · {e.out_of_service} {t("monitoringPage.outOfService")}
        </p>
        <p>
          <strong>{t("monitoringPage.requests")}:</strong> {r.pending} {t("monitoringPage.pending")} · {r.in_progress} {t("monitoringPage.inProgress")} · {r.resolved} {t("monitoringPage.resolved")}
        </p>
      </div>
      <ResourceState resource={resource} copy={{ loading: t("monitoringPage.loadingHistory"), retry: t("monitoringPage.retry"), error: t }}>
        {latest && (
          <div className="latest-reading">
            <h3>{t("monitoringPage.latestReading")}</h3>
            <p>
              {latest.temperature} °C <span>·</span> {latest.humidity}% {t("monitoringPage.humidityLower")}{" "}
              <span>·</span> {latest.energy_consumption} kWh
            </p>
            <small>{displayDate(latest.recorded_at)}</small>
          </div>
        )}
        <EnvironmentCharts readings={resource.data?.readings || []} copy={{
          empty: t("monitoringPage.noBuildingReadings"),
          temperatureHumidity: t("monitoringPage.temperatureHumidity"),
          temperatureHumidityAria: t("monitoringPage.temperatureHumidityAria"),
          temperatureSeries: t("monitoringPage.temperatureSeries"),
          humiditySeries: t("monitoringPage.humiditySeries"),
          energyConsumption: t("monitoringPage.energyConsumption"),
          energyAria: t("monitoringPage.energyAria"),
          energySeries: t("monitoringPage.energySeries"),
          formatDate: displayDate,
          formatTime: (value) => displayDate(value, { hour: "numeric", minute: "2-digit" }),
        }} />
        {Boolean(resource.data?.readings.length) && (
          <details className="readings-details">
            <summary>
              {t("monitoringPage.environmentalHistory")} · {resource.data.readings.length} {t(resource.data.readings.length === 1 ? "monitoringPage.oneReading" : "monitoringPage.readings")}
            </summary>
            <div
              className="table-scroll"
              tabIndex={0}
              aria-label={t("monitoringPage.environmentalReadings")}
            >
              <table>
                <thead>
                  <tr>
                    <th>{t("monitoringPage.recorded")}</th>
                    <th>{t("monitoringPage.temperature")} °C</th>
                    <th>{t("monitoringPage.humidity")} %</th>
                    <th>{t("monitoringPage.energy")} kWh</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.readings.map((item) => (
                    <tr key={item.reading_id}>
                      <td>{displayDate(item.recorded_at)}</td>
                      <td>{item.temperature}</td>
                      <td>{item.humidity}</td>
                      <td>{item.energy_consumption}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </ResourceState>
    </Modal>
  );
}
