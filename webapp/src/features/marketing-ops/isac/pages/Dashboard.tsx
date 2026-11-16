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

import { CalendarMonthOutlined as CalendarMonthOutlinedIcon } from "../icons";
import { NotificationsNone as NotificationsNoneIcon } from "../icons";
import { Box, MenuItem, Tooltip, Typography } from "@wso2/oxygen-ui";
import { useState } from "react";
import { useNavigate } from "react-router";
import { CMOTopAccount, FollowedCompany, TrendMonthData } from "../api/client";
import { useDashboardQuery, useMyFollows, useTrendsQuery } from "../api/queries";
import { FilterPill, PillSelect, pillItemSx } from "../components/FilterPills";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL, ROW } from "../theme/typeScale";
import { isacPath } from "../paths";

// ── Design tokens ───────────────────────────────────────────────────────────

// ── Helpers ─────────────────────────────────────────────────────────────────

const tierColor: Record<string, string> = { hot: C.red, warm: C.amber, get cold() { return C.sub; } };
const stageColor: Record<string, string> = { awareness: C.blue, consideration: C.amber, decision: C.green };
function intentColor(score: number): string { if (score >= 40) return C.red; if (score >= 15) return C.amber; return C.dim; }
function relativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const n = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${n[parseInt(mo, 10) - 1]} ${y}`;
}

// Funnel stages, highest priority first — labels, colours and actions mirror the
// Companies page PIPELINE map so a stage reads the same everywhere.
const FUNNEL_ORDER = ["activate", "pursue", "research", "engage", "known", "unqualified", "restricted"];
const FUNNEL_META: Record<string, { label: string; color: string; action: string }> = {
  activate:    { label: "Activate",    color: C.red,   action: "Assign to SDR" },
  pursue:      { label: "Pursue",      get color() { return C.orange; }, action: "Personalized outreach" },
  research:    { label: "Research",    color: C.amber, action: "Targeted ads" },
  engage:      { label: "Engage",      color: C.blue,  action: "Nurture content" },
  known:       { label: "Known",       color: C.slate, action: "Brand presence" },
  unqualified: { label: "Unqualified", get color() { return C.dim; }, action: "Exclude" },
  restricted:  { label: "Restricted",  get color() { return C.sub; }, action: "Lost / churned" },
};
function fmtDay(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Stage chip — tinted background, stage-coloured text (as on the Companies page). */
function StageChip({ stage }: { stage: string | null }) {
  if (!stage) return <Box component="span" sx={{ color: C.dim, fontSize: FS.small }}>--</Box>;
  const m = FUNNEL_META[stage] ?? { label: stage, color: C.dim, action: "" };
  return (
    <Tooltip title={m.action ? `${m.label} — ${m.action}` : m.label} arrow placement="top">
      <Box component="span" sx={{
        fontSize: FS.caption, px: 0.75, py: 0.2, borderRadius: "3px", fontWeight: FW.semibold, cursor: "help",
        bgcolor: `${m.color}14`, color: m.color, whiteSpace: "nowrap",
      }}>{m.label}</Box>
    </Tooltip>
  );
}

/** "Accounts you follow" — the caller's followed companies with their current stage,
 * last stage move, intent and heat. Followers are emailed when a stage moves up. */
function FollowedAccounts() {
  const navigate = useNavigate();
  const { data: follows, isLoading, isError, refetch } = useMyFollows();

  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 1.5, bgcolor: C.panel, borderBottom: `1px solid ${C.border}` }}>
      <SectionHead right={follows && follows.length > 0 ? (
        <Typography onClick={() => navigate(isacPath("/companies?following=1"))}
          sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.orange, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
          Manage &rarr;
        </Typography>
      ) : undefined}>Accounts you follow{follows && follows.length > 0 ? ` \u00b7 ${follows.length}` : ""}</SectionHead>

      {isLoading ? (
        <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 2, textAlign: "center" }}>Loading…</Typography>
      ) : isError ? (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, py: 2 }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.red }}>Couldn&apos;t load the accounts you follow.</Typography>
          <Typography onClick={() => refetch()} sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.orange, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>Retry</Typography>
        </Box>
      ) : !follows || follows.length === 0 ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, borderRadius: "8px", bgcolor: C.card, border: `1px dashed ${C.border}` }}>
          <NotificationsNoneIcon sx={{ fontSize: 22, color: C.orange }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>You aren&apos;t following any accounts yet</Typography>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
              Interested in an account? Open it and click <b>Follow</b>. It will show up here with its stage, and you&apos;ll get an email when its stage moves up.
            </Typography>
          </Box>
          <Typography onClick={() => navigate(isacPath("/companies"))}
            sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.orange, cursor: "pointer", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
            Browse companies &rarr;
          </Typography>
        </Box>
      ) : (
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontFamily: F }}>
          <Box component="thead">
            <Box component="tr" sx={{ "& th": { ...LABEL, fontFamily: F, color: C.dim, pb: 0.75 } }}>
              <Box component="th" sx={{ textAlign: "left" }}>Company</Box>
              <Box component="th" sx={{ textAlign: "left", width: 110 }}>Stage</Box>
              <Tooltip title="The account's most recent funnel-stage move. Upward moves trigger the follow email." arrow placement="top">
                <Box component="th" sx={{ textAlign: "left", width: 190, cursor: "help" }}>Last move</Box>
              </Tooltip>
              <Tooltip title="Intent Score — How likely they are to buy. Based on G2 pricing/comparison views, LinkedIn ad clicks, and certification activity." arrow placement="top">
                <Box component="th" sx={{ width: 55, textAlign: "center", cursor: "help" }}>INT</Box>
              </Tooltip>
              <Box component="th" sx={{ textAlign: "left" }}>Industry</Box>
              <Box component="th" sx={{ textAlign: "right", width: 80 }}>Followed</Box>
            </Box>
          </Box>
          <Box component="tbody">
            {follows.map((f: FollowedCompany) => {
              const up = f.previous_stage && f.funnel_stage
                ? FUNNEL_ORDER.indexOf(f.funnel_stage) < FUNNEL_ORDER.indexOf(f.previous_stage) : null;
              return (
                <Box key={f.company_id} component="tr" sx={{
                  "& td": { fontFamily: F, ...ROW.cell, color: C.textMd, py: 0.8 },
                  "&:not(:last-child) td": { borderBottom: `1px solid ${C.card}` },
                  "&:hover td": { bgcolor: `${C.orange}03` },
                }}>
                  <Box component="td" onClick={() => navigate(isacPath(`/companies/${f.company_id}`))}
                    sx={{ borderLeft: `3px solid ${tierColor[f.heat_tier ?? ""] || C.dim}`, pl: 1.25, cursor: "pointer", ...ROW.primary, color: C.text, "&:hover": { color: C.orange } }}>
                    {f.canonical_name}
                  </Box>
                  <Box component="td"><StageChip stage={f.funnel_stage} /></Box>
                  <Box component="td" sx={{ fontSize: FS.small, color: C.sub, whiteSpace: "nowrap" }}>
                    {f.previous_stage && f.stage_changed_on ? (
                      <>
                        <Box component="span" sx={{ color: up ? C.green : C.red, fontWeight: FW.semibold, mr: 0.5 }}>{up ? "\u25B2" : "\u25BC"}</Box>
                        {FUNNEL_META[f.previous_stage]?.label ?? f.previous_stage} &rarr; {FUNNEL_META[f.funnel_stage ?? ""]?.label ?? f.funnel_stage}
                        <Box component="span" sx={{ color: C.dim }}> &middot; {fmtDay(f.stage_changed_on)}</Box>
                      </>
                    ) : <Box component="span" sx={{ color: C.dim }}>No recent move</Box>}
                  </Box>
                  <Box component="td" sx={{ textAlign: "center", ...ROW.number, color: intentColor(f.intent_score ?? 0) }}>
                    {f.intent_score ?? "--"}
                  </Box>
                  <Box component="td" sx={{ fontSize: FS.small, color: C.sub, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.industry || "--"}
                  </Box>
                  <Box component="td" sx={{ textAlign: "right", fontSize: FS.small, color: C.dim, whiteSpace: "nowrap" }}>
                    {relativeTime(f.followed_at ?? undefined) || "--"}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Section label ───────────────────────────────────────────────────────────

function SectionHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
      <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, textTransform: "uppercase", letterSpacing: "0.09em" }}>
        {children}
      </Typography>
      {right}
    </Box>
  );
}

// ── FlowingFunnel SVG ───────────────────────────────────────────────────────

/** A stage's `value` is null while its data is unavailable (loading or failed):
 * it renders as a placeholder, never as a zero a reader could mistake for real. */
function FlowingFunnel({ stages, onStageClick }: {
  stages: { label: string; value: number | null; sub?: string; color: string; clickable?: boolean }[];
  onStageClick?: (index: number) => void;
}) {
  const W = 960;
  const H = 200;
  const padTop = 48;
  const padBot = 16;
  const chartH = H - padTop - padBot;
  const maxVal = Math.max(...stages.map((s) => s.value ?? 0), 1);
  const centerY = padTop + chartH / 2;
  const rawH = stages.map((s) => (s.value === null ? 0.5 : Math.sqrt(s.value / maxVal)));
  const minH = chartH * 0.14;
  const maxH = chartH * 0.9;
  const heights = rawH.map((r) => minH + r * (maxH - minH));
  const secW = W / stages.length;
  const pts: { x: number; tY: number; bY: number }[] = [];
  for (let i = 0; i < stages.length; i++) {
    const h = heights[i];
    const nH = i < stages.length - 1 ? heights[i + 1] : h * 0.65;
    const x0 = i * secW;
    if (i === 0) pts.push({ x: x0, tY: centerY - h / 2, bY: centerY + h / 2 });
    pts.push({ x: x0 + secW * 0.4, tY: centerY - h / 2, bY: centerY + h / 2 });
    pts.push({ x: x0 + secW * 0.82, tY: centerY - (h + nH) / 4, bY: centerY + (h + nH) / 4 });
    pts.push({ x: x0 + secW, tY: centerY - nH / 2, bY: centerY + nH / 2 });
  }
  function bz(p: { x: number; y: number }[]): string {
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i = 1; i < p.length; i++) {
      const cp = (p[i - 1].x + p[i].x) / 2;
      d += ` C ${cp} ${p[i - 1].y}, ${cp} ${p[i].y}, ${p[i].x} ${p[i].y}`;
    }
    return d;
  }
  const topD = bz(pts.map((p) => ({ x: p.x, y: p.tY })));
  const botD = bz([...pts].reverse().map((p) => ({ x: p.x, y: p.bY })));
  const last = pts[pts.length - 1];
  const shape = `${topD} L ${last.x} ${last.bY} ${botD.replace("M", "L")} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="fg" x1="0" y1="0" x2="1" y2="0">
          {stages.map((s, i) => (
            <stop key={i} offset={`${(i / Math.max(stages.length - 1, 1)) * 100}%`} stopColor={s.color} stopOpacity={0.25} />
          ))}
        </linearGradient>
        <linearGradient id="fg-hi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`${C.text}08`} />
          <stop offset="100%" stopColor={`${C.text}00`} />
        </linearGradient>
      </defs>
      <path d={shape} fill="url(#fg)" />
      <path d={`${topD} L ${last.x} ${centerY} L ${pts[0].x} ${centerY} Z`} fill="url(#fg-hi)" />
      {stages.slice(1).map((_, i) => {
        const x = (i + 1) * secW;
        return <line key={i} x1={x} y1={padTop - 4} x2={x} y2={H - padBot + 4} stroke={C.border} strokeWidth={0.5} />;
      })}
      {stages.map((s, i) => {
        const lx = i * secW + 16;
        const click = s.clickable && onStageClick ? () => onStageClick(i) : undefined;
        return (
          <g key={s.label} onClick={click} style={click ? { cursor: "pointer" } : undefined}>
            <text x={lx} y={18} fill={s.value === null ? C.dim : C.text} fontSize={20} fontWeight={700} fontFamily={F} letterSpacing="-0.5"
              textDecoration={click ? "underline" : undefined}>{s.value === null ? "\u2014" : s.value.toLocaleString()}</text>
            <text x={lx} y={34} fill={s.color} fontSize={9.5} fontWeight={700} fontFamily={F} letterSpacing="0.4">{s.label}</text>
            {s.sub && <text x={lx} y={46} fill={C.sub} fontSize={8.5} fontWeight={400} fontFamily={F}>{s.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal bar ──────────────────────────────────────────────────────────

function HBar({ label, value, pct, color, suffix }: {
  label: string; value: number; pct: number; color: string; suffix?: string;
}) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.35 }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.textMd }}>{label}</Typography>
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          {value.toLocaleString()}{suffix || ""}
        </Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: C.card, overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${Math.max(pct, 1)}%`, borderRadius: 3, bgcolor: color, transition: "width 0.4s ease" }} />
      </Box>
    </Box>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

/** CMO dashboard -- KPIs, pipeline funnel, signal trajectory, and real-time signal feed. */
export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardQuery();
  // The funnel reads /trends/overview, which resolves independently of /dashboard —
  // gate the funnel on its own query rather than holding the whole page behind it.
  const { data: trends, isLoading: trendsLoading, isError: trendsError, refetch: refetchTrends } = useTrendsQuery();
  // Only ever holds a user's pick; the default (latest month) is derived during render.
  const [selMonth, setSelMonth] = useState("");

  if (isLoading || !data) {
    return <Box sx={{ textAlign: "center", fontFamily: F, color: C.sub, py: 10 }}>Loading...</Box>;
  }

  const { command_stats: cs, top_accounts, heat_tier_counts, source_coverage, signal_feed } = data;
  const heatTotal = heat_tier_counts.hot + heat_tier_counts.warm + heat_tier_counts.cold || 1;

  // Funnel — selected month with MoM deltas
  const months = trends?.months ?? [];
  const effMonth = selMonth || months[months.length - 1]?.month || "";
  const curIdx = months.findIndex((m) => m.month === effMonth);
  const cur: TrendMonthData | null = curIdx >= 0 ? months[curIdx] : (months.length ? months[months.length - 1] : null);
  const prev: TrendMonthData | null = curIdx > 0 ? months[curIdx - 1] : null;
  const intentPct = cur && cur.aware_companies > 0 ? ((cur.intent_companies / cur.aware_companies) * 100).toFixed(1) + "% of reach" : "";
  const qualPct = cur && cur.intent_companies > 0 ? ((cur.overlap_companies / cur.intent_companies) * 100).toFixed(0) + "% qualified" : "";
  const fmtDelta = (c: number, p: number) => {
    const d = c - p;
    return `${d >= 0 ? "+" : ""}${d.toLocaleString()} vs prev`;
  };

  // A zero is shown only when trends returned and the month's value really is zero.
  // No data yet (loading) or none at all (failed) renders a placeholder, never `?? 0`;
  // a failed background refetch keeps showing the data already on screen.
  const trendsReady = !!trends;
  const stageValue = (v: number | undefined) => (trendsReady ? v ?? 0 : null);
  const pendingSub = trendsReady || trendsError ? undefined : "Loading\u2026";
  const funnelStages = [
    { label: "TOTAL REACH", value: stageValue(cur?.aware_companies), sub: pendingSub ?? (prev ? fmtDelta(cur!.aware_companies, prev.aware_companies) : undefined), color: C.orange },
    { label: "SHOWING INTENT", value: stageValue(cur?.intent_companies), sub: pendingSub ?? (intentPct || (prev ? fmtDelta(cur!.intent_companies, prev.intent_companies) : undefined)), color: C.pink },
    { label: "QUALIFIED", value: stageValue(cur?.overlap_companies), sub: pendingSub ?? (qualPct || (prev ? fmtDelta(cur!.overlap_companies, prev.overlap_companies) : undefined)), color: C.blue },
  ];

  const srcMax = Math.max(source_coverage.g2_companies, source_coverage.linkedin_companies, source_coverage.pardot_companies, source_coverage.cert_companies, 1);

  return (
    <Box sx={{ fontFamily: F, bgcolor: C.bg, minHeight: "100%", overflow: "hidden" }}>

      {/* ── Accent stripe ─────────────────────────────────────────────── */}
      <Box sx={{ height: 3, background: `linear-gradient(90deg, ${C.orange}, ${C.pink} 50%, ${C.blue})` }} />

      {/* ── Header description ────────────────────────────────────────── */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.25, bgcolor: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color: C.text, mb: 0.25 }}>
          Marketing Intelligence Dashboard
        </Typography>
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, lineHeight: 1.5 }}>
          Real-time overview of your marketing pipeline health. Track how companies move through the buying journey — from initial reach through intent signals to qualified accounts. Data aggregated from G2 Buyer Intent, LinkedIn Ads, Pardot Leads, Salesforce CRM, and Certifications.
        </Typography>
      </Box>

      {/* ── Funnel ────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: C.panel, px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${C.border}` }}>
        <SectionHead right={
          months.length > 1 ? (
            // Same boxed pill as the page filters elsewhere, not a bare text select.
            <FilterPill icon={CalendarMonthOutlinedIcon} active={false}>
              <PillSelect value={effMonth} onChange={setSelMonth} placeholder="Month" renderLabel={fmtMonth}>
                {[...months].reverse().map((m) => <MenuItem key={m.month} value={m.month} sx={pillItemSx}>{fmtMonth(m.month)}</MenuItem>)}
              </PillSelect>
            </FilterPill>
          ) : undefined
        }>Marketing Funnel {effMonth ? `\u2014 ${fmtMonth(effMonth)}` : ""}</SectionHead>
        {trendsError && !trendsReady && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.red }}>
              Couldn&apos;t load funnel data.
            </Typography>
            <Typography onClick={() => refetchTrends()}
              sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.orange, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
              Retry
            </Typography>
          </Box>
        )}
        <Box sx={trendsLoading ? {
          "@keyframes funnelPulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.45 } },
          animation: "funnelPulse 1.4s ease-in-out infinite",
        } : undefined}>
          <FlowingFunnel stages={funnelStages} />
        </Box>
      </Box>

      {/* ── Accounts you follow ───────────────────────────────────────── */}
      <FollowedAccounts />

      {/* ── Act Now ───────────────────────────────────────────────────── */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5, bgcolor: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <SectionHead right={
          <Typography onClick={() => navigate(isacPath("/companies"))}
            sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.orange, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
            View all &rarr;
          </Typography>
        }>Act Now &middot; Top 10 by Intent</SectionHead>

        {top_accounts.length === 0 ? (
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 3, textAlign: "center" }}>No scored accounts yet</Typography>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontFamily: F }}>
            <Box component="thead">
              <Box component="tr" sx={{ "& th": { ...LABEL, fontFamily: F, color: C.dim, pb: 0.75 } }}>
                <Box component="th" sx={{ textAlign: "left" }}>Company</Box>
                <Tooltip title="Intent Score — How likely they are to buy. Based on G2 pricing/comparison views, LinkedIn ad clicks, and certification activity." arrow placement="top"><Box component="th" sx={{ width: 55, textAlign: "center", cursor: "help" }}>INT</Box></Tooltip>
                <Tooltip title="Awareness Score — How well they know WSO2. Based on Salesforce accounts, Pardot leads, LinkedIn impressions, and cross-source presence." arrow placement="top"><Box component="th" sx={{ width: 55, textAlign: "center", cursor: "help" }}>AWR</Box></Tooltip>
                <Box component="th" sx={{ textAlign: "left", width: 85 }}>Stage</Box>
                <Box component="th" sx={{ textAlign: "left", width: 95 }}>Sources</Box>
                <Box component="th" sx={{ textAlign: "left" }}>Industry</Box>
              </Box>
            </Box>
            <Box component="tbody">
              {top_accounts.slice(0, 10).map((a: CMOTopAccount) => (
                <Box
                  key={a.company_id} component="tr"
                  sx={{
                    "& td": { fontFamily: F, ...ROW.cell, color: C.textMd, py: 0.8 },
                    "&:not(:last-child) td": { borderBottom: `1px solid ${C.card}` },
                    "&:hover td": { bgcolor: `${C.orange}03` },
                  }}
                >
                  <Box component="td"
                    sx={{ borderLeft: `3px solid ${tierColor[a.heat_tier] || C.dim}`, pl: 1.25, cursor: "pointer", ...ROW.primary, color: C.text, "&:hover": { color: C.orange } }}
                    onClick={() => navigate(isacPath(`/companies/${a.company_id}`))}>
                    {a.company_name}
                  </Box>
                  <Tooltip title={`Intent: ${a.intent_score}/100 — ${a.intent_score >= 40 ? "High" : a.intent_score >= 15 ? "Medium" : "Low"} purchase likelihood`} arrow placement="top">
                    <Box component="td" sx={{ textAlign: "center", ...ROW.number, color: intentColor(a.intent_score), fontFamily: F, cursor: "help" }}>
                      {a.intent_score}
                    </Box>
                  </Tooltip>
                  <Tooltip title={`Awareness: ${a.awareness_score}/100 — ${a.awareness_score >= 40 ? "High" : a.awareness_score >= 15 ? "Medium" : "Low"} brand familiarity`} arrow placement="top">
                    <Box component="td" sx={{ textAlign: "center", ...ROW.number, color: C.sub, cursor: "help" }}>{a.awareness_score}</Box>
                  </Tooltip>
                  <Box component="td">
                    {a.buying_stage ? (
                      <Tooltip title={a.buying_stage === "decision" ? "Decision — Actively evaluating pricing and ready to buy" : a.buying_stage === "consideration" ? "Consideration — Comparing WSO2 against alternatives" : "Awareness — Exploring the product category"} arrow placement="top">
                        <Box component="span" sx={{
                          fontSize: FS.caption, px: 0.75, py: 0.2, borderRadius: "3px", fontWeight: FW.semibold, cursor: "help",
                          bgcolor: `${stageColor[a.buying_stage] || C.dim}12`,
                          color: stageColor[a.buying_stage] || C.dim,
                        }}>{a.buying_stage}</Box>
                      </Tooltip>
                    ) : <Box component="span" sx={{ color: C.dim, fontSize: FS.small }}>--</Box>}
                  </Box>
                  <Box component="td">
                    <Box sx={{ display: "flex", gap: 0.4 }}>
                      {[
                        { on: a.has_g2, l: "G2", c: C.blue },
                        { on: a.has_linkedin, l: "LI", c: C.green },
                        { on: a.has_pardot, l: "P", c: C.amber },
                        { on: a.has_sf, l: "SF", c: C.orange },
                        { on: a.has_certs, l: "C", c: C.red },
                      ].map((d) => (
                        <Box key={d.l} sx={{
                          width: 17, height: 17, borderRadius: "50%", fontSize: FS.micro, fontWeight: FW.semibold,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: d.on ? d.c : C.card, color: d.on ? "#fff" : C.dim,
                          border: d.on ? "none" : `1px solid ${C.border}`,
                        }}>{d.l}</Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="td" sx={{ fontSize: FS.small, color: C.sub, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.industry || "--"}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Bottom strip: Source Coverage | Heat | Signal Feed ─────── */}
      <Box sx={{ display: "flex", minHeight: 0 }}>

        {/* Source Coverage */}
        <Box sx={{ flex: 1, px: 2.5, pt: 2, pb: 2, borderRight: `1px solid ${C.border}` }}>
          <SectionHead>Source Coverage</SectionHead>
          {[
            { label: "G2 Buyer Intent", count: source_coverage.g2_companies, color: C.blue },
            { label: "LinkedIn Ads", count: source_coverage.linkedin_companies, color: C.green },
            { label: "Pardot Leads", count: source_coverage.pardot_companies, color: C.amber },
            { label: "Certifications", count: source_coverage.cert_companies, color: C.orange },
          ].map((s) => (
            <HBar key={s.label} label={s.label} value={s.count} pct={(s.count / srcMax) * 100} color={s.color} />
          ))}
        </Box>

        {/* Heat Distribution */}
        <Box sx={{ flex: 1, px: 2.5, pt: 2, pb: 2, borderRight: `1px solid ${C.border}` }}>
          <SectionHead>Heat Distribution</SectionHead>
          {(["hot", "warm", "cold"] as const).map((tier) => {
            const count = heat_tier_counts[tier];
            const pct = (count / heatTotal) * 100;
            return <HBar key={tier} label={tier.charAt(0).toUpperCase() + tier.slice(1)} value={count} pct={pct} color={tierColor[tier]} suffix={` (${pct.toFixed(0)}%)`} />;
          })}
        </Box>

        {/* Signal Feed */}
        <Box sx={{ flex: 1.2, px: 2.5, pt: 2, pb: 2 }}>
          <SectionHead right={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.textMd }}>{cs.signals_7d} this week</Typography>
              {cs.signals_7d_g2 > 0 && <Box sx={{ fontSize: FS.micro, px: 0.5, py: 0.1, borderRadius: "3px", bgcolor: `${C.blue}10`, color: C.blue, fontFamily: F, fontWeight: FW.semibold }}>G2 {cs.signals_7d_g2}</Box>}
              {cs.signals_7d_linkedin > 0 && <Box sx={{ fontSize: FS.micro, px: 0.5, py: 0.1, borderRadius: "3px", bgcolor: `${C.green}10`, color: C.green, fontFamily: F, fontWeight: FW.semibold }}>LI {cs.signals_7d_linkedin}</Box>}
            </Box>
          }>Signal Feed</SectionHead>
          {signal_feed.length === 0 ? (
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 3, textAlign: "center" }}>No signals yet</Typography>
          ) : (
            signal_feed.slice(0, 5).map((s, i) => (
              <Box key={i} sx={{
                display: "flex", alignItems: "center", gap: 1, py: 0.6,
                borderBottom: i < 4 ? `1px solid ${C.card}` : "none",
              }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{s.raw_company_name || "Unknown"}</Typography>
                  <Box sx={{ display: "flex", gap: 0.5, mt: 0.15 }}>
                    {s.buying_stage && (
                      <Box component="span" sx={{ fontSize: FS.micro, px: 0.5, py: 0.1, borderRadius: "2px", bgcolor: `${stageColor[s.buying_stage] || C.dim}12`, color: stageColor[s.buying_stage] || C.dim, fontWeight: FW.semibold, fontFamily: F }}>{s.buying_stage}</Box>
                    )}
                    {s.wso2_product && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{s.wso2_product}</Typography>}
                  </Box>
                </Box>
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, flexShrink: 0 }}>{relativeTime(s.last_seen)}</Typography>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
