import { useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { monitoringService } from "../services/monitoringService";
import { PageHeader, ResourceState, Modal, Badge } from "../components/UI";
import BuildingCards from "../components/BuildingCards";
import { EnvironmentCharts } from "../components/Charts";
import { dateTime } from "../utils/format";
export default function Monitoring() {
  const resource = useResource(monitoringService.list),
    [selected, setSelected] = useState(null);
  return (
    <>
      <PageHeader
        title="Building monitoring"
        description="Real-time-style overview using simulated environmental data."
      >
        <button
          className="button secondary"
          disabled={resource.loading}
          onClick={resource.refresh}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </PageHeader>
      <div className="simulation-label">
        <Activity size={16} />
        Simulated Environmental Data<span>Read-only campus overview</span>
      </div>
      <ResourceState resource={resource}>
        <BuildingCards buildings={resource.data || []} onSelect={setSelected} />
      </ResourceState>
      {selected && (
        <BuildingDetail building={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
function BuildingDetail({ building, onClose }) {
  const resource = useResource(() =>
      monitoringService.history(building.building.building_id),
    ),
    e = building.equipment_summary,
    r = building.request_summary,
    latest = resource.data?.readings[0];
  return (
    <Modal title={building.building.building_name} onClose={onClose}>
      <p className="simulation-label">Simulated Environmental Data</p>
      <div className="monitor-summary">
        <Badge value={building.overall_status} />
        <p>
          <strong>Equipment:</strong> {e.operational} operational ·{" "}
          {e.maintenance_required} maintenance required · {e.out_of_service} out
          of service
        </p>
        <p>
          <strong>Requests:</strong> {r.pending} pending · {r.in_progress} in
          progress · {r.resolved} resolved
        </p>
      </div>
      <ResourceState resource={resource}>
        {latest && (
          <div className="latest-reading">
            <h3>Latest reading</h3>
            <p>
              {latest.temperature} °C <span>·</span> {latest.humidity}% humidity{" "}
              <span>·</span> {latest.energy_consumption} kWh
            </p>
            <small>{dateTime(latest.recorded_at)}</small>
          </div>
        )}
        <EnvironmentCharts readings={resource.data?.readings || []} />
        {Boolean(resource.data?.readings.length) && (
          <details className="readings-details">
            <summary>
              Environmental history · {resource.data.readings.length} readings
            </summary>
            <div
              className="table-scroll"
              tabIndex={0}
              aria-label="Environmental readings"
            >
              <table>
                <thead>
                  <tr>
                    <th>Recorded</th>
                    <th>Temperature °C</th>
                    <th>Humidity %</th>
                    <th>Energy kWh</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.readings.map((item) => (
                    <tr key={item.reading_id}>
                      <td>{dateTime(item.recorded_at)}</td>
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
