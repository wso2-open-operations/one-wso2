// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import {
  Box, Chip, CircularProgress, Collapse, MenuItem, Select, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { ExpandMore as ExpandMoreIcon } from "../icons";
import { ExpandLess as ExpandLessIcon } from "../icons";
import { CheckCircleOutline as CheckCircleOutlineIcon } from "../icons";
import { MailOutline as MailOutlineIcon } from "../icons";
import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, Tooltip as RTooltip, Cell,
} from "recharts";
import type { CompetitiveAlert, G2SignalAnalytics } from "../api/client";
import { useCompetitiveAlerts, useCompetitiveTrends, useG2SignalAnalytics } from "../api/queries";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";
import { ISAC_SCREEN, isacPath } from "../paths";

// ── Design tokens ───────────────────────────────────────────────────────────



const STAGE_COLOR: Record<string, string> = {
  decision: C.churn, consideration: C.amber, awareness: C.blue,
};

const COMPETITORS: Record<string, { name: string }[]> = {
  "WSO2 API Platform": [
    { name: "Kong" }, { name: "MuleSoft" }, { name: "Apigee (Google)" },
    { name: "Postman" }, { name: "AWS API Gateway" }, { name: "Azure API Mgmt" },
  ],
  "WSO2 Identity Platform": [
    { name: "Ping Identity" }, { name: "Okta" }, { name: "Auth0" },
    { name: "ForgeRock" }, { name: "OneLogin" }, { name: "Microsoft Entra" },
  ],
  "WSO2 Integration Platform": [
    { name: "Boomi" }, { name: "MuleSoft" }, { name: "Informatica" },
    { name: "Workato" }, { name: "Celigo" }, { name: "SnapLogic" },
  ],
};

const PRODUCTS = [
  { value: "", label: "All Products" },
  { value: "WSO2 API Platform", label: "API Platform" },
  { value: "WSO2 Identity Platform", label: "Identity Platform" },
  { value: "WSO2 Integration Platform", label: "Integration Platform" },
];

const TIME_WINDOWS = [7, 14, 30, 60, 90];
type TabId = "overview" | "competitive";

// ── Helpers ─────────────────────────────────────────────────────────────────

function relativeDate(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 3_600_000) return "< 1h ago";
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(mo, 10) - 1]} '${y?.slice(2)}`;
}

function intensityPct(val: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min((val / max) * 100, 100);
}

type RiskLevel = "high" | "medium" | "low";

interface RiskAssessment {
  level: RiskLevel;
  score: number;
  reasons: string[];
}

const RISK_CONFIG = {
  high: { color: "#dc2626", bg: "#dc262610", label: "High Risk" },
  medium: { color: "#a97508", bg: "#a9750810", label: "Medium" },
  low: { get color() { return C.sub; }, bg: "#6b728010", label: "Low" },
};

function assessRisk(alert: CompetitiveAlert): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;
  const totalViews = alert.compare_views + alert.competitor_views;

  // Stage factor
  if (alert.stage === "decision") { score += 40; reasons.push("Decision stage"); }
  else if (alert.stage === "consideration") { score += 20; reasons.push("Consideration stage"); }
  else if (alert.stage === "awareness") { score += 5; }

  // Activity volume
  if (totalViews >= 5) { score += 30; reasons.push(`${totalViews} competitor page views`); }
  else if (totalViews >= 3) { score += 15; reasons.push(`${totalViews} competitor views`); }
  else { score += 5; }

  // Competitive signals
  if (alert.signals >= 3) { score += 20; reasons.push(`${alert.signals} competitive signals`); }
  else if (alert.signals >= 1) { score += 10; }

  // WSO2 engagement (reduces risk — they're still comparing, not gone)
  if (alert.also_viewing_wso2) {
    score -= 15;
    reasons.push("Still viewing WSO2");
  } else if (totalViews >= 2) {
    score += 10;
    reasons.push("Not viewing WSO2");
  }

  // Recency
  if (alert.last_seen) {
    const daysSince = (Date.now() - new Date(alert.last_seen).getTime()) / 86_400_000;
    if (daysSince <= 3) { score += 10; reasons.push("Active in last 3 days"); }
    else if (daysSince <= 7) { score += 5; }
  }

  const level: RiskLevel = score >= 50 ? "high" : score >= 25 ? "medium" : "low";
  return { level, score, reasons };
}

type AlertCategory = "churn" | "prospect" | "winback";

const ALERT_EMAIL_CONFIG: Record<AlertCategory, {
  subjectTag: string; noun: string; intro: string; tone: string; actions: string[];
}> = {
  churn: {
    subjectTag: "Churn Risk",
    noun: "existing WSO2 customer",
    intro: "actively evaluating competitor products on G2",
    tone: "This doesn't necessarily mean they're leaving, but it's worth a proactive check-in to understand if there are any unmet needs or concerns.",
    actions: [
      "Schedule a call with the customer to understand their current experience and if anything is falling short",
      "Check for any open support tickets or unresolved issues that might be driving them to look elsewhere",
      "Proactively share recent product updates, roadmap items, or success stories relevant to their use case",
      "If they're comparing specific competitors, prepare talking points on how WSO2 differentiates in those areas",
    ],
  },
  prospect: {
    subjectTag: "Prospect Risk",
    noun: "active prospect",
    intro: "comparing WSO2 against competitors on G2",
    tone: "These prospects are actively in evaluation mode. Timely engagement can make the difference before they shortlist.",
    actions: [
      "Reach out to the prospect to understand their evaluation timeline and decision criteria",
      "Share relevant case studies, competitive battlecards, or technical differentiators",
      "Offer a personalised demo or proof-of-concept focused on their specific use case",
      "If they're viewing specific competitor pages, tailor your messaging to address those comparisons",
    ],
  },
  winback: {
    subjectTag: "Win-Back Signal",
    noun: "lost account",
    intro: "back in market and browsing solutions on G2",
    tone: "These are former customers or lost deals who are actively evaluating again — a strong signal that their current solution may not be meeting expectations.",
    actions: [
      "Review the original reasons for churn or loss and assess whether those issues have since been addressed",
      "Reach out with a personalised message acknowledging the history and highlighting what's changed since they left",
      "Offer a re-evaluation call or updated demo showcasing new capabilities relevant to their needs",
      "Consider a special win-back offer or executive-sponsored engagement to re-open the conversation",
    ],
  },
};

