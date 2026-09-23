import { useState } from "react";
import { Droplets, RefreshCw, Thermometer } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useLanguage } from "../context/LanguageContext";
import { comfortService } from "../services/comfortService";
import { ComfortCharts } from "../components/Charts";
import { Badge, EmptyState, PageHeader, ResourceState } from "../components/UI";

export default function Comfort() {
  const { t, language } = useLanguage();
  const resource = useResource(comfortService.buildings);
  const [selectedId, setSelectedId] = useState(null);
  useRefreshOnFocus(resource.refresh, t("comfortPage.refreshError"));
  const summaries = resource.data || [];
  const selected = summaries.find((item) => item.building.building_id === selectedId) || summaries.find((item) => item.recent_readings.length) || null;
  const uncomfortable = summaries.filter((item) => item.condition === "UNCOMFORTABLE").length;
  const attention = summaries.filter((item) => item.condition === "ATTENTION").length;
  const formatDate = (value) => new Intl.DateTimeFormat(language === "my" ? "my-MM" : undefined, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  return <>
    <PageHeader eyebrow={t("comfortPage.eyebrow")} title={t("comfortPage.title")} description={t("comfortPage.description")}><button className="button secondary" onClick={() => resource.refresh({ background: true })} disabled={resource.loading}><RefreshCw size={16} />{t("comfortPage.refresh")}</button></PageHeader>
    <section className="stat-grid comfort-stat-grid" aria-label={t("comfortPage.summary")}><div className="stat-card"><div className="stat-top"><span>{t("comfortPage.uncomfortable")}</span><Thermometer size={20} aria-hidden="true" /></div><strong>{uncomfortable}</strong><small>{t("comfortPage.uncomfortableNote")}</small></div><div className="stat-card"><div className="stat-top"><span>{t("comfortPage.attention")}</span><Droplets size={20} aria-hidden="true" /></div><strong>{attention}</strong><small>{t("comfortPage.attentionNote")}</small></div></section>
    <p className="comfort-rule"><Thermometer size={17} aria-hidden="true" />{t("comfortPage.explanation")}</p>
    <ResourceState resource={resource} copy={{ loading: t("comfortPage.loading"), retry: t("comfortPage.retry"), error: t }}>
      {summaries.length ? <><section className="comfort-summary-grid">{summaries.map((item) => <button key={item.building.building_id} className={`comfort-card ${selected?.building.building_id === item.building.building_id ? "selected" : ""}`} onClick={() => setSelectedId(item.building.building_id)}><div className="record-top"><strong>{item.building.building_name}</strong>{item.condition ? <Badge value={item.condition} /> : <Badge value="NO_DATA" />}</div>{item.latest_temperature === null ? <p className="muted">{t("comfortPage.noData")}</p> : <><div className="comfort-values"><span><Thermometer size={17} aria-hidden="true" /><strong>{item.latest_temperature}°C</strong></span><span><Droplets size={17} aria-hidden="true" /><strong>{item.latest_humidity}%</strong></span></div><div className="comfort-copy"><span>{t("comfortPage.reason")}</span><p>{t(item.reason)}</p><span>{t("comfortPage.recommendation")}</span><p>{t(item.recommendation)}</p></div><small>{t("comfortPage.reading")}: {formatDate(item.timestamp)}</small></>}</button>)}</section><ComfortCharts selected={selected} copy={{ trend: t("comfortPage.recentTrend"), noSelection: t("comfortPage.noSelection"), noTrend: t("comfortPage.noTrend"), temperature: t("comfortPage.temperature"), humidity: t("comfortPage.humidity"), formatDate, formatTime: formatDate }} /></> : <EmptyState title={t("comfortPage.empty")} />}
    </ResourceState>
  </>;
}
