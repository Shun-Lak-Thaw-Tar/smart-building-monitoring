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
export function RequestCharts({ requests }) {
  const reduced = useReducedMotion(),
    statuses = requestStatuses.map((v, i) => ({
      name: labels[v],
      value: requests.filter((r) => r.status === v).length,
      color: colors[i],
    })),
    priority = priorities.map((v) => ({
      name: labels[v],
      value: requests.filter((r) => r.priority === v).length,
    }));
  return (
    <div className="charts-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>Requests by status</h2>
          <span className="count-label">All requests</span>
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
                <span>REQUESTS</span>
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
          <EmptyState title="No requests to chart yet." />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Requests by priority</h2>
          <span className="count-label">All requests</span>
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
                  name="Requests"
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
          <EmptyState title="No requests to chart yet." />
        )}
      </section>
    </div>
  );
}
export function EnvironmentCharts({ readings }) {
  const reduced = useReducedMotion(),
    data = [...readings].reverse().map((r) => ({
      ...r,
      time: new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(r.recorded_at)),
    }));
  if (!data.length)
    return (
      <EmptyState title="No environmental readings are available for this building." />
    );
  const tooltipLabel = (_, payload) =>
    payload?.length ? dateTime(payload[0].payload.recorded_at) : "";
  return (
    <div className="environment-charts">
      <h3>Temperature & humidity</h3>
      <div
        className="trend-chart"
        role="img"
        aria-label="Temperature and humidity readings over time. The chart legend identifies both lines."
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
              name="Temperature (°C)"
              stroke="var(--chart-one)"
              strokeWidth={2}
              isAnimationActive={!reduced}
              animationDuration={500}
            />
            <Line
              yAxisId="humidity"
              dataKey="humidity"
              name="Humidity (%)"
              stroke="var(--chart-two)"
              strokeWidth={2}
              isAnimationActive={!reduced}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3>Energy consumption</h3>
      <div
        className="trend-chart"
        role="img"
        aria-label="Energy consumption readings over time. The chart legend identifies the line."
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
              name="Energy (kWh)"
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
