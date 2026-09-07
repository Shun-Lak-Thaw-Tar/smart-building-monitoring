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
}) {
  if (!buildings.length) return <EmptyState title="No buildings available." />;
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
                <span>Temperature</span>
              </div>
              <div>
                <Droplets size={16} />
                <strong>
                  {b.latest_environment?.humidity ?? "—"}
                  <small> %</small>
                </strong>
                <span>Humidity</span>
              </div>
              <div>
                <Zap size={16} />
                <strong>
                  {b.latest_environment?.energy_consumption ?? "—"}
                  <small> kWh</small>
                </strong>
                <span>Energy</span>
              </div>
            </div>
          )}
          <div className="building-meta">
            <span>
              <strong>{b.equipment_summary.total}</strong> equipment
            </span>
            <span>
              <strong>
                {b.request_summary.pending + b.request_summary.in_progress}
              </strong>{" "}
              open requests
            </span>
          </div>
          {!compact && (
            <>
              <div className="summary-lines">
                <span>Equipment</span>
                <p>
                  {b.equipment_summary.operational} operational ·{" "}
                  {b.equipment_summary.maintenance_required} maintenance
                  required · {b.equipment_summary.out_of_service} out of service
                </p>
                <span>Requests</span>
                <p>
                  {b.request_summary.pending} pending ·{" "}
                  {b.request_summary.in_progress} in progress ·{" "}
                  {b.request_summary.resolved} resolved
                </p>
              </div>
              <small className="reading-time">
                {b.latest_environment
                  ? "Reading: " + dateTime(b.latest_environment.recorded_at)
                  : "No environmental readings available"}
              </small>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