function buildAlertEmailDraft(alerts: CompetitiveAlert[], days: number, category: AlertCategory): string {
  const cfg = ALERT_EMAIL_CONFIG[category];
  const plural = alerts.length > 1 ? "s" : "";
  const lines = [
    `Hi,`,
    ``,
    `We noticed that ${alerts.length} of your ${cfg.noun}${plural} ${plural ? "have" : "has"} been ${cfg.intro} in the last ${days} days.`,
    ``,
    `${cfg.tone}`,
    ``,
    `Here are the details:`,
    ``,
  ];

  const sorted = [...alerts]
    .map(a => ({ alert: a, risk: assessRisk(a) }))
    .sort((a, b) => b.risk.score - a.risk.score);

  sorted.forEach(({ alert: c, risk }, i) => {
    const views = c.compare_views + c.competitor_views;
    lines.push(`${i + 1}. ${c.company}${c.domain ? ` (${c.domain})` : ""}`);
    lines.push(`   Risk Level: ${risk.level.toUpperCase()} | Product: ${c.product?.replace("WSO2 ", "") || "Unknown"} | Buying Stage: ${c.stage || "N/A"}`);
    lines.push(`   Activity: ${views} competitor page view${views !== 1 ? "s" : ""}, ${c.signals} competitive signal${c.signals !== 1 ? "s" : ""}`);
    lines.push(`   WSO2 engagement: ${c.also_viewing_wso2 ? "Yes — still comparing with WSO2 (positive signal)" : "No — viewing competitors only"}`);
    if (c.last_seen) lines.push(`   Last seen: ${new Date(c.last_seen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
    lines.push(``);
  });

  lines.push(`What we'd suggest:`);
  cfg.actions.forEach(a => lines.push(`- ${a}`));
  lines.push(``);
  lines.push(`Let us know if you need any competitive battlecards, talking points, or additional context for these conversations.`);
  lines.push(``);
  lines.push(`Best,`);
  lines.push(`WSO2 Marketing Intelligence`);
  lines.push(``);
  lines.push(`---`);
  lines.push(`Source: G2 Buyer Intent Signals via ISAC`);
  lines.push(`Full dashboard: ${window.location.origin}${isacPath(ISAC_SCREEN.g2Intelligence)}`);

  return lines.join("\n");
}

function openAlertDraftEmail(alerts: CompetitiveAlert[], days: number, category: AlertCategory) {
  const cfg = ALERT_EMAIL_CONFIG[category];
  const subject = `[ISAC Alert] ${alerts.length} WSO2 ${cfg.subjectTag}${alerts.length > 1 ? "s" : ""} — Competitor Activity Detected`;
  const body = buildAlertEmailDraft(alerts, days, category);
  const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// ── SVG Ring Gauge ──────────────────────────────────────────────────────────

function RingGauge({ pct, color, size = 120 }: { pct: number; color: string; size?: number }) {
  const sw = size < 60 ? 4 : 10;
  const r = (size - sw - 4) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.cardBg} strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${filled} ${circ - filled}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      {size >= 60 && (
        <>
          <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="central"
            fontFamily={F} fontSize={size * 0.22} fontWeight={700} fill={color}>{pct}%</text>
          <text x={size / 2} y={size / 2 + 14} textAnchor="middle" dominantBaseline="central"
            fontFamily={F} fontSize={size * 0.085} fontWeight={600} fill={C.sub}>also viewing WSO2</text>
        </>
      )}
    </svg>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

/** Section header with colored dot indicator and subtitle. */
function SectionHeader({ title, subtitle, color, count }: {
  title: string; subtitle: string; color: string; count?: number;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, boxShadow: `0 0 0 3px ${color}20` }} />
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>{title}</Typography>
          {count !== undefined && (
            <Chip label={count} size="small" sx={{
              height: 20, fontSize: FS.caption, fontWeight: FW.semibold, fontFamily: F,
              bgcolor: `${color}12`, color, borderRadius: "10px",
            }} />
          )}
        </Box>
        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, mt: 0.1 }}>{subtitle}</Typography>
      </Box>
    </Box>
  );
}

