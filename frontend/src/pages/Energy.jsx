import { useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useLanguage } from "../context/LanguageContext";
import { energyService } from "../services/energyService";
import { EnergyCharts } from "../components/Charts";
import { Badge, EmptyState, PageHeader, ResourceState } from "../components/UI";

const threshold = 20;

export default function Energy() {
  const { t, language } = useLanguage();
  const resource = useResource(energyService.buildings);
  const [selectedId, setSelectedId] = useState(null);
  useRefreshOnFocus(resource.refresh, t("energyPage.refreshError"));
  const overview = resource.data || { buildings: [], campus_totals: null };
  const summaries = overview.buildings;
  const selected = summaries.find((item) => item.building.building_id === selectedId) || summaries.find((item) => item.recent_readings.length) || null;
  const highUsage = summaries.filter((item) => item.condition === "HIGH_USAGE").length;
  const formatDate = (value) => new Intl.DateTimeFormat(language === "my" ? "my-MM" : undefined, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  return <>
    <PageHeader eyebrow={t("energyPage.eyebrow")} title={t("energyPage.title")} description={t("energyPage.description")}><button className="button secondary" onClick={() => resource.refresh({ background: true })} disabled={resource.loading}><RefreshCw size={16} />{t("energyPage.refresh")}</button></PageHeader>
    <section className="stat-grid energy-stat-grid" aria-label={t("energyPage.summary")}><div className="stat-card"><div className="stat-top"><span>{t("energyPage.highUsage")}</span><Zap size={20} aria-hidden="true" /></div><strong>{highUsage}</strong><small>{t("energyPage.highUsageNote")}</small></div><div className="stat-card"><div className="stat-top"><span>{t("energyPage.rule")}</span><Zap size={20} aria-hidden="true" /></div><strong>+{threshold}%</strong><small>{t("energyPage.ruleNote")}</small></div></section>
    <p className="energy-rule"><Zap size={17} aria-hidden="true" />{t("energyPage.explanation")}</p>
    <ResourceState resource={resource} copy={{ loading: t("energyPage.loading"), retry: t("energyPage.retry"), error: t }}>
      {summaries.length ? <><section className="energy-summary-grid">{summaries.map((item) => <button key={item.building.building_id} className={`energy-card ${selected?.building.building_id === item.building.building_id ? "selected" : ""}`} onClick={() => setSelectedId(item.building.building_id)}><div className="record-top"><strong>{item.building.building_name}</strong>{item.condition ? <Badge value={item.condition} /> : <Badge value="NO_DATA" />}</div>{item.latest_consumption === null ? <p className="muted">{t("energyPage.noData")}</p> : <><strong className="energy-value">{item.latest_consumption}<small> kWh</small></strong><span>{t("energyPage.latest")}</span><div className="energy-meta"><span>{t("energyPage.recentAverage")}: <strong>{item.recent_average} kWh</strong></span><span className={`energy-difference ${item.percentage_difference >= 0 ? "up" : "down"}`}>{item.percentage_difference >= 0 ? "+" : ""}{item.percentage_difference}% · {t(item.trend)}</span></div>{item.condition === "HIGH_USAGE" && <p className="energy-reason">{t("energyPage.highReasonStart")} {item.percentage_difference}% {t("energyPage.highReasonEnd")} {threshold}%.</p>}<div className="energy-meta sustainability-metrics"><span>{t("energyPage.forecast")}: <strong>{item.forecast_consumption} kWh</strong></span><span>{t("energyPage.estimatedCost")}: <strong>{item.estimated_cost}</strong></span><span>{t("energyPage.estimatedCarbon")}: <strong>{item.estimated_carbon} kg CO₂e</strong></span></div><small>{t("energyPage.reading")}: {formatDate(item.timestamp)}</small></>}</button>)}</section><EnergyCharts summaries={summaries} selected={selected} copy={{ comparison: t("energyPage.comparison"), latest: t("energyPage.latest"), trend: t("energyPage.recentTrend"), noData: t("energyPage.noData"), noTrend: t("energyPage.noTrend"), noSelection: t("energyPage.noSelection"), consumption: t("energyPage.consumption"), formatTime: (value) => formatDate(value), formatDate }} /></> : <EmptyState title={t("energyPage.empty")} />}
    </ResourceState>
  </>;
}

