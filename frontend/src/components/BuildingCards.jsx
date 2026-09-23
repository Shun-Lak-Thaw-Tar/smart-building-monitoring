import {
  Building2,
  ArrowUpRight,
  Thermometer,
  Droplets,
  Zap,
} from "lucide-react";
import { Badge, EmptyState } from "./UI";
import { dateTime } from "../utils/format";
export default function BuildingCards({
  buildings,
  onSelect,
  compact = false,
  copy = {},
}) {
  if (!buildings.length) return <EmptyState title={copy.noBuildings || "No buildings available."} />;
  return (
    <div className={`building-grid ${compact ? "compact" : ""}`}>
      {buildings.map((b) => (
        <button
          className={`building-card status-${b.overall_status.toLowerCase()}`}
          key={b.building.building_id}
          onClick={() => onSelect(b)}
        >
          <div className="building-top">
            <span className="building-icon">
              <Building2 size={23} />
            </span>
            <Badge value={b.overall_status} />
          </div>
          <div className="building-name">
            <h3>{b.building.building_name}</h3>
            <ArrowUpRight size={18} />
          </div>
          {!compact && (
            <div className="environment-values">
              <div>
                <Thermometer size={16} />
                <strong>
                  {b.latest_environment?.temperature ?? "—"}
                  <small> °C</small>
                </strong>
                <span>{copy.temperature || "Temperature"}</span>
              </div>
              <div>
                <Droplets size={16} />
                <strong>
                  {b.latest_environment?.humidity ?? "—"}
                  <small> %</small>
                </strong>
                <span>{copy.humidity || "Humidity"}</span>
              </div>
              <div>
                <Zap size={16} />
                <strong>
                  {b.latest_environment?.energy_consumption ?? "—"}
                  <small> kWh</small>
                </strong>
                <span>{copy.energy || "Energy"}</span>
              </div>
            </div>
          )}
          <div className="building-meta">
            <span>
              <strong>{b.equipment_summary.total}</strong> {copy.equipment || "equipment"}
            </span>
            <span>
              <strong>
                {b.request_summary.pending + b.request_summary.in_progress}
              </strong>{" "}
              {copy.openRequests || "open requests"}
            </span>
          </div>
          {!compact && (
            <>
              <div className="summary-lines">
                <span>{copy.equipmentHeading || "Equipment"}</span>
                <p>
                  {b.equipment_summary.operational} {copy.operational || "operational"} ·{" "}
                  {b.equipment_summary.maintenance_required} {copy.maintenanceRequired || "maintenance required"} ·{" "}
                  {b.equipment_summary.out_of_service} {copy.outOfService || "out of service"}
                </p>
                <span>{copy.requestsHeading || "Requests"}</span>
                <p>
                  {b.request_summary.pending} {copy.pending || "pending"} ·{" "}
                  {b.request_summary.in_progress} {copy.inProgress || "in progress"} ·{" "}
                  {b.request_summary.resolved} {copy.resolved || "resolved"}
                </p>
              </div>
              <small className="reading-time">
                {b.latest_environment
                  ? `${copy.reading || "Reading"}: ${copy.formatDate?.(b.latest_environment.recorded_at) || dateTime(b.latest_environment.recorded_at)}`
                  : copy.noReadings || "No environmental readings available"}
              </small>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
