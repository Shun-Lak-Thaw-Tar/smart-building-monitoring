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
const colors = ["#7aa6b6", "#efbd62", "#3c9580"];
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
                  <Tooltip />
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
                <CartesianGrid vertical={false} stroke="#eef2f3" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#7c939a" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8da0a5" }}
                />
                <Tooltip cursor={{ fill: "#f3f8f8" }} />
                <Bar
                  dataKey="value"
                  name="Requests"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={42}
                  isAnimationActive={!reduced}
                  animationDuration={500}
                >
                  {["#8fb8be", "#edc476", "#cf7b7b"].map((c) => (
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
    data = [...readings]
      .reverse()
      .map((r) => ({
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
      <div className="trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ left: -15, right: -10, top: 15, bottom: 5 }}
          >
            <CartesianGrid stroke="#edf2f3" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis yAxisId="temp" tick={{ fontSize: 10 }} unit="°C" />
            <YAxis
              yAxisId="humidity"
              orientation="right"
              tick={{ fontSize: 10 }}
              unit="%"
            />
            <Tooltip labelFormatter={tooltipLabel} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="temp"
              dataKey="temperature"
              name="Temperature (°C)"
              stroke="#0f6b78"
              strokeWidth={2}
              isAnimationActive={!reduced}
            />
            <Line
              yAxisId="humidity"
              dataKey="humidity"
              name="Humidity (%)"
              stroke="#d19b39"
              strokeWidth={2}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3>Energy consumption</h3>
      <div className="trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ left: 0, right: 20, top: 15, bottom: 5 }}
          >
            <CartesianGrid stroke="#edf2f3" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip labelFormatter={tooltipLabel} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              dataKey="energy_consumption"
              name="Energy (kWh)"
              stroke="#0f6b78"
              strokeWidth={2}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