/** Single alert card — company evaluating competitors with computed risk level. */
function AlertCard({ alert, risk, maxIntensity }: {
  alert: CompetitiveAlert; risk: RiskAssessment; maxIntensity: number;
}) {
  const pct = intensityPct(alert.activity_intensity, maxIntensity);
  const rc = RISK_CONFIG[risk.level];

  return (
    <Box sx={{
      p: 1.5, borderRadius: "8px", bgcolor: C.panel,
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${rc.color}`,
      transition: "box-shadow 0.15s ease",
      "&:hover": { boxShadow: `0 2px 8px ${rc.color}20` },
    }}>
      {/* Row 1: Company + risk badge */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 0.75 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>{alert.company}</Typography>
          {alert.domain && <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>{alert.domain}</Typography>}
        </Box>
        <Tooltip title={risk.reasons.join(" · ") || "Minimal activity"} arrow>
          <Chip label={rc.label} size="small" sx={{
            height: 20, fontSize: FS.caption, fontWeight: FW.semibold, fontFamily: F,
            bgcolor: rc.bg, color: rc.color, borderRadius: "4px", cursor: "help",
            border: `1px solid ${rc.color}25`,
            ml: 1, flexShrink: 0,
          }} />
        </Tooltip>
      </Box>

      {/* Row 2: Signal factors */}
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 0.75 }}>
        {alert.stage && (
          <Chip label={alert.stage} size="small" sx={{
            height: 18, fontSize: FS.micro, fontWeight: FW.semibold, fontFamily: F,
            bgcolor: `${STAGE_COLOR[alert.stage] || C.dim}10`,
            color: STAGE_COLOR[alert.stage] || C.dim, borderRadius: "4px",
          }} />
        )}
        <Chip label={`${alert.compare_views + alert.competitor_views} views`} size="small" sx={{
          height: 18, fontSize: FS.micro, fontWeight: FW.semibold, fontFamily: F,
          bgcolor: C.cardBg, color: C.textMd, borderRadius: "4px",
        }} />
        {alert.signals > 0 && (
          <Chip label={`${alert.signals} signals`} size="small" sx={{
            height: 18, fontSize: FS.micro, fontWeight: FW.semibold, fontFamily: F,
            bgcolor: C.cardBg, color: C.textMd, borderRadius: "4px",
          }} />
        )}
        {alert.also_viewing_wso2 ? (
          <Chip label="Viewing WSO2" size="small" sx={{
            height: 18, fontSize: FS.micro, fontWeight: FW.semibold, fontFamily: F,
            bgcolor: `${C.wso2Too}10`, color: C.wso2Too, borderRadius: "4px",
          }} />
        ) : (alert.compare_views + alert.competitor_views) >= 2 ? (
          <Chip label="Not viewing WSO2" size="small" sx={{
            height: 18, fontSize: FS.micro, fontWeight: FW.semibold, fontFamily: F,
            bgcolor: `${C.churn}08`, color: C.churn, borderRadius: "4px",
          }} />
        ) : null}
      </Box>

      {/* Row 3: Activity bar */}
      <Box sx={{ mb: 0.75 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.35 }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub }}>
            {alert.product?.replace("WSO2 ", "") || "Unknown"}
          </Typography>
          <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim }}>
            intensity {alert.activity_intensity}
          </Typography>
        </Box>
        <Box sx={{ height: 4, borderRadius: 2, bgcolor: C.cardBg, overflow: "hidden" }}>
          <Box sx={{
            height: "100%", borderRadius: 2, width: `${Math.max(pct, 3)}%`,
            background: `linear-gradient(90deg, ${rc.color}, ${rc.color}88)`,
            transition: "width 0.4s ease",
          }} />
        </Box>
      </Box>

      {/* Row 4: Owner + last seen */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {alert.sf_owner ? (
          <Box sx={{
            display: "inline-flex", alignItems: "center", gap: 0.5,
            px: 0.75, py: 0.25, borderRadius: "4px",
            bgcolor: `${C.orange}08`, border: `1px solid ${C.orange}15`,
          }}>
            <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: C.orange, flexShrink: 0 }} />
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.textMd }}>
              <Box component="span" sx={{ color: C.sub, fontWeight: FW.medium }}>Owner </Box>
              <Box component="span" sx={{ fontWeight: FW.semibold, color: C.text }}>{alert.sf_owner}</Box>
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>No owner</Typography>
        )}
        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>{relativeDate(alert.last_seen)}</Typography>
      </Box>
    </Box>
  );
}

/** Metric stat card. */
function StatMetric({ label, value, color, urgent, detail, icon }: {
  label: string; value: number; color: string; urgent?: boolean; detail?: string; icon?: string;
}) {
  return (
    <Box sx={{
      flex: 1, p: 1.5, borderRadius: "8px", bgcolor: C.panel,
      border: `1px solid ${urgent ? color + "30" : C.border}`,
      borderLeft: `3px solid ${color}`,
      ...(urgent ? { bgcolor: `${color}04` } : {}),
    }}>
      {icon && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
          <Typography sx={{ fontSize: FS.title }}>{icon}</Typography>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</Typography>
        </Box>
      )}
      <Typography sx={{ fontFamily: F, fontSize: FS.kpi, fontWeight: FW.bold, color, lineHeight: 1.1 }}>
        {value.toLocaleString()}
      </Typography>
      {!icon && (
        <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.05em", mt: 0.3 }}>
          {label}
        </Typography>
      )}
      {detail && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.25 }}>{detail}</Typography>}
    </Box>
  );
}

/** Inline metric badge for the compact summary strip. */
function InlineBadge({ value, label, color, detail, pulse }: {
  value: number; label: string; color: string; detail?: string; pulse?: boolean;
}) {
  return (
    <Tooltip title={detail || `${value} ${label}`} arrow>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, cursor: "help" }}>
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minWidth: 28, height: 26, px: 0.75, borderRadius: "6px",
          bgcolor: `${color}${value > 0 ? "14" : "08"}`,
          border: `1.5px solid ${color}${value > 0 ? "35" : "15"}`,
          ...(pulse && value > 0 ? {
            animation: "pulse-border 2s ease-in-out infinite",
            "@keyframes pulse-border": {
              "0%, 100%": { borderColor: `${color}35` },
              "50%": { borderColor: `${color}80`, boxShadow: `0 0 8px ${color}25` },
            },
          } : {}),
        }}>
          <Typography sx={{
            fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold, color,
            lineHeight: 1,
          }}>
            {value}
          </Typography>
        </Box>
        <Typography sx={{
          fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.textMd,
          whiteSpace: "nowrap",
        }}>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}

/** Horizontal progress row for Signal Overview. */
function ProgressRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6 }}>
      <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd, minWidth: 100, fontWeight: FW.medium }}>{label}</Typography>
      <Box sx={{ flex: 1, height: 10, borderRadius: 5, bgcolor: C.cardBg, overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: 5, transition: "width 0.5s" }} />
      </Box>
      <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, minWidth: 40, textAlign: "right", fontWeight: FW.semibold }}>{value.toLocaleString()}</Typography>
    </Box>
  );
}

/** Recharts custom bar label. */
function BarLabel(props: Record<string, unknown>) {
  const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
  if (!value) return null;
  return (
    <text x={x + width + 6} y={y + height / 2} textAnchor="start" dominantBaseline="central"
      fontFamily={F} fontSize={10} fontWeight={600} fill={C.textMd}>{value.toLocaleString()}</text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: Signal Overview
// ═══════════════════════════════════════════════════════════════════════════

function SignalOverviewTab({ data, product }: { data: G2SignalAnalytics; product: string }) {
  const s = data.summary;
  const activeProduct = product || "All Products";
  const productCompetitors = product
    ? (COMPETITORS[product] || [])
    : Object.values(COMPETITORS).flat().filter((v, i, a) => a.findIndex(x => x.name === v.name) === i).slice(0, 8);

  const productSignalData = data.by_product.map(p => ({
    product: p.product.replace("WSO2 ", ""),
    "WSO2 Interest": p.wso2_interest,
    "Competitor Activity": p.competitor_views,
    "Category Browsing": p.category_views,
  }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1.5 }}>
        <StatMetric icon="🎯" label="WSO2 Direct Interest" value={s.wso2_interest.total} color={C.wso2}
          detail={`${s.wso2_interest.profile_views} profile + ${s.wso2_interest.pricing_views} pricing`} />
        <StatMetric icon="⚔️" label="Competitor Evaluations" value={s.competitor_activity.total} color={C.competitor}
          detail={`${s.competitor_activity.competitive_signals.toLocaleString()} competitive signals`} />
        <StatMetric icon="📂" label="Category Browsing" value={s.category_browsing.category_views} color={C.category}
          detail={`${s.category_browsing.total_pageviews.toLocaleString()} total pageviews`} />
        <StatMetric icon="🏢" label="Companies Tracked" value={s.unique_companies} color={C.orange}
          detail={`${s.decision_companies} decision + ${s.consideration_companies} consideration`} />
      </Box>

      {/* Signal trend over time */}
      <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text, mb: 1.5 }}>
          Signal Trends Over Time
        </Typography>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data.monthly_trend} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} />
            <XAxis dataKey="month" tick={{ fontFamily: F, fontSize: FS.micro, fill: C.sub }} />
            <YAxis tick={{ fontFamily: F, fontSize: FS.micro, fill: C.sub }} />
            <RTooltip contentStyle={{ fontFamily: F, fontSize: FS.small, borderRadius: 8, border: `1px solid ${C.border}` }} />
            <Legend wrapperStyle={{ fontFamily: F, fontSize: FS.caption }} />
            <Line type="monotone" dataKey="wso2_interest" stroke={C.wso2} strokeWidth={2.5} name="WSO2 Interest" dot={{ r: 4 }} />
            <Line type="monotone" dataKey="competitor_activity" stroke={C.competitor} strokeWidth={2.5} name="Competitor Eval." dot={{ r: 4 }} />
            <Line type="monotone" dataKey="category_browsing" stroke={C.category} strokeWidth={2.5} name="Category" dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* Three signal sections */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>

        {/* WSO2 Direct Interest */}
        <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
          <SectionHeader title="WSO2 G2 Page Interest" subtitle="Companies viewing our product profiles, pricing, and sponsored content" color={C.wso2} />
          <Box sx={{ mb: 2 }}>
            <ProgressRow label="Profile Views" value={s.wso2_interest.profile_views} max={s.wso2_interest.total} color={C.wso2} />
            <ProgressRow label="Pricing Views" value={s.wso2_interest.pricing_views} max={s.wso2_interest.total} color="#10b981" />
            <ProgressRow label="Sponsored" value={s.wso2_interest.sponsored_views} max={s.wso2_interest.total} color="#0d9488" />
          </Box>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>
            Top companies by WSO2 interest
          </Typography>
          {data.top_wso2_interest.slice(0, 8).map((c, i) => (
            <Box key={c.company} sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.4 }}>
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, minWidth: 14, textAlign: "right" }}>{i + 1}</Typography>
              <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.text, fontWeight: FW.medium, flex: 1 }}>{c.company}</Typography>
              <Chip label={c.views} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 18, fontWeight: FW.semibold, bgcolor: `${C.wso2}10`, color: C.wso2 }} />
            </Box>
          ))}
        </Box>

        {/* Competitor Activity */}
        <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
          <SectionHeader title="Competitor Evaluations" subtitle="Companies comparing WSO2 against alternatives on G2" color={C.competitor} />
          <Box sx={{ mb: 1.5 }}>
            <ProgressRow label="Comparisons" value={s.competitor_activity.comparison_views} max={s.competitor_activity.total} color={C.competitor} />
            <ProgressRow label="Competitor Pages" value={s.competitor_activity.competitor_views} max={s.competitor_activity.total} color="#ef4444" />
          </Box>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.5 }}>
            Known competitors ({activeProduct.replace("WSO2 ", "")})
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, mb: 1.5 }}>
            {productCompetitors.map(c => (
              <Chip key={c.name} label={c.name} size="small" variant="outlined"
                sx={{ fontFamily: F, fontSize: FS.caption, height: 20, fontWeight: FW.semibold, borderColor: `${C.competitor}30`, color: C.competitor }} />
            ))}
          </Box>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>
            Top companies evaluating alternatives
          </Typography>
          {data.top_competitor_activity.slice(0, 8).map((c, i) => (
            <Box key={c.company} sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.4 }}>
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, minWidth: 14, textAlign: "right" }}>{i + 1}</Typography>
              <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.text, fontWeight: FW.medium, flex: 1 }}>{c.company}</Typography>
              <Tooltip title={`${c.signals} competitive signals, ${c.competitor_views} page views`} arrow>
                <Chip label={c.signals} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 18, fontWeight: FW.semibold, bgcolor: `${C.competitor}10`, color: C.competitor, cursor: "help" }} />
              </Tooltip>
            </Box>
          ))}
        </Box>

        {/* Category & Buying Funnel */}
        <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
          <SectionHeader title="Category & Buying Funnel" subtitle="General category interest and buying stage progression" color={C.category} />
          <Box sx={{ mb: 1.5 }}>
            <ProgressRow label="Category Views" value={s.category_browsing.category_views} max={s.category_browsing.total_pageviews} color={C.category} />
            <ProgressRow label="Total Pageviews" value={s.category_browsing.total_pageviews} max={s.category_browsing.total_pageviews} color="#818cf8" />
          </Box>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>
            Buying stage funnel
          </Typography>
          <Box sx={{ mb: 1.5 }}>
            {[
              { label: "Decision", value: s.decision_companies, color: C.decision, tip: "Evaluating pricing, ready to buy" },
              { label: "Consideration", value: s.consideration_companies, color: C.consideration, tip: "Comparing solutions actively" },
              { label: "Awareness", value: s.awareness_companies, color: C.awareness, tip: "Browsing the category, early stage" },
            ].map(stage => (
              <Tooltip key={stage.label} title={stage.tip} arrow placement="right">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6, cursor: "help" }}>
                  <Chip label={stage.label} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, fontWeight: FW.semibold, bgcolor: `${stage.color}12`, color: stage.color, border: `1px solid ${stage.color}25`, minWidth: 90 }} />
                  <Box sx={{ flex: 1, height: 12, borderRadius: 6, bgcolor: C.cardBg, overflow: "hidden" }}>
                    <Box sx={{ width: `${Math.min((stage.value / s.unique_companies) * 100, 100)}%`, height: "100%", bgcolor: stage.color, borderRadius: 6, transition: "width 0.5s" }} />
                  </Box>
                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: stage.color, minWidth: 40, textAlign: "right" }}>{stage.value.toLocaleString()}</Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>
            Companies per product
          </Typography>
          {data.by_product.map(p => (
            <Box key={p.product} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.textMd, minWidth: 80 }}>{p.product.replace("WSO2 ", "")}</Typography>
              <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: C.cardBg, overflow: "hidden" }}>
                <Box sx={{ width: `${Math.min((p.unique_companies / s.unique_companies) * 100, 100)}%`, height: "100%", bgcolor: C.category, borderRadius: 4 }} />
              </Box>
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, minWidth: 35, textAlign: "right" }}>{p.unique_companies.toLocaleString()}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Signal distribution by product */}
      <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text, mb: 0.25 }}>
          Signal Distribution by Product
        </Typography>
        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, mb: 1.5 }}>
          Comparing WSO2 interest, competitor evaluations, and category browsing across products
        </Typography>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={productSignalData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} />
            <XAxis dataKey="product" tick={{ fontFamily: F, fontSize: FS.caption, fill: C.textMd }} />
            <YAxis tick={{ fontFamily: F, fontSize: FS.micro, fill: C.sub }} />
            <RTooltip contentStyle={{ fontFamily: F, fontSize: FS.small, borderRadius: 8, border: `1px solid ${C.border}` }} />
            <Legend wrapperStyle={{ fontFamily: F, fontSize: FS.caption }} />
            <Bar dataKey="WSO2 Interest" fill={C.wso2} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Competitor Activity" fill={C.competitor} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Category Browsing" fill={C.category} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Buying intent over time */}
      <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text, mb: 0.25 }}>
          Buying Intent Over Time
        </Typography>
        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, mb: 1.5 }}>
          Companies in decision and consideration stages per month
        </Typography>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.monthly_trend} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} />
            <XAxis dataKey="month" tick={{ fontFamily: F, fontSize: FS.micro, fill: C.sub }} />
            <YAxis tick={{ fontFamily: F, fontSize: FS.micro, fill: C.sub }} />
            <RTooltip contentStyle={{ fontFamily: F, fontSize: FS.small, borderRadius: 8, border: `1px solid ${C.border}` }} />
            <Legend wrapperStyle={{ fontFamily: F, fontSize: FS.caption }} />
            <Bar dataKey="decision" fill={C.decision} name="Decision" stackId="s" />
            <Bar dataKey="consideration" fill={C.consideration} name="Consideration" stackId="s" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: Competitive Intelligence
// ═══════════════════════════════════════════════════════════════════════════

function CompetitiveIntelTab({ days, product }: { days: number; product: string }) {
  const [unknownExpanded, setUnknownExpanded] = useState(false);

  const { data: alertsData, isLoading: alertsLoading } = useCompetitiveAlerts(days, product || undefined);
  const { data: trendsData } = useCompetitiveTrends(days, product || undefined);

  const alerts = useMemo(() => alertsData?.alerts ?? [], [alertsData]);
  const customers = alerts.filter((a) => a.is_customer);
  const prospects = alerts.filter((a) => a.is_prospect);
  const lost = alerts.filter((a) => a.is_lost);
  const unknown = alerts.filter((a) => !a.is_customer && !a.is_prospect && !a.is_lost);

  const maxIntensity = Math.max(...alerts.map((a) => a.activity_intensity), 1);

  const byProduct = trendsData?.by_product ?? [];
  const monthly = trendsData?.monthly_trend ?? [];
  const vsWso2 = trendsData?.competitor_vs_wso2 ?? { both_viewing: 0, competitor_only: 0, total: 0 };
  const wso2Pct = vsWso2.total > 0 ? Math.round((vsWso2.both_viewing / vsWso2.total) * 100) : 0;

  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach((a) => { if (a.stage) counts[a.stage] = (counts[a.stage] || 0) + 1; });
    return Object.entries(counts)
      .map(([stage, count]) => ({ stage, count, color: STAGE_COLOR[stage] || C.dim }))
      .sort((a, b) => b.count - a.count);
  }, [alerts]);

  const topCompanies = useMemo(() => {
    return [...alerts]
      .sort((a, b) => b.activity_intensity - a.activity_intensity)
      .slice(0, 8)
      .map((a) => {
        const co = a.company || "Unknown";
        return {
          name: co.length > 22 ? co.slice(0, 20) + "..." : co,
          intensity: a.activity_intensity,
          color: a.is_customer ? C.churn : a.is_lost ? C.winBack : a.is_prospect ? C.orange : C.blue,
        };
      });
  }, [alerts]);

  const wso2AlsoCount = alerts.filter((a) => a.also_viewing_wso2).length;
  const totalCompanies = alertsData?.total_companies ?? 0;
  const customerCount = alertsData?.customer_count ?? 0;
  const prospectCount = alertsData?.prospect_count ?? 0;
  const lostCount = alertsData?.lost_count ?? 0;

  if (alertsLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} sx={{ color: C.orange }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Compact metric strip ─────────────────────────────────────── */}
      <Box sx={{
        display: "flex", alignItems: "center", mb: 2, py: 1, px: 2,
        borderRadius: "10px", bgcolor: C.panel, border: `1px solid ${C.border}`,
        gap: 0, flexWrap: "nowrap", overflow: "hidden",
      }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.sub, mr: 1.5, flexShrink: 0, whiteSpace: "nowrap" }}>
          Last {days}d
        </Typography>
        <InlineBadge value={totalCompanies} label="evaluating" color={C.orange}
          detail={wso2AlsoCount > 0 ? `${wso2AlsoCount} also viewing WSO2` : undefined} />
        <Box sx={{ width: "1px", height: 20, bgcolor: C.border, mx: 1.25, flexShrink: 0 }} />
        <InlineBadge value={customerCount} label="churn risk" color={C.churn} pulse={customerCount > 0} />
        <Box sx={{ width: "1px", height: 20, bgcolor: C.border, mx: 1.25, flexShrink: 0 }} />
        <InlineBadge value={prospectCount} label="prospects" color={C.prospect} />
        <Box sx={{ width: "1px", height: 20, bgcolor: C.border, mx: 1.25, flexShrink: 0 }} />
        <InlineBadge value={lostCount} label="win-back" color={C.winBack} />
        <Box sx={{ flex: 1, minWidth: 16 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
          <RingGauge pct={wso2Pct} color={C.wso2Too} size={32} />
          <Box>
            <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.wso2Too, lineHeight: 1.2 }}>{wso2Pct}% also WSO2</Typography>
            <Typography noWrap sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim }}>{vsWso2.both_viewing} comparing / {vsWso2.competitor_only} competitor-only</Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Alert sections (HERO) ────────────────────────────────────── */}

      {/* Customer Churn Risk */}
      <Box sx={{ pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <SectionHeader title="Customer Churn Risk" subtitle="Existing customers browsing competitors — highest urgency" color={C.churn} count={customers.length} />
          {customers.length > 0 && (
            <Tooltip title="Draft an email alert with churn risk details" arrow>
              <Box
                role="button" tabIndex={0}
                onClick={() => openAlertDraftEmail(customers, days, "churn")}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAlertDraftEmail(customers, days, "churn"); } }}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5,
                  px: 1.25, py: 0.5, borderRadius: "6px", cursor: "pointer",
                  bgcolor: `${C.churn}08`, border: `1px solid ${C.churn}20`,
                  transition: "all 0.15s",
                  "&:hover": { bgcolor: `${C.churn}14`, borderColor: `${C.churn}35` },
                  "&:focus-visible": { outline: `2px solid ${C.churn}`, outlineOffset: 1 },
                  flexShrink: 0, ml: 1,
                }}
              >
                <MailOutlineIcon sx={{ fontSize: 14, color: C.churn }} />
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.churn, whiteSpace: "nowrap" }}>
                  Draft Alert Email
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>
        {customers.length === 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2, px: 2, borderRadius: "8px", bgcolor: `${C.wso2Too}06`, border: `1px solid ${C.wso2Too}20` }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 18, color: C.wso2Too }} />
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.wso2Too, fontWeight: FW.semibold }}>No customer churn signals detected in the last {days} days</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1 }}>
            {[...customers].map(a => ({ alert: a, risk: assessRisk(a) })).sort((a, b) => b.risk.score - a.risk.score).map(({ alert: a, risk }) => <AlertCard key={`${a.company}-${a.product}`} alert={a} risk={risk} maxIntensity={maxIntensity} />)}
          </Box>
        )}
      </Box>

      {/* Prospects */}
      <Box sx={{ pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <SectionHeader title="Prospects Evaluating Competitors" subtitle="Active prospects comparing WSO2 vs alternatives" color={C.prospect} count={prospects.length} />
          {prospects.length > 0 && (
            <Tooltip title="Draft an email alert with prospect risk details" arrow>
              <Box role="button" tabIndex={0}
                onClick={() => openAlertDraftEmail(prospects, days, "prospect")}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAlertDraftEmail(prospects, days, "prospect"); } }}
                sx={{
                display: "flex", alignItems: "center", gap: 0.5,
                px: 1.25, py: 0.5, borderRadius: "6px", cursor: "pointer",
                bgcolor: `${C.prospect}08`, border: `1px solid ${C.prospect}20`,
                transition: "all 0.15s",
                "&:hover": { bgcolor: `${C.prospect}14`, borderColor: `${C.prospect}35` },
                "&:focus-visible": { outline: `2px solid ${C.prospect}`, outlineOffset: 1 },
                flexShrink: 0, ml: 1,
              }}>
                <MailOutlineIcon sx={{ fontSize: 14, color: C.prospect }} />
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.prospect, whiteSpace: "nowrap" }}>Draft Alert Email</Typography>
              </Box>
            </Tooltip>
          )}
        </Box>
        {prospects.length === 0 ? (
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 2, textAlign: "center" }}>No prospect competitive activity in the last {days} days</Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1 }}>
            {[...prospects].map(a => ({ alert: a, risk: assessRisk(a) })).sort((a, b) => b.risk.score - a.risk.score).map(({ alert: a, risk }) => <AlertCard key={`${a.company}-${a.product}`} alert={a} risk={risk} maxIntensity={maxIntensity} />)}
          </Box>
        )}
      </Box>

      {/* Win-Back */}
      <Box sx={{ pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <SectionHeader title="Win-Back Opportunities" subtitle="Lost accounts back in market — potential win-back targets" color={C.winBack} count={lost.length} />
          {lost.length > 0 && (
            <Tooltip title="Draft an email alert with win-back opportunity details" arrow>
              <Box role="button" tabIndex={0}
                onClick={() => openAlertDraftEmail(lost, days, "winback")}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAlertDraftEmail(lost, days, "winback"); } }}
                sx={{
                display: "flex", alignItems: "center", gap: 0.5,
                px: 1.25, py: 0.5, borderRadius: "6px", cursor: "pointer",
                bgcolor: `${C.winBack}08`, border: `1px solid ${C.winBack}20`,
                transition: "all 0.15s",
                "&:hover": { bgcolor: `${C.winBack}14`, borderColor: `${C.winBack}35` },
                "&:focus-visible": { outline: `2px solid ${C.winBack}`, outlineOffset: 1 },
                flexShrink: 0, ml: 1,
              }}>
                <MailOutlineIcon sx={{ fontSize: 14, color: C.winBack }} />
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.winBack, whiteSpace: "nowrap" }}>Draft Alert Email</Typography>
              </Box>
            </Tooltip>
          )}
        </Box>
        {lost.length === 0 ? (
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 2, textAlign: "center" }}>No lost-account signals in the last {days} days</Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1 }}>
            {[...lost].map(a => ({ alert: a, risk: assessRisk(a) })).sort((a, b) => b.risk.score - a.risk.score).map(({ alert: a, risk }) => <AlertCard key={`${a.company}-${a.product}`} alert={a} risk={risk} maxIntensity={maxIntensity} />)}
          </Box>
        )}
      </Box>

      {/* Unknown companies */}
      {unknown.length > 0 && (
        <Box sx={{ pb: 2 }}>
          <Box role="button" tabIndex={0} aria-expanded={unknownExpanded}
            onClick={() => setUnknownExpanded((v) => !v)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setUnknownExpanded((v) => !v); } }}
            sx={{
            display: "flex", alignItems: "center", gap: 0.75, cursor: "pointer",
            py: 0.75, px: 1, borderRadius: "6px", "&:hover": { bgcolor: `${C.orange}06` },
            "&:focus-visible": { outline: `2px solid ${C.orange}`, outlineOffset: 1 },
          }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.sub }}>Other companies not in Salesforce</Typography>
            <Chip label={unknown.length} size="small" sx={{ height: 18, fontSize: FS.caption, fontWeight: FW.semibold, fontFamily: F, bgcolor: C.cardBg, color: C.sub, borderRadius: "9px" }} />
            {unknownExpanded ? <ExpandLessIcon sx={{ fontSize: 16, color: C.dim }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: C.dim }} />}
          </Box>
          <Collapse in={unknownExpanded} timeout="auto">
            <Box sx={{ mt: 1 }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontFamily: F }}>
                <Box component="thead">
                  <Box component="tr" sx={{ "& th": { ...LABEL, fontFamily: F, color: C.dim, pb: 0.75 } }}>
                    <Box component="th" sx={{ textAlign: "left" }}>Company</Box>
                    <Box component="th" sx={{ textAlign: "left", width: 130 }}>Product</Box>
                    <Box component="th" sx={{ width: 70, textAlign: "center" }}>Views</Box>
                    <Box component="th" sx={{ width: 70, textAlign: "center" }}>Signals</Box>
                    <Box component="th" sx={{ width: 60, textAlign: "center" }}>Stage</Box>
                    <Box component="th" sx={{ textAlign: "left", width: 50 }}>WSO2</Box>
                    <Box component="th" sx={{ width: 75, textAlign: "right" }}>Last Seen</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {unknown.slice(0, 50).map((a, i) => (
                    <Box key={`unk-${i}`} component="tr" sx={{
                      "& td": { fontFamily: F, fontSize: FS.small, color: C.textMd, py: 0.6 },
                      "&:not(:last-child) td": { borderBottom: `1px solid ${C.cardBg}` },
                      "&:hover td": { bgcolor: `${C.orange}03` },
                    }}>
                      <Box component="td">
                        <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text, maxWidth: 200 }}>{a.company}</Typography>
                        <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>{a.domain}</Typography>
                      </Box>
                      <Box component="td" sx={{ fontSize: FS.small }}>{a.product?.replace("WSO2 ", "")}</Box>
                      <Box component="td" sx={{ textAlign: "center" }}>{a.compare_views + a.competitor_views}</Box>
                      <Box component="td" sx={{ textAlign: "center" }}>{a.signals}</Box>
                      <Box component="td" sx={{ textAlign: "center" }}>
                        {a.stage ? (
                          <Box component="span" sx={{ fontSize: FS.micro, px: 0.5, py: 0.15, borderRadius: "3px", fontWeight: FW.semibold, bgcolor: `${STAGE_COLOR[a.stage] || C.dim}12`, color: STAGE_COLOR[a.stage] || C.dim }}>{a.stage}</Box>
                        ) : "--"}
                      </Box>
                      <Box component="td">
                        {a.also_viewing_wso2 ? (
                          <Box component="span" sx={{ fontSize: FS.micro, px: 0.4, py: 0.1, borderRadius: "3px", fontWeight: FW.semibold, bgcolor: `${C.wso2Too}12`, color: C.wso2Too }}>Yes</Box>
                        ) : <Box component="span" sx={{ color: C.dim, fontSize: FS.caption }}>--</Box>}
                      </Box>
                      <Box component="td" sx={{ textAlign: "right", fontSize: FS.caption, color: C.dim }}>{relativeDate(a.last_seen)}</Box>
                    </Box>
                  ))}
                </Box>
              </Box>
              {unknown.length > 50 && (
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 1, textAlign: "center" }}>+ {unknown.length - 50} more</Typography>
              )}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* ── Landscape Analysis ────────────────────────────────────────── */}
      <Box sx={{ borderTop: `1px solid ${C.border}`, pt: 1.5 }}>
        <Typography sx={{
          fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.sub,
          textTransform: "uppercase", letterSpacing: "0.07em", mb: 1.5, px: 1,
        }}>
          Landscape Analysis
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

            {/* Row 1: Product pressure | Buying stage */}
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Box sx={{ flex: 1.4, p: 2, borderRadius: "10px", bgcolor: C.panel, border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text, mb: 0.25 }}>Competitor Pressure by Product</Typography>
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mb: 1.5 }}>Comparison + competitor page views per product</Typography>
                {byProduct.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: "center" }}><Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>No data</Typography></Box>
                ) : (
                  <ResponsiveContainer width="100%" height={byProduct.length * 52 + 30}>
                    <BarChart data={byProduct.map((p) => ({
                      ...p, name: p.product?.replace("WSO2 ", "").replace(" Platform", "") || "?",
                    }))} layout="vertical" margin={{ left: 0, right: 50, top: 0, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} horizontal={false} />
                      <XAxis type="number" tick={{ fontFamily: F, fontSize: FS.micro, fill: C.dim }} axisLine={{ stroke: C.borderSoft }} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, fill: C.textMd }} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ fontFamily: F, fontSize: FS.caption, borderRadius: 8, border: `1px solid ${C.border}` }} formatter={(v, name) => [Number(v).toLocaleString(), name]} cursor={{ fill: `${C.orange}06` }} />
                      <Bar dataKey="comparison_views" stackId="a" fill={C.amber} name="Comparison views" />
                      <Bar dataKey="competitor_views" stackId="a" fill={C.churn} name="Competitor views" radius={[0, 4, 4, 0]} label={<BarLabel />} />
                      <Legend wrapperStyle={{ fontFamily: F, fontSize: FS.micro, paddingTop: 8 }} iconType="square" iconSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Box>

              <Box sx={{ flex: 0.8, p: 2, borderRadius: "10px", bgcolor: C.panel, border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text, mb: 0.25 }}>Buying Stage</Typography>
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mb: 1.5 }}>Where competitors are in the funnel</Typography>
                {stageData.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: "center" }}><Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>No data</Typography></Box>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                    {stageData.map((s) => {
                      const maxStage = Math.max(...stageData.map((d) => d.count), 1);
                      return (
                        <Box key={s.stage}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: s.color }} />
                              <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.textMd, textTransform: "capitalize" }}>{s.stage}</Typography>
                            </Box>
                            <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: s.color }}>{s.count}</Typography>
                          </Box>
                          <Box sx={{ height: 8, borderRadius: 4, bgcolor: C.cardBg, overflow: "hidden" }}>
                            <Box sx={{ height: "100%", borderRadius: 4, width: `${Math.max((s.count / maxStage) * 100, 4)}%`, bgcolor: s.color, opacity: 0.8, transition: "width 0.5s ease" }} />
                          </Box>
                        </Box>
                      );
                    })}
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.5 }}>{alerts.length} companies across {stageData.length} stages</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Row 2: Timeline + Top active */}
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Box sx={{ flex: 1.6, p: 2, borderRadius: "10px", bgcolor: C.panel, border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text, mb: 0.25 }}>Competitive Activity Timeline</Typography>
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mb: 1.5 }}>Monthly trend of competitor page views and WSO2 engagement</Typography>
                {monthly.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: "center" }}><Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>No data</Typography></Box>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={monthly.map((m) => ({ ...m, label: fmtMonth(m.month), total: m.competitor_views + m.comparison_views }))} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradComp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.churn} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={C.churn} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradW" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.wso2Too} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={C.wso2Too} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} />
                      <XAxis dataKey="label" tick={{ fontFamily: F, fontSize: FS.micro, fill: C.sub }} axisLine={{ stroke: C.borderSoft }} tickLine={false} />
                      <YAxis tick={{ fontFamily: F, fontSize: FS.micro, fill: C.dim }} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ fontFamily: F, fontSize: FS.caption, borderRadius: 8, border: `1px solid ${C.border}` }} />
                      <Legend wrapperStyle={{ fontFamily: F, fontSize: FS.micro, paddingTop: 6 }} iconType="plainline" iconSize={16} />
                      <Area type="monotone" dataKey="total" name="Competitor activity" stroke={C.churn} strokeWidth={2.5} fill="url(#gradComp)" dot={{ r: 4, fill: C.panel, stroke: C.churn, strokeWidth: 2 }} activeDot={{ r: 6, fill: C.churn }} />
                      <Area type="monotone" dataKey="wso2_also_count" name="Also viewing WSO2" stroke={C.wso2Too} strokeWidth={2} fill="url(#gradW)" dot={{ r: 3, fill: C.panel, stroke: C.wso2Too, strokeWidth: 2 }} activeDot={{ r: 5, fill: C.wso2Too }} />
                      <Area type="monotone" dataKey="companies" name="Unique companies" stroke={C.blue} strokeWidth={1.5} fill="none" dot={{ r: 2, fill: C.blue }} strokeDasharray="4 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Box>

              <Box sx={{ flex: 0.9, p: 2, borderRadius: "10px", bgcolor: C.panel, border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text, mb: 0.25 }}>Most Active Companies</Typography>
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mb: 1.5 }}>Ranked by competitive activity intensity</Typography>
                {topCompanies.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: "center" }}><Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>No data</Typography></Box>
                ) : (
                  <ResponsiveContainer width="100%" height={topCompanies.length * 30 + 10}>
                    <BarChart data={topCompanies} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }} barCategoryGap="20%">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontFamily: F, fontSize: FS.micro, fill: C.textMd }} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ fontFamily: F, fontSize: FS.caption, borderRadius: 8, border: `1px solid ${C.border}` }} formatter={(v) => [`${v} intensity`, "Activity"]} cursor={{ fill: `${C.orange}06` }} />
                      <Bar dataKey="intensity" radius={[0, 4, 4, 0]} label={<BarLabel />}>
                        {topCompanies.map((c, i) => <Cell key={i} fill={c.color} fillOpacity={0.75} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap" }}>
                  {[{ label: "Customer", color: C.churn }, { label: "Win-back", color: C.winBack }, { label: "Prospect", color: C.orange }, { label: "Unknown", color: C.blue }].map((l) => (
                    <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: "2px", bgcolor: l.color, opacity: 0.75 }} />
                      <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim }}>{l.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

/** Competitive Intelligence page — unified G2 signal analytics and competitive intelligence with tabbed navigation. */
export default function CompetitiveIntelligence() {
  const [tab, setTab] = useState<TabId>("competitive");
  const [days, setDays] = useState(30);
  const [product, setProduct] = useState("");

  const { data: analyticsData, isLoading: analyticsLoading } = useG2SignalAnalytics(product || undefined, tab === "overview");

  return (
    <Box sx={{
      fontFamily: F, bgcolor: C.bg, minHeight: "100%",
      overflow: "hidden",
    }}>
      {/* Accent stripe */}
      <Box sx={{ height: 3, background: `linear-gradient(90deg, ${C.churn}, ${C.orange} 50%, ${C.winBack})` }} />

      {/* Header */}
      <Box sx={{
        px: 2.5, pt: 2, pb: 1.5, bgcolor: C.panel,
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      }}>
        <Box>
          <Typography sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color: C.text, mb: 0.25 }}>
            G2 Intelligence
          </Typography>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, lineHeight: 1.5 }}>
            {tab === "overview"
              ? "How companies interact with WSO2, competitors, and the category on G2"
              : "Companies evaluating competitors — prioritized by churn risk"}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0, ml: 3 }}>
          <Select
            value={product} onChange={(e) => setProduct(e.target.value)}
            variant="standard" disableUnderline displayEmpty
            sx={{
              fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text,
              "& .MuiSelect-icon": { color: C.dim, fontSize: 15 },
              "& .MuiSelect-select": { pr: "18px !important", py: 0 },
            }}
            MenuProps={{ PaperProps: { sx: { bgcolor: C.panel, fontFamily: F, borderRadius: "8px", border: `1px solid ${C.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" } } }}
          >
            {PRODUCTS.map((p) => (
              <MenuItem key={p.value} value={p.value} sx={{ fontFamily: F, fontSize: FS.small }}>{p.label}</MenuItem>
            ))}
          </Select>

          {tab === "competitive" && (
            <Box sx={{ display: "flex", gap: 0.25, bgcolor: C.cardBg, borderRadius: "6px", p: 0.25 }} role="group" aria-label="Time window">
              {TIME_WINDOWS.map((d) => (
                <Box key={d} role="button" tabIndex={0} onClick={() => setDays(d)}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDays(d); } }}
                  aria-pressed={days === d}
                  sx={{
                  px: 1, py: 0.35, borderRadius: "5px", cursor: "pointer",
                  fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold,
                  color: days === d ? "#fff" : C.sub,
                  bgcolor: days === d ? C.orange : "transparent",
                  transition: "all 0.12s ease",
                  "&:hover": { bgcolor: days === d ? C.orange : `${C.orange}10` },
                  "&:focus-visible": { outline: `2px solid ${C.orange}`, outlineOffset: 1 },
                }}>
                  {d}d
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Tab switcher */}
      <Box sx={{ px: 2.5, pt: 1.25, pb: 0, bgcolor: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <Box sx={{ display: "flex", gap: 0.5 }} role="tablist">
          {([
            { id: "competitive" as TabId, label: "Competitive Intel" },
            { id: "overview" as TabId, label: "Signal Overview" },
          ]).map(t => (
            <Box key={t.id} id={`tab-${t.id}`} role="tab" tabIndex={0} aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              onClick={() => setTab(t.id)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(t.id); } }}
              sx={{
              px: 1.5, py: 0.6, borderRadius: "6px 6px 0 0", cursor: "pointer",
              fontFamily: F, fontSize: FS.small, fontWeight: tab === t.id ? FW.semibold : FW.medium,
              color: tab === t.id ? C.orange : C.sub,
              bgcolor: tab === t.id ? `${C.orange}08` : "transparent",
              borderBottom: tab === t.id ? `2px solid ${C.orange}` : "2px solid transparent",
              transition: "all 0.1s", "&:hover": { bgcolor: `${C.orange}05` },
              "&:focus-visible": { outline: `2px solid ${C.orange}`, outlineOffset: -2 },
            }}>
              {t.label}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Tab content */}
      <Box role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} sx={{ px: 2.5, pt: 2, pb: 2 }}>
        {tab === "overview" && (
          analyticsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
              <CircularProgress size={24} sx={{ color: C.orange }} />
            </Box>
          ) : analyticsData ? (
            <SignalOverviewTab data={analyticsData} product={product} />
          ) : (
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub, textAlign: "center", py: 8 }}>
              Failed to load signal analytics — please refresh.
            </Typography>
          )
        )}

        {tab === "competitive" && (
          <CompetitiveIntelTab days={days} product={product} />
        )}
      </Box>
    </Box>
  );
}
