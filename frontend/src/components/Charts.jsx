import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { labels, requestStatuses, priorities, dateTime } from "../utils/format";
import { EmptyState } from "./UI";
const colors = ["var(--chart-one)", "var(--chart-two)", "var(--chart-three)"];
const tooltipTheme = {
  contentStyle: {
    background: "var(--surface-dark)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-light)",
    borderRadius: 12,
    boxShadow: "var(--shadow-card)",
  },
  labelStyle: { color: "var(--text-primary)", marginBottom: 6, fontSize: 12 },
  itemStyle: { fontSize: 12, color: "var(--text-primary)" },
  wrapperStyle: { outline: "none" },
};
export function RequestCharts({ requests, copy = {} }) {
  const reduced = useReducedMotion(),
    statuses = requestStatuses.map((v, i) => ({
      name: copy.label?.(v) || labels[v],
      value: requests.filter((r) => r.status === v).length,
      color: colors[i],
    })),
    priority = priorities.map((v) => ({
      name: copy.label?.(v) || labels[v],
      value: requests.filter((r) => r.priority === v).length,
    }));
  return (
    <div className="charts-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>{copy.byStatus || "Requests by status"}</h2>
          <span className="count-label">{copy.allRequests || "All requests"}</span>
        </div>
        {requests.length ? (
          <>
            <div
              className="chart-box"
              role="img"
              aria-label={statuses
                .map((s) => s.name + ": " + s.value)
                .join(", ")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statuses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={57}
                    outerRadius={82}
                    paddingAngle={3}
                    isAnimationActive={!reduced}
                    animationDuration={500}
                  >
                    {statuses.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipTheme} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-total">
                <strong>{requests.length}</strong>
                <span>{copy.requests || "REQUESTS"}</span>
              </div>
            </div>
            <div className="chart-legend">
              {statuses.map((s) => (
                <span key={s.name}>
                  <i style={{ background: s.color }} />
                  {s.name}
                  <strong>{s.value}</strong>
                </span>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title={copy.empty || "No requests to chart yet."} />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>{copy.byPriority || "Requests by priority"}</h2>
          <span className="count-label">{copy.allRequests || "All requests"}</span>
        </div>
        {requests.length ? (
          <div
            className="chart-box priority-chart"
            role="img"
            aria-label={priority.map((s) => s.name + ": " + s.value).join(", ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={priority}
                margin={{ left: -20, right: 15, top: 15, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                />
                <Tooltip
                  {...tooltipTheme}
                  cursor={{ fill: "var(--surface-soft)" }}
                />
                <Bar
                  dataKey="value"
                  name={copy.requestSeries || "Requests"}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={42}
                  isAnimationActive={!reduced}
                  animationDuration={500}
                >
                  {[
                    "var(--chart-one)",
                    "var(--attention)",
                    "var(--critical)",
                  ].map((c) => (
                    <Cell fill={c} key={c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title={copy.empty || "No requests to chart yet."} />
        )}
      </section>
    </div>
  );
}
export function EnvironmentCharts({ readings, copy = {} }) {
  const reduced = useReducedMotion(),
    data = [...readings].reverse().map((r) => ({
      ...r,
      time: copy.formatTime?.(r.recorded_at) || new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(r.recorded_at)),
    }));
  if (!data.length)
    return (
      <EmptyState title={copy.empty || "No environmental readings are available for this building."} />
    );
  const tooltipLabel = (_, payload) =>
    payload?.length ? copy.formatDate?.(payload[0].payload.recorded_at) || dateTime(payload[0].payload.recorded_at) : "";
  return (
    <div className="environment-charts">
      <h3>{copy.temperatureHumidity || "Temperature & humidity"}</h3>
      <div
        className="trend-chart"
        role="img"
        aria-label={copy.temperatureHumidityAria || "Temperature and humidity readings over time. The chart legend identifies both lines."}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ left: -15, right: -10, top: 15, bottom: 5 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="temp"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              unit="°C"
            />
            <YAxis
              yAxisId="humidity"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              unit="%"
            />
            <Tooltip {...tooltipTheme} labelFormatter={tooltipLabel} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
            />
            <Line
              yAxisId="temp"
              dataKey="temperature"
              name={copy.temperatureSeries || "Temperature (°C)"}
              stroke="var(--chart-one)"
              strokeWidth={2}
              isAnimationActive={!reduced}
              animationDuration={500}
            />
            <Line
              yAxisId="humidity"
              dataKey="humidity"
              name={copy.humiditySeries || "Humidity (%)"}
              stroke="var(--chart-two)"
              strokeWidth={2}
              isAnimationActive={!reduced}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3>{copy.energyConsumption || "Energy consumption"}</h3>
      <div
        className="trend-chart"
        role="img"
        aria-label={copy.energyAria || "Energy consumption readings over time. The chart legend identifies the line."}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ left: 0, right: 20, top: 15, bottom: 5 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
            <Tooltip {...tooltipTheme} labelFormatter={tooltipLabel} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
            />
            <Line
              dataKey="energy_consumption"
              name={copy.energySeries || "Energy (kWh)"}
              stroke="var(--chart-one)"
              strokeWidth={2}
              isAnimationActive={!reduced}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function EnergyCharts({ summaries, selected, copy = {} }) {
  const reduced = useReducedMotion();
  const comparison = summaries.filter((item) => item.latest_consumption !== null).map((item) => ({
    name: item.building.building_name,
    consumption: item.latest_consumption,
  }));
  return <div className="charts-grid energy-charts">
    <section className="panel">
      <div className="panel-heading"><h2>{copy.comparison || "Building comparison"}</h2><span className="count-label">kWh</span></div>
      {comparison.length ? <div className="chart-box" role="img" aria-label={comparison.map((item) => `${item.name}: ${item.consumption} kWh`).join(", ")}><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison} margin={{ left: -20, right: 15, top: 15, bottom: 10 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} /><Tooltip {...tooltipTheme} formatter={(value) => [`${value} kWh`, copy.latest || "Latest consumption"]} cursor={{ fill: "var(--surface-soft)" }} /><Bar dataKey="consumption" name={copy.latest || "Latest consumption"} radius={[5, 5, 0, 0]} isAnimationActive={!reduced} animationDuration={500}><Cell fill="var(--chart-one)" /></Bar></BarChart></ResponsiveContainer></div> : <EmptyState title={copy.noData || "No energy readings available."} />}
    </section>
    <section className="panel">
      <div className="panel-heading"><h2>{copy.trend || "Recent trend"}</h2><span className="count-label">{selected?.building.building_name || copy.noSelection}</span></div>
      {selected?.recent_readings?.length ? <div className="chart-box" role="img" aria-label={`${copy.trend || "Recent trend"}: ${selected.building.building_name}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={selected.recent_readings} margin={{ left: -20, right: 15, top: 15, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="recorded_at" tickFormatter={(value) => copy.formatTime?.(value) || dateTime(value)} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} /><Tooltip {...tooltipTheme} labelFormatter={(value) => copy.formatDate?.(value) || dateTime(value)} formatter={(value) => [`${value} kWh`, copy.consumption || "Consumption"]} /><Line type="monotone" dataKey="consumption" name={copy.consumption || "Consumption"} stroke="var(--chart-one)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={!reduced} animationDuration={500} /></LineChart></ResponsiveContainer></div> : <EmptyState title={copy.noTrend || "No trend data available."} />}
    </section>
  </div>;
}

export function ComfortCharts({ selected, copy = {} }) {
  const reduced = useReducedMotion();
  return <section className="panel comfort-chart-panel">
    <div className="panel-heading"><h2>{copy.trend || "Temperature & humidity trend"}</h2><span className="count-label">{selected?.building.building_name || copy.noSelection}</span></div>
    {selected?.recent_readings?.length ? <div className="chart-box" role="img" aria-label={`${copy.trend || "Temperature and humidity trend"}: ${selected.building.building_name}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={selected.recent_readings} margin={{ left: -10, right: 0, top: 15, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="recorded_at" tickFormatter={(value) => copy.formatTime?.(value) || dateTime(value)} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} /><YAxis yAxisId="temperature" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} unit="°C" /><YAxis yAxisId="humidity" orientation="right" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} unit="%" /><Tooltip {...tooltipTheme} labelFormatter={(value) => copy.formatDate?.(value) || dateTime(value)} /><Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} /><Line yAxisId="temperature" type="monotone" dataKey="temperature" name={copy.temperature || "Temperature (°C)"} stroke="var(--chart-one)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={!reduced} animationDuration={500} /><Line yAxisId="humidity" type="monotone" dataKey="humidity" name={copy.humidity || "Humidity (%)"} stroke="var(--chart-two)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={!reduced} animationDuration={500} /></LineChart></ResponsiveContainer></div> : <EmptyState title={copy.noTrend || "No comfort trend data available."} />}
  </section>;
}
